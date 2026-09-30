"use client";

import { useState } from "react";
import { LogOut, Mail, Save, Send } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import type { Preferences } from "@/lib/workspace-types";
import { AdminSettings } from "@/components/admin-settings";
import type { ManagedUser } from "@/lib/types";
import { useWorkspace } from "./context";
import { useResource } from "./resource";
import { Button, SavedNotice, Switch } from "./ui";
import { ErrorView, LoadingView } from "./today";
import { CHANNELS } from "./format";
import s from "./workspace.module.css";

type AdminSettingsData = React.ComponentProps<typeof AdminSettings>["initialSettings"];
export function SettingsScreen({ userId }: { userId: string }) {
  const { preferences, setPreferences, logout, refresh } = useWorkspace();
  const [tab, setTab] = useState("personal");
  const [draft, setDraft] = useState(preferences), [webhook, setWebhook] = useState(""), [clearWebhook, setClearWebhook] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const saved = await apiRequest<Preferences>("/api/preferences", { method: "PATCH", body: JSON.stringify({
        name: draft.name, timeZone: draft.timeZone, weekendDays: draft.weekendDays, calendarWeekStartsOn: draft.calendarWeekStartsOn,
        defaultEmail: draft.defaultEmail, defaultDiscord: draft.defaultDiscord, defaultInApp: draft.defaultInApp,
        ...(clearWebhook ? { discordWebhookUrl: null } : webhook ? { discordWebhookUrl: webhook } : {}),
      }) });
      setPreferences(saved); setDraft(saved); setWebhook(""); setClearWebhook(false); setMessage("Preferences saved."); refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save preferences."); }
    finally { setBusy(false); }
  }
  async function test(channel: string) {
    setBusy(true); setError(""); setMessage("");
    try { const result = await apiRequest<{ message: string }>("/api/preferences/test-delivery", { method: "POST", body: JSON.stringify({ channel }) }); setMessage(result.message); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Test delivery failed."); }
    finally { setBusy(false); }
  }
  async function resetPassword() {
    setBusy(true); setError("");
    try { const result = await apiRequest<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: preferences.email }) }); setMessage(result.message); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to request password reset."); }
    finally { setBusy(false); }
  }
  return <div className={s.settingsLayout}><div className={`${s.tabs} ${s.settingsTabs}`} role="group" aria-label="Settings section">{[["personal", "Preferences"], ["reminders", "Reminders"], ...(preferences.role === "ADMIN" ? [["admin", "Administration"]] : [])].map(([key, label]) => <button key={key} aria-pressed={tab === key} className={tab === key ? s.tabActive : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {error && <p role="alert" className={s.errorMessage}>{error}</p>}{message && <SavedNotice>{message}</SavedNotice>}
    {tab === "admin" ? <Administration userId={userId} /> : <form onSubmit={save}>
      {tab === "personal" ? <>
        <section className={s.settingsSection}><div><h2>Profile</h2></div><div className={s.settingsFields}><label className={s.field}>Name<input required maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label className={s.field}>Email<input type="email" value={preferences.email} readOnly /></label><Button disabled={busy || !preferences.emailConfigured} onClick={resetPassword}><Mail />Send password reset link</Button></div></section>
        <section className={s.settingsSection}><div><h2>Calendar</h2></div><div className={s.settingsFields}><label className={s.field}>First day of the week<select value={draft.calendarWeekStartsOn ?? "default"} onChange={(e) => setDraft({ ...draft, calendarWeekStartsOn: e.target.value === "default" ? null : Number(e.target.value) })}><option value="default">Workspace default ({preferences.defaultWeekStart === 0 ? "Sunday" : "Monday"})</option><option value={0}>Sunday</option><option value={1}>Monday</option></select></label><div className={s.field}><span>Regular days off</span><div className={s.weekdays}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <button type="button" key={day} aria-pressed={draft.weekendDays.includes(index)} onClick={() => setDraft({ ...draft, weekendDays: draft.weekendDays.includes(index) ? draft.weekendDays.filter((value) => value !== index) : [...draft.weekendDays, index].sort() })}>{day}</button>)}</div></div></div></section>
      </> : <>
        <section className={s.settingsSection}><div><h2>Default channels</h2><p>For new trips. Existing trip choices stay unchanged.</p></div><div className={s.settingsFields}>{CHANNELS.filter(({ key }) => preferences.available[key]).map(({ defaultField, label }) => <Switch key={defaultField} label={label} checked={draft[defaultField]} onChange={(value) => setDraft({ ...draft, [defaultField]: value })} />)}<p className={s.inlineNote}>Timing: {[preferences.reminderSevenDaysEnabled && "7 days before", preferences.reminderOneDayEnabled && "1 day before", preferences.reminderBookingOpenEnabled && "when booking opens"].filter(Boolean).join(", ") || "Disabled by administrator"}.</p></div></section>
        {preferences.available.email && <section className={s.settingsSection}><div><h2>Email delivery</h2></div><div className={s.settingsFields}><p>{preferences.email}</p><p className={s.inlineNote}>{preferences.emailConfigured ? "Email service configured" : "Email service not configured by the administrator"}</p><Button disabled={busy || !preferences.emailConfigured} onClick={() => test("email")}><Send />Send test email</Button></div></section>}
        {preferences.available.discord && <section className={s.settingsSection}><div><h2>Discord delivery</h2><p>Private to your account.</p></div><div className={s.settingsFields}><label className={s.field}>Webhook URL<input type="password" autoComplete="off" value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder={preferences.discordConfigured ? "Configured. Enter a value to replace." : "https://discord.com/api/webhooks/..."} /></label>{preferences.discordStored && <label className={s.checkRow}><input type="checkbox" checked={clearWebhook} onChange={(e) => setClearWebhook(e.target.checked)} />Remove saved webhook</label>}<Button disabled={busy || !preferences.discordConfigured || Boolean(webhook) || clearWebhook} onClick={() => test("discord")}><Send />Send test to saved webhook</Button></div></section>}
      </>}
      <div className={s.settingsFoot}><Button variant="primary" disabled={busy} type="submit"><Save />{busy ? "Saving..." : "Save preferences"}</Button></div>
    </form>}
    <div className={s.mobileLogout}><Button variant="quiet" onClick={logout}><LogOut />Log out</Button></div>
  </div>;
}

function Administration({ userId }: { userId: string }) {
  const { setPreferences } = useWorkspace();
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  const settings = useResource<AdminSettingsData>("/api/settings", revision), users = useResource<ManagedUser[]>("/api/settings/users", revision);
  if (settings.loading || users.loading) return <LoadingView />;
  if (settings.error || users.error || !settings.data || !users.data) return <ErrorView error={settings.error || users.error} retry={refresh} />;
  return <div className={s.adminSettings}><AdminSettings currentUserId={userId} initialSettings={settings.data} initialUsers={users.data} onSaved={async () => { setPreferences(await apiRequest<Preferences>("/api/preferences")); }} /></div>;
}

"use client";

import { Bell, Mail, MessageCircle, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { ManagedUser } from "@/lib/types";

type Settings = {
  allowSignups: boolean; reminderEmailEnabled: boolean; reminderDiscordEnabled: boolean; reminderInAppEnabled: boolean;
  reminderSevenDaysEnabled: boolean; reminderOneDayEnabled: boolean; reminderBookingOpenEnabled: boolean;
  bookingWindowDays: number; bookingOpenHour: number; bookingOpenMinute: number; calendarWeekStartsOn: 0 | 1; pnrAutoSyncEnabled: boolean; pnrSyncIntervalMinutes: number;
  smtpConfigured: boolean; discordConfigured: boolean; emailFrom: string;
};

export function AdminSettings({ currentUserId, initialSettings, initialUsers }: { currentUserId: string; initialSettings: Settings; initialUsers: ManagedUser[] }) {
  const [settings, setSettings] = useState(initialSettings);
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (!inviteOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setInviteOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [inviteOpen]);

  async function save(formData: FormData) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const smtpUrl = String(formData.get("smtpUrl") ?? "");
      const discordWebhookUrl = String(formData.get("discordWebhookUrl") ?? "");
      const clearSmtp = formData.get("clearSmtp") === "on";
      const clearDiscord = formData.get("clearDiscord") === "on";
      const payload = {
        ...settings,
        bookingWindowDays: Number(formData.get("bookingWindowDays")), bookingOpenHour: Number(formData.get("bookingOpenHour")), bookingOpenMinute: Number(formData.get("bookingOpenMinute")), calendarWeekStartsOn: Number(formData.get("calendarWeekStartsOn")) as 0 | 1, pnrSyncIntervalMinutes: Number(formData.get("pnrSyncIntervalMinutes")),
        emailFrom: settings.reminderEmailEnabled ? formData.get("emailFrom") : undefined,
        ...(clearSmtp ? { smtpUrl: null } : smtpUrl ? { smtpUrl } : {}),
        ...(clearDiscord ? { discordWebhookUrl: null } : discordWebhookUrl ? { discordWebhookUrl } : {}),
      };
      const updated = await apiRequest<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(payload) });
      setSettings(updated); setMessage("Settings saved.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Settings could not be saved."); }
    finally { setBusy(false); }
  }

  async function invite(formData: FormData) {
    setBusy(true); setError(undefined);
    try { const user = await apiRequest<ManagedUser>("/api/settings/users", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) }); setUsers((current) => [...current, user]); setInviteOpen(false); setMessage("Invitation sent."); }
    catch (inviteError) { setError(inviteError instanceof Error ? inviteError.message : "The invitation could not be sent."); }
    finally { setBusy(false); }
  }

  async function updateUser(user: ManagedUser, patch: Partial<ManagedUser>) {
    try { const updated = await apiRequest<ManagedUser>(`/api/settings/users/${user.id}`, { method: "PATCH", body: JSON.stringify(patch) }); setUsers((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (updateError) { setError(updateError instanceof Error ? updateError.message : "The user could not be updated."); }
  }

  async function deleteUser(user: ManagedUser) {
    if (!window.confirm(`Delete ${user.email}?`)) return;
    try { await apiRequest(`/api/settings/users/${user.id}`, { method: "DELETE" }); setUsers((current) => current.filter((item) => item.id !== user.id)); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "The user could not be deleted."); }
  }

  return <div className="grid gap-3">
    {(error || message) && <div className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span>{error ?? message}</span><button type="button" onClick={() => { setError(undefined); setMessage(undefined); }} title="Dismiss"><X className="h-4 w-4" /></button></div>}
    <form action={save} className="grid gap-3">
    <div className="grid gap-3 xl:grid-cols-2">
      <Section title="General"><SettingRow label="Allow public signups" detail="New visitors can create their own account."><Switch label="Allow public signups" checked={settings.allowSignups} onChange={(value) => setSettings({ ...settings, allowSignups: value })} /></SettingRow><div className="border-t border-slate-200"><SettingRow label="First day of the week" detail="Applied to month and week calendar views."><select name="calendarWeekStartsOn" aria-label="First day of the week" defaultValue={settings.calendarWeekStartsOn} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"><option value={0}>Sunday</option><option value={1}>Monday</option></select></SettingRow></div></Section>
      <Section title="Booking schedule"><div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3"><NumberField name="bookingWindowDays" label="Window (days)" defaultValue={settings.bookingWindowDays} min={1} max={365} /><NumberField name="bookingOpenHour" label="Open hour" defaultValue={settings.bookingOpenHour} min={0} max={23} /><NumberField name="bookingOpenMinute" label="Open minute" defaultValue={settings.bookingOpenMinute} min={0} max={59} /></div></Section>
    </div>
    <Section title="Reminder channels"><div className="grid gap-2 p-3 sm:grid-cols-3"><Channel icon={Mail} label="Email" checked={settings.reminderEmailEnabled} onChange={(value) => setSettings({ ...settings, reminderEmailEnabled: value })} /><Channel icon={MessageCircle} label="Discord" checked={settings.reminderDiscordEnabled} onChange={(value) => setSettings({ ...settings, reminderDiscordEnabled: value })} /><Channel icon={Bell} label="In-app" checked={settings.reminderInAppEnabled} onChange={(value) => setSettings({ ...settings, reminderInAppEnabled: value })} /></div>{(settings.reminderEmailEnabled || settings.reminderDiscordEnabled) && <div className="grid gap-3 border-t border-slate-200 p-3 lg:grid-cols-2">{settings.reminderEmailEnabled && <div className="grid gap-2"><TextField name="smtpUrl" type="password" label="SMTP URL" placeholder={settings.smtpConfigured ? "Configured - enter a value to replace" : "smtp://user:password@mail.example.com:587"} />{settings.smtpConfigured && <label className="flex items-center gap-2 text-xs text-red-700"><input name="clearSmtp" type="checkbox" />Remove the saved SMTP URL</label>}</div>}{settings.reminderEmailEnabled && <TextField name="emailFrom" label="Email sender" defaultValue={settings.emailFrom} placeholder="IRCTC Travel Planner <noreply@example.com>" />}{settings.reminderDiscordEnabled && <div className="grid gap-2"><TextField name="discordWebhookUrl" type="password" label="Discord webhook URL" placeholder={settings.discordConfigured ? "Configured - enter a value to replace" : "https://discord.com/api/webhooks/..."} />{settings.discordConfigured && <label className="flex items-center gap-2 text-xs text-red-700"><input name="clearDiscord" type="checkbox" />Remove the saved Discord webhook</label>}</div>}</div>}</Section>
    <div className="grid gap-3 xl:grid-cols-2"><Section title="Reminder timing"><div className="grid gap-2 p-3"><CheckRow label="7 days before booking opens" checked={settings.reminderSevenDaysEnabled} onChange={(value) => setSettings({ ...settings, reminderSevenDaysEnabled: value })} /><CheckRow label="1 day before booking opens" checked={settings.reminderOneDayEnabled} onChange={(value) => setSettings({ ...settings, reminderOneDayEnabled: value })} /><CheckRow label="When booking opens" checked={settings.reminderBookingOpenEnabled} onChange={(value) => setSettings({ ...settings, reminderBookingOpenEnabled: value })} /></div></Section><Section title="PNR sync"><SettingRow label="Automatic PNR refresh" detail="Refresh tagged booked tickets in the background."><Switch label="Automatic PNR refresh" checked={settings.pnrAutoSyncEnabled} onChange={(value) => setSettings({ ...settings, pnrAutoSyncEnabled: value })} /></SettingRow>{settings.pnrAutoSyncEnabled && <div className="border-t border-slate-200 p-3"><NumberField name="pnrSyncIntervalMinutes" label="Refresh interval (minutes)" defaultValue={settings.pnrSyncIntervalMinutes} min={15} max={10080} /></div>} {!settings.pnrAutoSyncEnabled && <input type="hidden" name="pnrSyncIntervalMinutes" value={settings.pnrSyncIntervalMinutes} />}</Section></div>
    <div className="flex justify-end"><button disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{busy ? "Saving..." : "Save settings"}</button></div>
    </form>
    <Section title="Users" action={<button type="button" onClick={() => setInviteOpen(true)} disabled={!settings.smtpConfigured} title={!settings.smtpConfigured ? "Configure SMTP before inviting users" : undefined} className="inline-flex h-8 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" />Invite user</button>}><div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Access</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((user) => <tr key={user.id}><td className="px-3 py-2"><strong className="block">{user.name ?? "Unnamed user"}</strong><span className="text-xs text-slate-500">{user.email}</span></td><td className="px-3 py-2"><select value={user.role} onChange={(event) => updateUser(user, { role: event.target.value as "ADMIN" | "USER" })} disabled={user.id === currentUserId} className="h-8 rounded-md border border-slate-300 px-2"><option value="USER">User</option><option value="ADMIN">Admin</option></select></td><td className="px-3 py-2"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={user.isActive} disabled={user.id === currentUserId} onChange={(event) => updateUser(user, { isActive: event.target.checked })} />{user.isActive ? "Active" : "Disabled"}</label></td><td className="px-3 py-2 text-right"><button type="button" onClick={() => deleteUser(user)} disabled={user.id === currentUserId} title="Delete user" className="grid h-8 w-8 place-items-center rounded-md border border-red-200 text-red-700 disabled:opacity-30 ml-auto"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></Section>
    {inviteOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onMouseDown={(event) => event.target === event.currentTarget && setInviteOpen(false)}><section role="dialog" aria-modal="true" aria-label="Invite user" className="w-full max-w-md rounded-md bg-white shadow-xl"><header className="flex h-12 items-center justify-between border-b border-slate-200 px-4"><h2 className="font-semibold">Invite user</h2><button type="button" onClick={() => setInviteOpen(false)} title="Close"><X className="h-4 w-4" /></button></header><div className="p-4"><form action={invite} className="grid gap-3"><TextField name="name" label="Name" required /><TextField name="email" type="email" label="Email" required /><label className="grid gap-1.5 text-sm font-medium">Role<select name="role" className="h-10 rounded-md border border-slate-300 px-3"><option value="USER">User</option><option value="ADMIN">Admin</option></select></label><button disabled={busy} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"><UserRound className="h-4 w-4" />Send invitation</button></form></div></section></div>}
  </div>;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-md border border-slate-200 bg-white"><header className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-200 px-3 py-1.5"><h2 className="text-sm font-semibold">{title}</h2>{action}</header>{children}</section>; }
function SettingRow({ label, detail, children }: { label: string; detail: string; children: React.ReactNode }) { return <div className="flex items-center justify-between gap-4 p-3"><span><strong className="block text-sm">{label}</strong><span className="text-xs text-slate-500">{detail}</span></span>{children}</div>; }
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full ${checked ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} /></button>; }
function Channel({ icon: Icon, label, checked, onChange }: { icon: React.ComponentType<{ className?: string }>; label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium"><Icon className="h-4 w-4 text-slate-500" />{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="ml-auto h-4 w-4 accent-slate-950" /></label>; }
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-slate-950" />{label}</label>; }
function TextField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid gap-1.5 text-sm font-medium">{label}<input {...props} className="h-10 rounded-md border border-slate-300 px-3" /></label>; }
function NumberField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid gap-1.5 text-sm font-medium">{label}<input {...props} type="number" required className="h-10 rounded-md border border-slate-300 px-3" /></label>; }

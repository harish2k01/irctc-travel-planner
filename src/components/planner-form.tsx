"use client";

import { Bell, CalendarDays, Mail, MessageCircle, Plus, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { PublicReminderSettings } from "@/lib/types";

export function PlannerForm({ channels, bookingWindowDays }: { channels: PublicReminderSettings; bookingWindowDays: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(formData: FormData) {
    setBusy(true);
    setError(undefined);
    try {
      const payload = Object.fromEntries(formData);
      const result = await apiRequest<{ id: string }>("/api/journeys", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          pnr: payload.pnr || undefined,
          reminderEmailEnabled: formData.get("reminderEmailEnabled") === "on",
          reminderDiscordEnabled: formData.get("reminderDiscordEnabled") === "on",
          reminderInAppEnabled: formData.get("reminderInAppEnabled") === "on",
        }),
      });
      router.push(`/tracker?ticket=${result.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The ticket could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl rounded-md border border-slate-200 bg-white">
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2"><div><h2 className="text-base font-semibold">Plan a ticket</h2><p className="text-xs text-slate-500">Booking date is calculated {bookingWindowDays} days before travel.</p></div><Ticket className="h-5 w-5 text-slate-400" /></header>
      <form action={submit} className="grid gap-4 p-4">
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Source station code" name="sourceCode" placeholder="MDU" required />
          <Field label="Source station name" name="sourceName" placeholder="Madurai" />
          <Field label="Destination station code" name="destinationCode" placeholder="MS" required />
          <Field label="Destination station name" name="destinationName" placeholder="Chennai Egmore" />
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Travel date<span className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required name="travelDate" type="date" className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3" /></span></label>
          <Field label="PNR number (optional)" name="pnr" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="Tag after booking" />
        </div>
        {(channels.email || channels.discord || channels.inApp) && (
          <fieldset className="rounded-md border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold">Reminders for this ticket</legend><div className="mt-1 flex flex-wrap gap-2">
            {channels.email && <Toggle name="reminderEmailEnabled" label="Email" icon={Mail} />}
            {channels.discord && <Toggle name="reminderDiscordEnabled" label="Discord" icon={MessageCircle} />}
            {channels.inApp && <Toggle name="reminderInAppEnabled" label="In-app" icon={Bell} />}
          </div></fieldset>
        )}
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Notes<textarea name="notes" maxLength={1000} rows={4} placeholder="Optional travel notes" className="rounded-md border border-slate-300 p-3" /></label>
        <button disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Plus className="h-4 w-4" />{busy ? "Saving..." : "Add ticket plan"}</button>
      </form>
    </section>
  );
}

function Field({ label, ...input }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<input {...input} className="h-10 rounded-md border border-slate-300 px-3 uppercase placeholder:normal-case" /></label>;
}

function Toggle({ name, label, icon: Icon }: { name: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"><Icon className="h-4 w-4 text-slate-500" /><span>{label}</span><input name={name} type="checkbox" defaultChecked className="ml-1 h-4 w-4 accent-slate-950" /></label>;
}

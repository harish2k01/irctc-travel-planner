"use client";

import { FileUp, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { buildTravelSuggestions } from "@/lib/suggestions";
import type { Holiday, Ticket } from "@/lib/types";

export function HolidayWorkspace({ initialHolidays, tickets, timeZone, weekendDays }: { initialHolidays: Holiday[]; tickets: Ticket[]; timeZone: string; weekendDays: number[] }) {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [dialog, setDialog] = useState<"add" | "import">();
  const [editing, setEditing] = useState<Holiday>();
  const [error, setError] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => buildTravelSuggestions(tickets, holidays, timeZone, weekendDays), [tickets, holidays, timeZone, weekendDays]);

  async function remove(holiday: Holiday) {
    if (!window.confirm(`Delete ${holiday.name}?`)) return;
    try { await apiRequest(`/api/holidays/${holiday.id}`, { method: "DELETE" }); setHolidays((current) => current.filter((item) => item.id !== holiday.id)); }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : "The leave entry could not be deleted."); }
  }

  async function save(formData: FormData) {
    const target = editing;
    try {
      const saved = await apiRequest<Holiday>(target ? `/api/holidays/${target.id}` : "/api/holidays", { method: target ? "PATCH" : "POST", body: JSON.stringify(Object.fromEntries(formData)) });
      setHolidays((current) => target ? current.map((item) => item.id === saved.id ? saved : item).sort(sortDate) : [...current, saved].sort(sortDate));
      setEditing(undefined); setDialog(undefined);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "The leave entry could not be saved."); }
  }

  async function importIcs(formData: FormData) {
    try {
      const selected = file.current?.files?.[0];
      const icsText = selected ? await selected.text() : undefined;
      const imported = await apiRequest<Omit<Holiday, "id">[]>("/api/holidays/import-ics", { method: "POST", body: JSON.stringify({ url: formData.get("url") || undefined, icsText }) });
      const saved: Holiday[] = [];
      for (const holiday of imported) saved.push(await apiRequest<Holiday>("/api/holidays", { method: "POST", body: JSON.stringify(holiday) }));
      setHolidays((current) => [...current, ...saved].sort(sortDate)); setDialog(undefined);
    } catch (importError) { setError(importError instanceof Error ? importError.message : "The calendar could not be imported."); }
  }

  return <div className="grid gap-3 xl:grid-cols-[minmax(22rem,.8fr)_minmax(28rem,1.2fr)]">
    <section className="rounded-md border border-slate-200 bg-white"><header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2"><h2 className="mr-auto text-sm font-semibold">Company and personal leave</h2><button onClick={() => setDialog("import")} className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium"><FileUp className="h-4 w-4" />Import ICS</button><button onClick={() => setDialog("add")} className="inline-flex h-8 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white"><Plus className="h-4 w-4" />Add leave</button></header>{error && <div className="m-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>}<div className="divide-y divide-slate-100">{holidays.map((holiday) => <div key={holiday.id} className="flex items-center gap-3 px-3 py-2.5"><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{holiday.name}</strong><span className="text-xs text-slate-500">{holiday.type === "PERSONAL_LEAVE" ? "Personal leave" : "Company"}</span></span><span className="whitespace-nowrap text-sm text-slate-600">{formatDate(holiday.date)}</span><button onClick={() => setEditing(holiday)} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(holiday)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-red-200 text-red-700"><Trash2 className="h-4 w-4" /></button></div>)}{holidays.length === 0 && <p className="px-3 py-12 text-center text-sm text-slate-500">No leave dates added.</p>}</div></section>
    <section className="rounded-md border border-slate-200 bg-white"><header className="flex h-12 items-center justify-between border-b border-slate-200 px-3"><h2 className="text-sm font-semibold">Travel suggestions</h2><span className="text-xs text-slate-500">Saturday and Sunday included</span></header><div className="grid gap-2 p-3">{suggestions.map((item) => { const content = <><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-sm leading-5 text-slate-600">{item.detail}</span></>; const style = item.tone === "amber" ? "border-amber-200 bg-amber-50" : item.tone === "green" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"; return item.ticketId ? <Link key={item.id} href={`/tracker?ticket=${item.ticketId}`} className={`rounded-md border p-3 hover:brightness-95 ${style}`}>{content}</Link> : <article key={item.id} className={`rounded-md border p-3 ${style}`}>{content}</article>; })}{suggestions.length === 0 && <p className="py-12 text-center text-sm text-slate-500">No travel conflicts or booking actions detected.</p>}</div></section>
    {(dialog === "add" || editing) && <Modal title={editing ? "Edit leave" : "Add leave"} onClose={() => { setDialog(undefined); setEditing(undefined); }}><form action={save} className="grid gap-3"><Field label="Name" name="name" defaultValue={editing?.name} required /><Field label="Date" name="date" type="date" defaultValue={editing?.date} required /><label className="grid gap-1.5 text-sm font-medium">Type<select name="type" defaultValue={editing?.type ?? "COMPANY"} className="h-10 rounded-md border border-slate-300 px-3"><option value="COMPANY">Company</option><option value="PERSONAL_LEAVE">Personal leave</option></select></label><Submit>Save leave</Submit></form></Modal>}
    {dialog === "import" && <Modal title="Import ICS calendar" onClose={() => setDialog(undefined)}><form action={importIcs} className="grid gap-3"><label className="grid gap-1.5 text-sm font-medium">ICS file<input ref={file} type="file" accept=".ics,text/calendar" className="rounded-md border border-slate-300 p-2 text-sm" /></label><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div><Field label="Public ICS URL" name="url" type="url" placeholder="https://example.com/calendar.ics" /><Submit>Import calendar</Submit></form></Modal>}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]); return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-md bg-white shadow-xl"><header className="flex h-12 items-center justify-between border-b border-slate-200 px-4"><h2 className="font-semibold">{title}</h2><button type="button" onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center"><X className="h-4 w-4" /></button></header><div className="p-4">{children}</div></section></div>; }
function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid gap-1.5 text-sm font-medium">{label}<input {...props} className="h-10 rounded-md border border-slate-300 px-3" /></label>; }
function Submit({ children }: { children: React.ReactNode }) { return <button className="mt-1 h-9 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">{children}</button>; }
function sortDate(a: Holiday, b: Holiday) { return a.date.localeCompare(b.date); }

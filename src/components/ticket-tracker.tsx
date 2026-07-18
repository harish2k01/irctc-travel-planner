"use client";

import { Bell, ChevronLeft, ChevronRight, Eye, Mail, MessageCircle, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { formatDate, formatInstant, routeName } from "@/lib/format";
import type { PublicReminderSettings, Ticket } from "@/lib/types";

const PAGE_SIZE = 20;
type Filter = "PLANNED" | "BOOKED" | "ALL";

export function TicketTracker({ initialTickets, channels, timeZone }: { initialTickets: Ticket[]; channels: PublicReminderSettings; timeZone: string }) {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState(initialTickets);
  const [filter, setFilter] = useState<Filter>("PLANNED");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Ticket | undefined>(() => {
    const id = searchParams.get("ticket");
    return id ? initialTickets.find((ticket) => ticket.id === id) : undefined;
  });
  const [editing, setEditing] = useState<Ticket>();
  const [error, setError] = useState<string>();

  const filtered = useMemo(() => tickets.filter((ticket) => {
    const matchesFilter = filter === "ALL" || ticket.status === filter;
    const value = `${ticket.sourceCode} ${ticket.sourceName ?? ""} ${ticket.destinationCode} ${ticket.destinationName ?? ""} ${ticket.pnrLast4 ?? ""}`.toLowerCase();
    return matchesFilter && value.includes(query.toLowerCase());
  }), [tickets, filter, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeFilter(value: Filter) {
    setFilter(value);
    setPage(1);
  }

  async function remove(ticket: Ticket) {
    if (!window.confirm(`Delete ${routeName(ticket)} on ${formatDate(ticket.travelDate)}?`)) return;
    try {
      await apiRequest(`/api/journeys/${ticket.id}`, { method: "DELETE" });
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
      setSelected(undefined);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The ticket could not be deleted.");
    }
  }

  async function sync(ticket: Ticket) {
    try {
      const updated = await apiRequest<Ticket>(`/api/journeys/${ticket.id}/sync-pnr`, { method: "POST" });
      setTickets((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "PNR details could not be synced.");
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
        <div className="inline-flex rounded-md border border-slate-200 p-0.5">
          <FilterButton active={filter === "PLANNED"} onClick={() => changeFilter("PLANNED")}>To book <Count>{tickets.filter((ticket) => ticket.status === "PLANNED").length}</Count></FilterButton>
          <FilterButton active={filter === "BOOKED"} onClick={() => changeFilter("BOOKED")}>Booked <Count>{tickets.filter((ticket) => ticket.status === "BOOKED").length}</Count></FilterButton>
          <FilterButton active={filter === "ALL"} onClick={() => changeFilter("ALL")}>All <Count>{tickets.length}</Count></FilterButton>
        </div>
        <label className="relative ml-auto w-full sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search route or PNR" className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" /></label>
      </header>
      {error && <div role="alert" className="m-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><span>{error}</span><button onClick={() => setError(undefined)} title="Dismiss"><X className="h-4 w-4" /></button></div>}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><Th>Route</Th><Th>Travel</Th><Th>Booking opens</Th><Th>PNR</Th><Th>Reminders</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50">
                <td className="px-3 py-2"><button type="button" onClick={() => setSelected(ticket)} className="text-left"><strong className="block">{routeName(ticket)}</strong>{(ticket.sourceName || ticket.destinationName) && <span className="text-xs text-slate-500">{ticket.sourceName ?? ticket.sourceCode} to {ticket.destinationName ?? ticket.destinationCode}</span>}</button></td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{formatDate(ticket.travelDate)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatInstant(ticket.bookingOpensAt, timeZone)}</td>
                <td className="whitespace-nowrap px-3 py-2">{ticket.pnrTagged ? `Ending ${ticket.pnrLast4}` : <span className="text-slate-500">Not tagged</span>}</td>
                <td className="px-3 py-2"><ReminderIcons ticket={ticket} /></td>
                <td className="px-3 py-2"><div className="flex justify-end gap-1"><Action label="View" icon={Eye} onClick={() => setSelected(ticket)} /><Action label="Edit" icon={Pencil} onClick={() => setEditing(ticket)} />{ticket.pnrTagged && <Action label="Sync PNR" icon={RefreshCw} onClick={() => sync(ticket)} />}<Action label="Delete" icon={Trash2} danger onClick={() => remove(ticket)} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {visible.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelected(ticket)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 p-3 text-left hover:bg-slate-50"><span><strong className="block">{routeName(ticket)}</strong><span className="text-xs text-slate-500">Travel {formatDate(ticket.travelDate)}</span></span><span className="text-right text-xs text-slate-500">{ticket.pnrTagged ? `PNR ending ${ticket.pnrLast4}` : "PNR not tagged"}</span></button>)}
      </div>

      {visible.length === 0 && <p className="px-3 py-12 text-center text-sm text-slate-500">No tickets match this view.</p>}
      <footer className="flex h-11 items-center justify-between border-t border-slate-200 px-3 text-xs text-slate-500"><span>{filtered.length} ticket{filtered.length === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 disabled:opacity-40" title="Previous page"><ChevronLeft className="h-4 w-4" /></button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 disabled:opacity-40" title="Next page"><ChevronRight className="h-4 w-4" /></button></div></footer>

      {selected && <TicketDialog ticket={selected} timeZone={timeZone} onClose={() => setSelected(undefined)} onEdit={() => { setEditing(selected); setSelected(undefined); }} onSync={() => sync(selected)} />}
      {editing && <EditDialog ticket={editing} channels={channels} onClose={() => setEditing(undefined)} onSaved={(updated) => { setTickets((current) => current.map((item) => item.id === updated.id ? updated : item)); setEditing(undefined); }} />}
    </section>
  );
}

function TicketDialog({ ticket, timeZone, onClose, onEdit, onSync }: { ticket: Ticket; timeZone: string; onClose: () => void; onEdit: () => void; onSync: () => void }) {
  return <Dialog title={routeName(ticket)} onClose={onClose}><div className="grid gap-4"><div className="grid grid-cols-2 gap-3 text-sm"><Meta label="Travel date" value={formatDate(ticket.travelDate)} /><Meta label="Booking opens" value={formatInstant(ticket.bookingOpensAt, timeZone)} /><Meta label="PNR" value={ticket.pnrTagged ? `Ending ${ticket.pnrLast4}` : "Not tagged"} /><Meta label="Status" value={ticket.status === "BOOKED" ? "Booked" : ticket.status === "ARCHIVED" ? "Archived" : "To book"} /></div>{ticket.pnrSnapshot && <section className="rounded-md border border-slate-200"><h3 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">Latest PNR details</h3><div className="grid grid-cols-2 gap-3 p-3 text-sm"><Meta label="Train" value={[ticket.pnrSnapshot.trainNumber, ticket.pnrSnapshot.trainName].filter(Boolean).join(" ") || "Not available"} /><Meta label="Class" value={ticket.pnrSnapshot.bookedClass ?? "Not available"} /><Meta label="Seat" value={[ticket.pnrSnapshot.coach, ticket.pnrSnapshot.seat].filter(Boolean).join(" / ") || "Not available"} /><Meta label="Provider status" value={ticket.pnrSnapshot.providerStatus ?? "Not available"} /></div></section>}{ticket.notes && <div><h3 className="text-sm font-semibold">Notes</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{ticket.notes}</p></div>}<div className="flex justify-end gap-2">{ticket.pnrTagged && <button onClick={onSync} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium"><RefreshCw className="h-4 w-4" />Sync PNR</button>}<button onClick={onEdit} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"><Pencil className="h-4 w-4" />Edit</button></div></div></Dialog>;
}

function EditDialog({ ticket, channels, onClose, onSaved }: { ticket: Ticket; channels: PublicReminderSettings; onClose: () => void; onSaved: (ticket: Ticket) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function save(formData: FormData) {
    setBusy(true); setError(undefined);
    try {
      const removePnr = formData.get("removePnr") === "on";
      const pnr = String(formData.get("pnr") ?? "");
      const response = await apiRequest<{ ticket: Ticket }>(`/api/journeys/${ticket.id}`, { method: "PATCH", body: JSON.stringify({
        sourceCode: formData.get("sourceCode"), sourceName: formData.get("sourceName"), destinationCode: formData.get("destinationCode"), destinationName: formData.get("destinationName"), travelDate: formData.get("travelDate"), notes: formData.get("notes"), version: ticket.version,
        ...(removePnr ? { pnr: null } : pnr ? { pnr } : {}),
        reminderEmailEnabled: formData.get("reminderEmailEnabled") === "on", reminderDiscordEnabled: formData.get("reminderDiscordEnabled") === "on", reminderInAppEnabled: formData.get("reminderInAppEnabled") === "on",
      }) });
      onSaved(response.ticket);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "The ticket could not be saved."); } finally { setBusy(false); }
  }
  return <Dialog title="Edit ticket plan" onClose={onClose}><form action={save} className="grid gap-4">{error && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>}<div className="grid gap-3 sm:grid-cols-2"><EditField name="sourceCode" label="Source station code" defaultValue={ticket.sourceCode} required /><EditField name="sourceName" label="Source station name" defaultValue={ticket.sourceName} /><EditField name="destinationCode" label="Destination station code" defaultValue={ticket.destinationCode} required /><EditField name="destinationName" label="Destination station name" defaultValue={ticket.destinationName} /><EditField name="travelDate" label="Travel date" type="date" defaultValue={ticket.travelDate} required /><EditField name="pnr" label={ticket.pnrTagged ? `Replace PNR ending ${ticket.pnrLast4}` : "Tag PNR after booking"} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10 digit PNR" /></div>{ticket.pnrTagged && <label className="flex items-center gap-2 text-sm text-red-700"><input name="removePnr" type="checkbox" className="h-4 w-4" />Remove the current PNR tag</label>}<fieldset className="rounded-md border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold">Reminder channels</legend><div className="flex flex-wrap gap-3">{channels.email && <EditToggle name="reminderEmailEnabled" label="Email" defaultChecked={ticket.reminderEmailEnabled} />}{channels.discord && <EditToggle name="reminderDiscordEnabled" label="Discord" defaultChecked={ticket.reminderDiscordEnabled} />}{channels.inApp && <EditToggle name="reminderInAppEnabled" label="In-app" defaultChecked={ticket.reminderInAppEnabled} />}</div></fieldset><label className="grid gap-1.5 text-sm font-medium">Notes<textarea name="notes" defaultValue={ticket.notes} maxLength={1000} rows={3} className="rounded-md border border-slate-300 p-3" /></label><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium">Cancel</button><button disabled={busy} className="h-9 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving..." : "Save"}</button></div></form></Dialog>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const key = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-md bg-white shadow-xl"><header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4"><h2 className="font-semibold">{title}</h2><button type="button" onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100"><X className="h-4 w-4" /></button></header><div className="p-4">{children}</div></section></div>;
}

function ReminderIcons({ ticket }: { ticket: Ticket }) { return <span className="flex gap-1 text-slate-500">{ticket.reminderEmailEnabled && <Mail className="h-4 w-4" aria-label="Email reminders" />}{ticket.reminderDiscordEnabled && <MessageCircle className="h-4 w-4" aria-label="Discord reminders" />}{ticket.reminderInAppEnabled && <Bell className="h-4 w-4" aria-label="In-app reminders" />}{!ticket.reminderEmailEnabled && !ticket.reminderDiscordEnabled && !ticket.reminderInAppEnabled && <span className="text-xs">Off</span>}</span>; }
function Action({ label, icon: Icon, danger, onClick }: { label: string; icon: React.ComponentType<{ className?: string }>; danger?: boolean; onClick: () => void }) { return <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-md border ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4" /></button>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`flex h-8 items-center gap-2 rounded px-3 text-sm font-medium ${active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{children}</button>; }
function Count({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-xs text-slate-700">{children}</span>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-2 font-semibold">{children}</th>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><span className="block text-xs text-slate-500">{label}</span><strong className="mt-0.5 block font-medium">{value}</strong></div>; }
function EditField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid gap-1.5 text-sm font-medium">{label}<input {...props} className="h-10 rounded-md border border-slate-300 px-3" /></label>; }
function EditToggle({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="flex items-center gap-2 text-sm"><input {...props} type="checkbox" className="h-4 w-4 accent-slate-950" />{label}</label>; }

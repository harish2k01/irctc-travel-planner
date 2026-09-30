"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { ChevronLeft, ChevronRight, FileUp, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { todayInTimeZone } from "@/lib/dates";
import { buildTravelSuggestions } from "@/lib/suggestions";
import type { Holiday } from "@/lib/types";
import type { CalendarData } from "@/lib/workspace-types";
import { useWorkspace } from "./context";
import { useResource } from "./resource";
import { Button, Dialog, Empty, IconButton } from "./ui";
import { bookingDay, dateLabel } from "./format";
import s from "./workspace.module.css";

export function CalendarScreen() {
  const { preferences, revision, refresh, openTrip, notify } = useWorkspace();
  const calendar = useRef<FullCalendar>(null);
  const [range, setRange] = useState<{ start: string; end: string }>();
  const [title, setTitle] = useState(""), [view, setView] = useState("dayGridMonth");
  const [editing, setEditing] = useState<Holiday>();
  const [importing, setImporting] = useState(false);
  const { data, error, loading } = useResource<CalendarData>(range ? `/api/workspace/calendar?${new URLSearchParams(range)}` : null, revision);
  useEffect(() => { if (window.matchMedia("(max-width: 700px)").matches) calendar.current?.getApi().changeView("listMonth"); }, []);
  const events = useMemo(() => [
    ...(data?.tickets ?? []).flatMap((trip) => [
      ...(trip.status === "PLANNED" ? [{ id: `booking-${trip.id}`, title: `Book ${trip.sourceCode} to ${trip.destinationCode}`, start: bookingDay(trip), backgroundColor: "#fcf0dc", textColor: "#865611", extendedProps: { tripId: trip.id } }] : []),
      { id: `travel-${trip.id}`, title: `${trip.status === "BOOKED" ? "Booked" : "Travel"} ${trip.sourceCode} to ${trip.destinationCode}`, start: trip.travelDate, backgroundColor: trip.status === "BOOKED" ? "#e5f1e9" : "#e8f0f7", textColor: trip.status === "BOOKED" ? "#31674e" : "#365d7b", extendedProps: { tripId: trip.id } },
    ]),
    ...(data?.holidays ?? []).map((item) => ({ id: item.id, title: item.name, start: item.date, backgroundColor: "#efeaf3", textColor: "#725780", extendedProps: { leaveId: item.id } })),
  ].map((event) => ({ ...event, allDay: true })), [data]);
  const suggestions = useMemo(() => buildTravelSuggestions(data?.tickets ?? [], data?.holidays ?? [], "Asia/Kolkata", preferences.weekendDays).slice(0, 3), [data, preferences.weekendDays]);
  return <div className={s.calendarLayout}>
    <section className={s.calendar} aria-label="Journey calendar">
      <div className={s.calendarToolbar}><div className={s.calendarNav}><IconButton label="Previous period" onClick={() => calendar.current?.getApi().prev()}><ChevronLeft /></IconButton><IconButton label="Next period" onClick={() => calendar.current?.getApi().next()}><ChevronRight /></IconButton><h2>{title}</h2></div><div className={s.tabs} role="group" aria-label="Calendar view"><button onClick={() => calendar.current?.getApi().gotoDate(todayInTimeZone())}>Today</button>{[["dayGridMonth", "Month"], ["dayGridWeek", "Week"], ["listMonth", "Agenda"]].map(([key, name]) => <button key={key} aria-pressed={view === key} className={view === key ? s.tabActive : ""} onClick={() => calendar.current?.getApi().changeView(key)}>{name}</button>)}</div></div>
      {error && <p role="alert" className={s.errorMessage}>{error}<Button onClick={refresh}>Retry</Button></p>}{loading && <p role="status" className={s.inlineNote}>Loading calendar...</p>}{data?.truncated && <p className={s.errorMessage}>This range contains more than 1,000 entries. Select Week to see a smaller range.</p>}
      <FullCalendar ref={calendar} plugins={[dayGridPlugin, listPlugin, interactionPlugin]} initialDate={todayInTimeZone()} initialView="dayGridMonth" headerToolbar={false} firstDay={preferences.calendarWeekStartsOn ?? preferences.defaultWeekStart} events={events} height="auto" fixedWeekCount={false} dayMaxEvents={2} eventDisplay="block"
        datesSet={(info) => { setTitle(info.view.title); setView(info.view.type); setRange({ start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10) }); }}
        eventClick={(info) => { const { tripId, leaveId } = info.event.extendedProps; if (tripId) openTrip(tripId); if (leaveId) setEditing(data?.holidays.find((item) => item.id === leaveId)); }}
        eventDidMount={(info) => {
          const trip = data?.tickets.find((item) => item.id === info.event.extendedProps.tripId);
          const label = trip ? `${info.event.title}. Travel ${dateLabel(trip.travelDate, true)}. Booking ${dateLabel(bookingDay(trip), true)}.` : info.event.title;
          info.el.setAttribute("title", label); info.el.setAttribute("aria-label", label); info.el.setAttribute("tabindex", "0"); info.el.setAttribute("role", "button");
          info.el.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); info.el.click(); } };
        }} />
      <div className={s.legend}><span><i className={s.bookingDot} />Booking</span><span><i />Travel to book</span><span><i className={s.bookedDot} />Booked travel</span><span><i className={s.leaveDot} />Leave</span></div>
    </section>
    <aside className={s.calendarAside}><section><div className={s.sectionHead}><h2>Leave & holidays</h2><IconButton label="Add leave" onClick={() => setEditing({ id: "", name: "", date: todayInTimeZone(), type: "PERSONAL_LEAVE" })}><Plus /></IconButton></div>{data?.holidays.length ? data.holidays.map((item) => <div key={item.id} className={s.leaveRow}><button className={s.rowLink} onClick={() => setEditing(item)}><p>{item.name}</p><small>{dateLabel(item.date, true)} | {item.type === "COMPANY" ? "Company" : "Personal leave"}</small></button><IconButton label={`Edit ${item.name}`} onClick={() => setEditing(item)}><ChevronRight /></IconButton></div>) : !loading && <Empty title="No leave in this period" />}<p className={s.inlineNote}>Days off: {preferences.weekendDays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ") || "None"}</p></section>
      {suggestions.length > 0 && <section className={s.sectionSpace}><h2>Worth a look</h2>{suggestions.map((item) => <div key={item.id} className={s.suggestion}><h3>{item.title}</h3><p>{item.detail}</p>{item.ticketId && <Button variant="quiet" onClick={() => openTrip(item.ticketId!)}>View trip<ChevronRight /></Button>}</div>)}</section>}
    </aside>
    {editing && <LeaveForm key={editing.id} item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); notify("Leave updated."); }} />}
    <div><Button variant="quiet" onClick={() => setImporting(true)}><FileUp />Import leave calendar</Button></div>
    {importing && <ImportLeave onClose={() => setImporting(false)} onSaved={(added) => { setImporting(false); refresh(); notify(`${added} leave ${added === 1 ? "date" : "dates"} imported.`); }} />}
  </div>;
}

function ImportLeave({ onClose, onSaved }: { onClose: () => void; onSaved: (added: number) => void }) {
  const [file, setFile] = useState<File>(), [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Omit<Holiday, "id">[]>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      if (preview) {
        const result = await apiRequest<{ added: number }>("/api/holidays/import-ics", { method: "POST", body: JSON.stringify({ holidays: preview, save: true }) });
        onSaved(result.added);
      } else {
        if (file && file.size > 1_000_000) throw new Error("Choose a calendar smaller than 1 MB.");
        const icsText = file ? await file.text() : undefined;
        const rows = await apiRequest<Omit<Holiday, "id">[]>("/api/holidays/import-ics", { method: "POST", body: JSON.stringify({ ...(icsText ? { icsText } : { url }) }) });
        // Freeze the reviewed dates; do not fetch a changing URL again on save.
        setPreview(rows);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to import calendar."); }
    finally { setBusy(false); }
  }
  return <Dialog title="Import leave calendar" onClose={() => !busy && onClose()}><form onSubmit={(event) => { event.preventDefault(); void submit(); }}><div className={`${s.dialogBody} ${s.form}`}>
    {preview ? <><p>{preview.length} leave dates found. Existing dates will be skipped.</p><div className={s.sideList}>{preview.slice(0, 20).map((row, index) => <div key={index}><span>{row.name}</span><small>{dateLabel(row.date, true)}</small></div>)}</div>{preview.length > 20 && <p>{preview.length - 20} more dates</p>}</> : <><label className={s.field}>ICS file<input type="file" accept=".ics,text/calendar" onChange={(event) => setFile(event.target.files?.[0])} /></label><label className={s.field}>Public ICS URL<input type="url" disabled={Boolean(file)} required={!file} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/leave.ics" /></label></>}
    {error && <p role="alert" className={s.errorMessage}>{error}</p>}</div><footer className={s.dialogFoot}><Button disabled={busy} onClick={() => preview ? setPreview(undefined) : onClose()}>{preview ? "Back" : "Cancel"}</Button><Button type="submit" disabled={busy} variant="primary">{busy ? "Please wait..." : preview ? "Import dates" : "Review dates"}</Button></footer></form></Dialog>;
}

function LeaveForm({ item, onClose, onSaved }: { item: Holiday; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(item), [busy, setBusy] = useState(false), [error, setError] = useState(""), [deleting, setDeleting] = useState(false);
  async function save(remove = false) {
    setBusy(true); setError("");
    try { await apiRequest(item.id ? `/api/holidays/${item.id}` : "/api/holidays", { method: remove ? "DELETE" : item.id ? "PATCH" : "POST", ...(remove ? {} : { body: JSON.stringify(draft) }) }); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save leave."); }
    finally { setBusy(false); }
  }
  return <Dialog title={deleting ? "Delete leave?" : item.id ? "Edit leave" : "Add leave"} onClose={() => !busy && onClose()}><form onSubmit={(event) => { event.preventDefault(); void save(deleting); }}><div className={`${s.dialogBody} ${s.form}`}>
    {deleting ? <p>{draft.name}, {dateLabel(draft.date, true)} will be removed.</p> : <><label className={s.field}>Name<input required minLength={2} maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className={s.field}>Date<input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label className={s.field}>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Holiday["type"] })}><option value="COMPANY">Company</option><option value="PERSONAL_LEAVE">Personal leave</option></select></label></>}{error && <p role="alert" className={s.errorMessage}>{error}</p>}
    </div><footer className={s.dialogFoot}>{item.id && !deleting && <Button variant="danger" disabled={busy} onClick={() => setDeleting(true)}><Trash2 />Delete</Button>}<Button disabled={busy} onClick={() => deleting ? setDeleting(false) : onClose()}>Cancel</Button><Button disabled={busy} variant={deleting ? "danger" : "primary"} type="submit">{busy ? "Saving..." : deleting ? "Delete leave" : "Save leave"}</Button></footer></form></Dialog>;
}

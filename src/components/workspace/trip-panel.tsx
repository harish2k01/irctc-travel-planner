"use client";

import { useState } from "react";
import { ArrowLeftRight, Bell, CalendarDays, Check, Copy, ExternalLink, Link2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { bookingOpenInstant, todayInTimeZone } from "@/lib/dates";
import type { Ticket } from "@/lib/types";
import type { TripDetailData } from "@/lib/workspace-types";
import { useWorkspace } from "./context";
import { useResource } from "./resource";
import { Badge, Button, Dialog, IconButton, Route } from "./ui";
import { bookingLabel, CHANNELS, dateLabel, tripState } from "./format";
import s from "./workspace.module.css";

export function TripForm({ trip, seed, onClose, onSaved }: { trip?: Ticket; seed?: Partial<Ticket>; onClose: () => void; onSaved: (trip: Ticket) => void }) {
  const { preferences, notify } = useWorkspace();
  const [draft, setDraft] = useState(() => ({
    sourceCode: trip?.sourceCode ?? seed?.sourceCode ?? "", sourceName: trip?.sourceName ?? seed?.sourceName ?? "",
    destinationCode: trip?.destinationCode ?? seed?.destinationCode ?? "", destinationName: trip?.destinationName ?? seed?.destinationName ?? "",
    travelDate: trip?.travelDate ?? "", notes: trip?.notes ?? "",
    reminderEmailEnabled: trip?.reminderEmailEnabled ?? (preferences.available.email && preferences.defaultEmail),
    reminderDiscordEnabled: trip?.reminderDiscordEnabled ?? (preferences.available.discord && preferences.defaultDiscord),
    reminderInAppEnabled: trip?.reminderInAppEnabled ?? (preferences.available.inApp && preferences.defaultInApp),
  }));
  const [returnEnabled, setReturnEnabled] = useState(false), [returnDate, setReturnDate] = useState("");
  const [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  function update(values: Partial<typeof draft>) { setDraft((current) => ({ ...current, ...values })); setDirty(true); }
  const close = () => { if (!busy) { if (dirty) setDiscard(true); else onClose(); } };
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (draft.sourceCode.trim().toUpperCase() === draft.destinationCode.trim().toUpperCase()) { setError("Choose different source and destination stations."); return; }
    if (returnEnabled && returnDate < draft.travelDate) { setError("The return date must be on or after the outbound date."); return; }
    setBusy(true);
    try {
      if (trip) {
        const result = await apiRequest<{ ticket: Ticket; warning?: string }>(`/api/journeys/${trip.id}`, { method: "PATCH", body: JSON.stringify({ ...draft, version: trip.version }) });
        notify(result.warning ?? "Trip updated."); onSaved(result.ticket);
      } else {
        const result = await apiRequest<Ticket>("/api/journeys", { method: "POST", body: JSON.stringify({ ...draft, ...(returnEnabled ? { returnDate } : {}) }) });
        notify(returnEnabled ? "Outbound and return journeys saved." : "Trip saved."); onSaved(result);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save this trip."); }
    finally { setBusy(false); }
  }
  const estimate = (date: string) => bookingLabel(bookingOpenInstant(date, preferences.bookingWindowDays, preferences.bookingOpenHour, preferences.bookingOpenMinute).toISOString());
  return <Dialog title={trip ? "Edit trip" : "Add trip"} onClose={close} wide><form onSubmit={save}>
    <div className={`${s.dialogBody} ${s.form}`}><div className={s.formHeading}><h3>Journey</h3><IconButton label="Swap stations" onClick={() => update({ sourceCode: draft.destinationCode, sourceName: draft.destinationName, destinationCode: draft.sourceCode, destinationName: draft.sourceName })}><ArrowLeftRight /></IconButton></div>
      <div className={s.formGrid}>
        <label className={s.field}>From station code<input required minLength={2} maxLength={16} autoCapitalize="characters" placeholder="e.g. MDU" value={draft.sourceCode} onChange={(e) => update({ sourceCode: e.target.value.toUpperCase() })} /></label>
        <label className={s.field}>To station code<input required minLength={2} maxLength={16} autoCapitalize="characters" placeholder="e.g. MS" value={draft.destinationCode} onChange={(e) => update({ destinationCode: e.target.value.toUpperCase() })} /></label>
        <label className={s.field}>From station name <small>Optional</small><input maxLength={120} value={draft.sourceName} onChange={(e) => update({ sourceName: e.target.value })} /></label>
        <label className={s.field}>To station name <small>Optional</small><input maxLength={120} value={draft.destinationName} onChange={(e) => update({ destinationName: e.target.value })} /></label>
        <label className={s.field}>Travel date<input type="date" required min={trip ? undefined : todayInTimeZone()} value={draft.travelDate} onChange={(e) => update({ travelDate: e.target.value })} /></label>
        {!trip && <div className={s.field}><label className={s.checkRow}><input type="checkbox" checked={returnEnabled} onChange={(e) => { setReturnEnabled(e.target.checked); setDirty(true); }} />Add return journey</label>{returnEnabled && <input type="date" aria-label="Return date" required min={draft.travelDate || todayInTimeZone()} value={returnDate} onChange={(e) => { setReturnDate(e.target.value); setDirty(true); }} />}</div>}
      </div>
      {draft.travelDate && <div className={s.estimate}><CalendarDays size={16} /><span>Estimated booking: <strong>{estimate(draft.travelDate)}</strong><small>{preferences.bookingWindowDays}-day planning window. Confirm train-specific rules before booking.</small>{returnEnabled && returnDate && <small>Return booking: {estimate(returnDate)}</small>}</span></div>}
      {(!trip || trip.status === "PLANNED") && <section className={s.formDivider}><div className={s.formHeading}><h3>Booking reminders</h3></div><div className={s.channelChoice}>{CHANNELS.filter(({ key }) => preferences.available[key]).map(({ field, label }) => <label key={field}><input type="checkbox" checked={draft[field]} onChange={(e) => update({ [field]: e.target.checked })} />{label}</label>)}</div><p className={s.inlineNote}><Bell size={13} />{[preferences.reminderSevenDaysEnabled && "7 days before", preferences.reminderOneDayEnabled && "1 day before", preferences.reminderBookingOpenEnabled && "when booking opens"].filter(Boolean).join(", ") || "Reminder timing is disabled in workspace settings."}</p>{draft.reminderEmailEnabled && !preferences.emailConfigured && <p className={s.errorMessage}>Email delivery is not configured. Your plan will still be saved.</p>}{draft.reminderDiscordEnabled && !preferences.discordConfigured && <p className={s.errorMessage}>Add your Discord webhook in Settings to receive Discord reminders.</p>}</section>}
      <label className={s.field}>Notes <small>Optional</small><textarea maxLength={1000} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} /></label>
      {error && <p role="alert" className={s.errorMessage}>{error}</p>}
    </div>
    {discard && <div className={s.discard} role="alert"><p>Discard unsaved changes?</p><Button variant="danger" onClick={onClose}>Discard changes</Button><Button onClick={() => setDiscard(false)}>Keep editing</Button></div>}
    <footer className={s.dialogFoot}><Button onClick={close} disabled={busy}>Cancel</Button><Button variant="primary" type="submit" disabled={busy}>{trip ? <Check /> : <Plus />}{busy ? "Saving..." : trip ? "Save changes" : returnEnabled ? "Add both trips" : "Add trip"}</Button></footer>
  </form></Dialog>;
}

export function TripPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { preferences, refresh, notify, openTrip, addTrip } = useWorkspace();
  const [revision, setRevision] = useState(0);
  const resource = useResource<TripDetailData>(`/api/journeys/${encodeURIComponent(id)}`, revision);
  const [editing, setEditing] = useState(false), [deleting, setDeleting] = useState(false), [linking, setLinking] = useState(false);
  const [pnr, setPnr] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const trip = resource.data?.ticket;
  function changed() { refresh(); setRevision((value) => value + 1); }
  async function patch(values: Record<string, unknown>) {
    if (!trip || busy) return;
    setBusy(true); setError("");
    try {
      const result = await apiRequest<{ ticket: Ticket; warning?: string }>(`/api/journeys/${id}`, { method: "PATCH", body: JSON.stringify({ ...values, version: trip.version }) });
      notify(result.warning ?? "Trip updated."); setLinking(false); setPnr(""); changed();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to update trip."); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try { await apiRequest(`/api/journeys/${id}`, { method: "DELETE" }); refresh(); notify("Trip and its reminders deleted."); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to delete trip."); setBusy(false); }
  }
  async function sync() {
    setBusy(true); setError("");
    try { await apiRequest(`/api/journeys/${id}/sync-pnr`, { method: "POST" }); changed(); notify("PNR details refreshed."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to refresh PNR."); }
    finally { setBusy(false); }
  }
  if (editing && trip) return <TripForm trip={trip} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); changed(); }} />;
  if (deleting && trip) return <Dialog title="Delete this trip?" onClose={() => !busy && setDeleting(false)}><div className={s.dialogBody}><Route trip={trip} /><p className={s.inlineNote}>Travel {dateLabel(trip.travelDate, true)}. This trip and its reminders will be permanently removed. Linked journeys are kept.</p>{error && <p role="alert" className={s.errorMessage}>{error}</p>}</div><footer className={s.dialogFoot}><Button disabled={busy} onClick={() => setDeleting(false)}>Keep trip</Button><Button variant="danger" disabled={busy} onClick={remove}>{busy ? "Deleting..." : "Delete trip"}</Button></footer></Dialog>;
  return <Dialog title="Trip details" onClose={onClose} panel><div className={s.dialogBody}>
    {resource.loading && <p role="status">Loading trip...</p>}{resource.error && <div role="alert" className={s.errorMessage}>{resource.error}<Button onClick={() => setRevision((v) => v + 1)}>Retry</Button></div>}
    {trip && <><div className={s.detailRoute}><Route trip={trip} /><p>{trip.sourceCode} to {trip.destinationCode} | {dateLabel(trip.travelDate, true)}</p></div><Badge tone={tripState(trip).tone}>{tripState(trip).label}</Badge>
      <dl className={s.detailStats}><div><dt>Travel date</dt><dd>{dateLabel(trip.travelDate, true)}</dd></div><div><dt>Estimated booking opens</dt><dd>{bookingLabel(trip.bookingOpensAt)}</dd></div></dl>
      {error && <p role="alert" className={s.errorMessage}>{error}</p>}
      {trip.status === "PLANNED" && trip.travelDate >= todayInTimeZone() && <div className={s.detailActions}><a className={`${s.button} ${s.primary}`} href="https://www.irctc.co.in/nget/train-search" target="_blank" rel="noreferrer">Open IRCTC<ExternalLink size={14} /></a><Button disabled={busy} onClick={() => patch({ status: "BOOKED" })}><Check />Mark booked</Button></div>}
      {trip.status === "PLANNED" && <section className={s.detailSection}><h3>Booking reminders</h3><div className={s.channelChoice}>{CHANNELS.filter(({ key }) => preferences.available[key]).map(({ field, label }) => <label key={field}><input type="checkbox" disabled={busy} checked={trip[field]} onChange={(e) => patch({ [field]: e.target.checked })} />{label}</label>)}</div></section>}
      {trip.status === "BOOKED" && <div className={s.estimate}><Check size={16} />Booked. Booking reminders are stopped.</div>}
      <section className={s.detailSection}><h3>Booking reference</h3><p>{trip.pnrTagged ? `PNR ending ${trip.pnrLast4}` : "No PNR linked"}</p>
        {!linking ? <Button variant="quiet" onClick={() => setLinking(true)}><Link2 />{trip.pnrTagged ? "Change PNR" : "Link PNR"}</Button> : <form className={s.form} onSubmit={(e) => { e.preventDefault(); void patch({ pnr }); }}><label className={s.field}>PNR <small>Optional</small><input aria-label="PNR" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={pnr} onChange={(e) => setPnr(e.target.value)} placeholder="10 digits, or leave blank to unlink" /></label><div className={s.detailActions}><Button disabled={busy} type="submit" variant="primary">Save PNR</Button><Button disabled={busy} onClick={() => setLinking(false)}>Cancel</Button></div></form>}
        {trip.pnrTagged && <>{trip.pnrLastError && <p className={s.errorMessage}>{trip.pnrLastError}</p>}{trip.pnrSnapshot ? <><dl className={s.detailStats}>{[["Train", [trip.pnrSnapshot.trainNumber, trip.pnrSnapshot.trainName].filter(Boolean).join(" ")], ["Class", trip.pnrSnapshot.bookedClass], ["Status", trip.pnrSnapshot.providerStatus], ["Coach / seat", [trip.pnrSnapshot.coach, trip.pnrSnapshot.seat].filter(Boolean).join(" / ")]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={s.inlineNote}>Last refreshed {bookingLabel(trip.pnrSnapshot.syncedAt)}</p></> : <p className={s.inlineNote}>No provider details fetched yet.</p>}<Button disabled={busy || !preferences.pnrConfigured} onClick={sync}><RefreshCw />Refresh PNR</Button>{!preferences.pnrConfigured && <p className={s.inlineNote}>PNR integration is not configured by your administrator.</p>}</>}
      </section>
      {resource.data!.linked.length > 0 && <section className={s.detailSection}><h3>Linked journey</h3>{resource.data!.linked.map((linked) => <Button key={linked.id} variant="quiet" onClick={() => openTrip(linked.id)}><ArrowLeftRight />{linked.sourceCode} to {linked.destinationCode}, {dateLabel(linked.travelDate, true)}</Button>)}</section>}
      {trip.notes && <section className={s.detailSection}><h3>Notes</h3><p className={s.preserveLines}>{trip.notes}</p></section>}
      {resource.data!.deliveries.length > 0 && <section className={s.detailSection}><h3>Reminder activity</h3><div className={s.timeline}>{resource.data!.deliveries.map((delivery) => <div key={delivery.id}>{delivery.channel === "IN_APP" ? "In-app" : delivery.channel === "DISCORD" ? "Discord" : "Email"}: {({ SENT: "Delivered", READ: "Read", FAILED: "Failed", SENDING: "Sending", PENDING: "Queued", CANCELLED: "Cancelled" } as Record<string, string>)[delivery.status]}<small>{delivery.lastError || (delivery.sentAt ? bookingLabel(delivery.sentAt) : delivery.nextAttemptAt ? `Retry ${bookingLabel(delivery.nextAttemptAt)}` : "Waiting for delivery")}</small></div>)}</div></section>}
      <div className={s.detailActions}><Button disabled={busy} onClick={() => setEditing(true)}><Pencil />Edit trip</Button><Button disabled={busy} onClick={() => addTrip(trip)}><Copy />Duplicate</Button>{trip.status === "BOOKED" && <Button disabled={busy} onClick={() => patch({ status: "PLANNED", pnr: null })}>Move to To book</Button>}<Button variant="danger" disabled={busy} onClick={() => setDeleting(true)}><Trash2 />Delete</Button></div>
    </>}
  </div></Dialog>;
}

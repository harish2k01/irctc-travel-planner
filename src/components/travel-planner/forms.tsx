"use client";

import { cloneElement, useEffect, useId, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { ArrowRight, Bell, Link2, X } from "lucide-react";
import { addDays, DEFAULT_CLOCK, journeySchema, REMINDER_KEYS, ruleSchema, type Journey, type Planner, type ReminderOverride, type Rule } from "@/lib/travel-planner";
import s from "./planner.module.css";
import { weekday, type TicketAttachment } from "@/lib/travel-planner";
import { deleteTicketFile, downloadTicketFile, extractTicketFile, saveTicketFile, validateTicketFile } from "@/lib/ticket-files";
import type { TicketDetails } from "@/lib/ticket-details";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const STATUS = { needs_booking: "To Book", booked: "Booked", skipped: "Skipped", cancellation_needed: "To Cancel", cancelled: "Cancelled", completed: "Completed" };
export const TIME_LABELS = { any: "Any time", morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
export const REMINDER_LABELS = { previous_evening: "The evening before", morning: "On booking day", opening: "Near booking opening" };

export function Field({ label, children, hint }: { label: string; children: ReactElement; hint?: string }) {
  const id = useId();
  return <div className={s.field}><label htmlFor={id}>{label}</label>{cloneElement(children as ReactElement<{ id: string; "aria-describedby"?: string }>, { id, "aria-describedby": hint ? `${id}-hint` : undefined })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function Modal({ title, subtitle, children, close, wide = false }: { title: string; subtitle?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`${s.modal} ${wide ? s.wideModal : ""}`} onCancel={close} aria-labelledby="editor-title" onClick={e => { if (e.target === e.currentTarget) close(); }}><header className={s.modalHead}><div><h2 id="editor-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className={s.iconButton} onClick={close} aria-label="Close Dialog"><X size={20} /></button></header>{children}</dialog>;
}
export function ReminderTimes({ times, clock }: { times: Planner["settings"]["reminderTimes"]; clock: Planner["settings"]["reminderClock"] }) {
  return <div className={s.reminderTimes}>{REMINDER_KEYS.map(key => <div key={key}><label className={s.check}><input name="reminderTimes" type="checkbox" value={key} defaultChecked={times.includes(key)} />{REMINDER_LABELS[key]}</label><input aria-label={`${REMINDER_LABELS[key]} time`} type="time" name={`clock_${key}`} defaultValue={clock[key]} required /></div>)}</div>;
}
export function ReminderFields({ initial, settings, routine = false }: { initial?: ReminderOverride; settings: Planner["settings"]; routine?: boolean }) {
  const [mode, setMode] = useState(initial?.mode ?? "inherit");
  return <section className={s.formSection}><h3><Bell size={16} /> Booking Reminders</h3><Field label="Reminder Preference"><select name="reminderMode" value={mode} onChange={e => setMode(e.target.value as ReminderOverride["mode"])}><option value="inherit">{routine ? "Use default reminders" : "Use routine / default reminders"}</option><option value="off">No reminders for this {routine ? "routine" : "journey"}</option><option value="custom">Customize reminders</option></select></Field>{mode === "custom" && <ReminderTimes times={initial?.times ?? settings.reminderTimes} clock={initial?.clock ?? settings.reminderClock} />}</section>;
}
export function remindersFromForm(form: FormData): ReminderOverride {
  return { mode: String(form.get("reminderMode") ?? "inherit") as ReminderOverride["mode"], times: form.getAll("reminderTimes") as ReminderOverride["times"], clock: Object.fromEntries(REMINDER_KEYS.map(k => [k, String(form.get(`clock_${k}`) ?? DEFAULT_CLOCK[k])])) as ReminderOverride["clock"] };
}
export function Weekdays({ name = "weekdays", selected = [] }: { name?: string; selected?: number[] }) {
  return <div className={s.weekdays}>{[1, 2, 3, 4, 5, 6, 0].map(d => <label key={d}><input type="checkbox" name={name} value={d} defaultChecked={selected.includes(d)} /><span>{DAYS[d]}</span></label>)}</div>;
}

export function RuleForm({ rule, planner, today, save, fail }: { rule?: Partial<Rule>; planner: Planner; today: string; save: (rule: Rule) => void; fail: (message: string) => void }) {
  const initial = rule?.recurrence;
  const [start, setStart] = useState(rule?.start ?? today);
  const [preset, setPreset] = useState(initial && initial.interval > 1 || !initial && (rule?.intervalWeeks ?? 1) > 1 ? "custom" : initial?.frequency === "monthly" ? `monthly_${initial.monthlyPattern}` : initial?.frequency ?? "weekly");
  const [unit, setUnit] = useState(initial?.frequency ?? "weekly");
  const frequency = preset === "custom" ? unit : preset.startsWith("monthly") ? "monthly" : preset;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); const str = (key: string) => String(form.get(key) ?? "");
    const selected = form.getAll("weekdays").map(Number);
    const interval = preset === "custom" ? Number(form.get("interval")) : 1;
    const result = ruleSchema.safeParse({ ...rule, id: rule?.id ?? crypto.randomUUID(), name: str("name"), from: str("from"), to: str("to"), start, end: str("end") || null, weekdays: frequency === "weekly" ? selected : [weekday(start)], intervalWeeks: Math.min(interval, 12), recurrence: { frequency, interval, monthlyPattern: str("monthlyPattern") || "date", dayOfMonth: Number(form.get("dayOfMonth") ?? start.slice(-2)), ordinal: Number(form.get("ordinal") ?? Math.ceil(Number(start.slice(-2)) / 7)), weekday: Number(form.get("monthlyWeekday") ?? weekday(start)) }, timePreference: "any", departure: "20:00", train: "", travelClass: "", windowDays: planner.settings.bookingWindowDays, originOffset: 0, returnAfterDays: null, returnDeparture: "20:00", returnTrain: "", returnOriginOffset: 0, linkedRuleId: str("linkedRuleId") || undefined, excludedDates: [], paused: rule?.paused ?? false, reminderOverride: remindersFromForm(form) });
    if (!result.success) { fail(frequency === "weekly" && !selected.length ? "Choose at least one travel day." : result.error.issues[0]?.message ?? "Check the routine fields."); return; }
    save(result.data);
  }
  return <form className={s.form} onSubmit={submit}>
    <Field label="Routine Name"><input name="name" maxLength={80} defaultValue={rule?.name} placeholder="Give this routine a name" required /></Field>
    <div className={s.formGrid}><Field label="From"><input name="from" defaultValue={rule?.from} maxLength={80} placeholder="Station or city" required /></Field><Field label="To"><input name="to" defaultValue={rule?.to} maxLength={80} placeholder="Station or city" required /></Field></div>
    <div className={s.formGrid}><Field label="Start Date"><input name="start" type="date" value={start} onChange={e => setStart(e.target.value)} required /></Field><Field label="End Date (Optional)" hint="Leave empty for an ongoing routine."><input name="end" type="date" defaultValue={rule?.end ?? ""} /></Field></div>
    <section className={s.formSection}><h3>Repeat This Journey</h3><Field label="Repeat Every"><select value={preset} onChange={e => setPreset(e.target.value)}><option value="daily">Every day</option><option value="weekly">Every week on selected days</option><option value="monthly_date">Every month on a date</option><option value="monthly_weekday">Every month on a weekday</option><option value="yearly">Every year on the start date</option><option value="custom">Custom repeat…</option></select></Field>
      {preset === "custom" && <div className={s.formGrid}><Field label="Repeat Interval"><input name="interval" type="number" min={1} max={365} defaultValue={initial?.interval ?? rule?.intervalWeeks ?? 1} required /></Field><Field label="Interval Unit"><select value={unit} onChange={e => setUnit(e.target.value as typeof unit)}><option value="daily">Days</option><option value="weekly">Weeks</option><option value="monthly">Months</option><option value="yearly">Years</option></select></Field></div>}
      {frequency === "weekly" && <fieldset><legend>Travel days</legend><Weekdays selected={rule?.weekdays ?? [weekday(start)]} /></fieldset>}
      {frequency === "monthly" && <MonthlyPattern key={preset} customizable={preset === "custom"} pattern={preset === "monthly_weekday" ? "weekday" : preset === "monthly_date" ? "date" : initial?.monthlyPattern ?? "date"} start={start} initial={initial} />}
      {frequency === "yearly" && <p className={s.help}>Repeats on the month and day of your start date. February 29 repeats only in leap years.</p>}
      <p className={s.help}>Journeys are created for the next six months. Months without your selected date or weekday are skipped.</p>
    </section>
    <section className={s.formSection}><h3><Link2 size={16} /> Onward And Return</h3><Field label="Link To Another Routine" hint="Each direction has its own recurrence and reminders."><select name="linkedRuleId" defaultValue={rule?.linkedRuleId ?? ""}><option value="">Independent routine</option>{planner.rules.filter(r => r.id !== rule?.id).map(r => <option value={r.id} key={r.id}>{r.name} · {r.from} → {r.to}</option>)}</select></Field></section>
    <ReminderFields initial={rule?.reminderOverride} settings={planner.settings} routine /><div className={s.formFooter}><button className={s.primary}>Save routine <ArrowRight size={16} /></button></div>
  </form>;
}

function MonthlyPattern({ pattern, start, initial, customizable }: { pattern: string; start: string; initial?: Rule["recurrence"]; customizable: boolean }) {
  const [choice, setChoice] = useState(pattern);
  // Re-mount when switching the preset so the visible pattern matches it.
  return <div className={s.monthlyFields}>{customizable ? <Field label="Monthly Pattern"><select name="monthlyPattern" value={choice} onChange={e => setChoice(e.target.value)}><option value="date">Day of the month</option><option value="weekday">Weekday of the month</option></select></Field> : <input type="hidden" name="monthlyPattern" value={choice} />}{choice === "date" ? <Field label="Day Of The Month"><input name="dayOfMonth" type="number" min={1} max={31} defaultValue={initial?.dayOfMonth ?? Number(start.slice(-2))} required /></Field> : <div className={s.formGrid}><Field label="Week Of The Month"><select name="ordinal" defaultValue={initial?.ordinal ?? Math.ceil(Number(start.slice(-2)) / 7)}>{[[1, "First"], [2, "Second"], [3, "Third"], [4, "Fourth"], [5, "Fifth"], [-1, "Last"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Weekday"><select name="monthlyWeekday" defaultValue={initial?.weekday ?? weekday(start)}>{DAYS.map((d, i) => <option value={i} key={d}>{d}</option>)}</select></Field></div>}</div>;
}

export function JourneyForm({ journey, date, planner, today, save, fail, ticket = false }: { journey?: Journey; date?: string; planner: Planner; today: string; save: (journey: Journey) => boolean | Promise<boolean>; fail: (message: string) => void; ticket?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Journey["status"]>(ticket ? "booked" : journey?.status ?? "needs_booking");
  const [files, setFiles] = useState<TicketAttachment[]>(journey?.attachments ?? []);
  const staged = useRef(new Map<string, File>());
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<TicketDetails>({});
  const [extraction, setExtraction] = useState("");
  const showTicket = status !== "needs_booking" && status !== "skipped" || Boolean(journey?.pnr || journey?.train || journey?.trainName || files.length);
  async function upload(file?: File) {
    if (!file) return;
    try {
      if (files.length >= 20) throw new Error("Keep up to 20 attachments per journey.");
      const metadata = validateTicketFile(file);
      staged.current.set(metadata.id, file); setFiles(old => [...old, metadata]); setBusy(true); setDetected({}); setExtraction("Reading your ticket…");
      try { const result = await extractTicketFile(file); setDetected(result.details); setExtraction(result.message); }
      catch { setExtraction("The file is attached, but could not be read. Enter the details manually below."); }
    } catch (e) { fail(e instanceof Error ? e.message : "Could not attach this file."); }
    finally { setBusy(false); }
  }
  function applyDetails() {
    for (const [key, value] of Object.entries(detected)) { const field = ref.current?.elements.namedItem(key); if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value; }
    setExtraction("Detected details applied. Review them before saving."); setDetected({});
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const form = new FormData(e.currentTarget); const str = (key: string) => String(form.get(key) ?? "").trim();
    if (str("from").toLowerCase() === str("to").toLowerCase()) { fail("Choose different departure and arrival stations."); return; }
    const details = showTicket ? { trainName: str("trainName"), trainNumber: str("trainNumber"), train: str("trainName").slice(0, 80), travelClass: str("travelClass"), pnr: str("pnr"), coach: str("coach"), seat: str("seat"), berth: str("berth"), departure: str("departure") || "20:00", departureConfirmed: Boolean(str("departure")) } : { train: journey?.train ?? "", travelClass: journey?.travelClass ?? "", pnr: journey?.pnr ?? "", departure: journey?.departure ?? "20:00" };
    const result = journeySchema.safeParse({ ...journey, ...details, id: journey?.id ?? crypto.randomUUID(), from: str("from"), to: str("to"), date: str("date"), timePreference: "any", windowDays: planner.settings.bookingWindowDays, originOffset: 0, bookingDateOverride: undefined, status, notes: str("notes"), attachments: files, reminderOverride: remindersFromForm(form), manualOverride: journey?.ruleId ? true : journey?.manualOverride });
    if (!result.success) { fail("Check the fields. PNR must be empty or exactly 10 digits."); return; }
    const stored: string[] = []; setBusy(true);
    try {
      for (const meta of files) { const file = staged.current.get(meta.id); if (file) { await saveTicketFile(meta.id, file); stored.push(meta.id); } }
      if (!await save(result.data)) { await Promise.all(stored.map(deleteTicketFile)); return; }
      const removed = (journey?.attachments ?? []).filter(old => !files.some(f => f.id === old.id));
      await Promise.all(removed.map(f => deleteTicketFile(f.id).catch(() => undefined)));
    } catch { await Promise.all(stored.map(id => deleteTicketFile(id).catch(() => undefined))); fail("Could not store the ticket files. Your journey has not been saved."); }
    finally { setBusy(false); }
  }
  return <form ref={ref} className={s.form} onSubmit={submit}>
    <div className={s.formGrid}><Field label="From"><input name="from" defaultValue={journey?.from} maxLength={80} placeholder="Station or city" required /></Field><Field label="To"><input name="to" defaultValue={journey?.to} maxLength={80} placeholder="Station or city" required /></Field></div>
    <div className={s.formGrid}><Field label="Travel Date"><input type="date" name="date" defaultValue={journey?.date ?? date ?? addDays(today, 61)} required /></Field><Field label="Journey Status"><select name="status" value={status} onChange={e => setStatus(e.target.value as Journey["status"])}>{Object.entries(STATUS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></Field></div>
    {showTicket && <section className={s.formSection}><h3>Ticket Details <span className={s.optional}>All optional</span></h3><Field label="Upload Ticket PDF Or QR Image" hint="PDF, PNG, JPEG or WebP · up to 10 MB each. Review detected details before applying."><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></Field>
      {files.map(file => <div className={s.fileRow} key={file.id}><span>{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span><button type="button" className={s.textButton} onClick={() => downloadTicketFile(file, staged.current.get(file.id)).catch(e => fail(e.message))}>Download</button><button type="button" className={s.iconButton} disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => { staged.current.delete(file.id); setFiles(files.filter(f => f.id !== file.id)); }}><X size={16} /></button></div>)}
      {extraction && <div className={s.extraction} role="status"><p>{extraction}</p>{Object.keys(detected).length > 0 && <><dl>{Object.entries(detected).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{value}</dd></div>)}</dl><button type="button" className={s.secondary} onClick={applyDetails}>Apply detected details</button></>}</div>}
      <div className={s.formGrid}><Field label="Train Number"><input name="trainNumber" maxLength={20} defaultValue={journey?.trainNumber} placeholder="e.g. 12637" /></Field><Field label="Train Name"><input name="trainName" maxLength={100} defaultValue={journey?.trainName ?? journey?.train} placeholder="Optional" /></Field><Field label="Travel Class"><select name="travelClass" defaultValue={journey?.travelClass ?? ""}><option value="">Not recorded</option>{["SL", "3A", "2A", "1A", "3E", "CC", "EC", "2S"].map(c => <option key={c}>{c}</option>)}</select></Field><Field label="PNR"><input name="pnr" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} defaultValue={journey?.pnr} placeholder="Optional 10-digit PNR" /></Field><Field label="Coach"><input name="coach" maxLength={20} defaultValue={journey?.coach} placeholder="e.g. B1" /></Field><Field label="Seat Number"><input name="seat" maxLength={30} defaultValue={journey?.seat} placeholder="e.g. 42" /></Field><Field label="Berth"><input name="berth" maxLength={30} defaultValue={journey?.berth} placeholder="e.g. Lower / LB" /></Field><Field label="Departure Time (IST)"><input name="departure" type="time" defaultValue={journey?.departureConfirmed ? journey.departure : ""} /></Field></div>
    </section>}
    <Field label="Notes"><textarea name="notes" maxLength={1000} rows={2} defaultValue={journey?.notes} placeholder="Anything you want to remember" /></Field><ReminderFields initial={journey?.reminderOverride} settings={planner.settings} />
    <div className={s.formFooter}><span className={s.help}>Status changes update your records. Book and cancel through IRCTC.</span><button className={s.primary} disabled={busy}>{busy ? "Working…" : "Save journey"}<ArrowRight size={16} /></button></div>
  </form>;
}

"use client";
import { RailWatchMark } from "@/components/railwatch-mark";

import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/feature-policy";
import { AdminPanel } from "./admin";
import { Profile } from "./profile";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine,ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, GripVertical, LayoutGrid, Link2, ListFilter, Plus, Repeat2, Search, Settings2, TrainFront, X, Files, Sun, Moon, Archive, House, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { addDays, bookingDay, bookingInstant, calendarFile, daysBetween,effectiveReminders, EMPTY_PLANNER, reconcileJourneyLifecycle, extendRoutines, findBreaks, formatDay, holidaySchema, isDay, migratePlanner, parseHolidayCSV, plannerSchema, saveLinkedRule, saveRule, todayIST, weekday, recurrenceLabel, transitionJourney, type Journey, type Planner, type Rule } from "@/lib/travel-planner";
import { Field, JourneyForm, Modal, RuleForm, STATUS } from "./forms";
import { Select } from "./select";
import { ActionMenu } from "./action-menu";
import s from "./planner.module.css";
import { TicketViewer } from "./ticket-viewer";
import { Dashboard } from "./dashboard";
import { Toast } from "./toast";
import { apiRequest } from "@/lib/client-api";
import type { AccountWorkspace } from "./account-app";
import { Connections } from "./connections";
import { decodeBackupFiles, deleteTicketFile, downloadTicketFile, exportTicketBackup, getTicketFile, saveTicketFile } from "@/lib/ticket-files";

const NAV = [{ id: "home", label: "Dashboard", short: "Home", icon: House }, { id: "journeys", label: "My Journeys", short: "Journeys", icon: LayoutGrid }, { id: "calendar", label: "Calendar", short: "Calendar", icon: CalendarDays }, { id: "routines", label: "Routines", short: "Routines", icon: Repeat2 }, { id: "holidays", label: "Holidays & Leave", short: "Time off", icon: CalendarDays }, { id: "vault", label: "Ticket Vault", short: "Tickets", icon: Files }, { id: "settings", label: "Admin Settings", short: "Admin", icon: Settings2 }] as const;
type Tab = typeof NAV[number]["id"]|"users"|"integrations";
const PATHS:Record<Tab,string>={home:"/",journeys:"/journeys",calendar:"/calendar",routines:"/routines",holidays:"/holidays",vault:"/tickets",settings:"/admin",users:"/admin/users",integrations:"/admin/integrations"};
type Editor = { type: "journey"; journey?: Journey; date?: string; ticket?: boolean } | { type: "rule"; rule?: Partial<Rule> } | { type: "day"; date: string } | { type: "holiday" } | { type: "import" } | null;
const COLUMNS = [{ id: "needs_booking", title: "To Book", tone: "blue", hint: "Plans waiting for a ticket" }, { id: "booked", title: "Booked", tone: "green", hint: "Your tickets, all together" }, { id: "cancellation_needed", title: "To Cancel", tone: "amber", hint: "Cancel in IRCTC, then update here" }, { id: "cancelled", title: "Cancelled", tone: "gray", hint: "Kept here for seven days, then archived" }];
/** Parses and migrates the serialized workspace while reporting invalid stored data. */
function read(raw: string | null) { if (!raw || raw === "unavailable") return { planner: EMPTY_PLANNER, invalid: raw === "unavailable" }; try { return { planner: migratePlanner(JSON.parse(raw)), invalid: false }; } catch { return { planner: EMPTY_PLANNER, invalid: true }; } }
/** Downloads generated calendar or backup content through a temporary object URL. */
function download(name: string, value: string, type: string) { const url = URL.createObjectURL(new Blob([value], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
/** Creates a compact stable display code from a journey identifier. */
function shortId(value: string) { let hash = 0; for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return hash.toString(36).slice(-5).toUpperCase().padStart(5, "0"); }

/** Coordinates routed workspace views, optimistic saves, item dialogs, and account-scoped actions. */
export function TravelPlanner({ account }: { account: AccountWorkspace & UserProfile }) {
  const router=useRouter(),pathname=usePathname();const policy=account.policy;
  const tab=(Object.keys(PATHS) as Tab[]).find(key=>PATHS[key]===pathname)??"home";
  const setTab=(tab:Tab)=>router.push(PATHS[tab]);
  const navItems=NAV.filter(n=>n.id!=="settings"||account.role==="ADMIN");
  const activeNav=tab==="users"||tab==="integrations"?"settings":tab;
  const saveLock=useRef(false); const [displayName,setDisplayName]=useState(account.name);
  const [remote,setRemote]=useState(JSON.stringify(account.planner)); const [revision,setRevision]=useState(account.revision); const [saving,setSaving]=useState(false);
  const raw=remote;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { const tick = () => setNow(new Date()); const timer = setInterval(tick, 30000); const initial = setTimeout(tick, 0); return () => { clearInterval(timer); clearTimeout(initial); }; }, []);
  const today = now ? todayIST(now) : "";
  const loaded = useMemo(() => read(raw), [raw]);
  const planner = useMemo(() => today && !loaded.invalid ? reconcileJourneyLifecycle(extendRoutines(loaded.planner, today),today) : loaded.planner, [loaded, today]);
  const [editor, setEditor] = useState<Editor>(null);
  const [viewTicket,setViewTicket]=useState<import("@/lib/travel-planner").TicketAttachment>();
  const [journeyView, setJourneyView] = useState("board"); const [undo, setUndo] = useState<{ id: string; status: Journey["status"]; next: Journey["status"] } | null>(null);
  const [invalidDismissed,setInvalidDismissed]=useState(false);
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const [search, setSearch] = useState(""); const [routineFilter, setRoutineFilter] = useState(""); const [range, setRange] = useState("upcoming");
  const [sort, setSort] = useState("travel"); const [showFilters, setShowFilters] = useState(false); const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState("");
  const [dragged, setDragged] = useState<string | null>(null); const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [month, setMonth] = useState(""); const [day, setDay] = useState("");
  const [calendarLayers, setCalendarLayers] = useState({ journeys: true, bookings: true, holidays: true });
  const sorted = [...planner.journeys].sort((a, b) => (sort === "booking" ? bookingDay(a).localeCompare(bookingDay(b)) : a.date.localeCompare(b.date)) || a.from.localeCompare(b.from));
  const filtered = sorted.filter(j => (journeyView === "archive" ? Boolean(j.archivedAt) : !j.archivedAt && (journeyView === "completed" ? j.status === "completed" : j.status !== "completed")) && (range === "all" || (range === "past" ? j.date < today : j.date >= today || (journeyView === "board" && ["cancelled","skipped"].includes(j.status)))) && (!routineFilter || j.ruleId === routineFilter) && (!dateFrom || j.date >= dateFrom) && (!dateTo || j.date <= dateTo) && `${j.from} ${j.to} ${j.trainName} ${j.trainNumber} ${j.pnr} ${j.notes}`.toLowerCase().includes(search.toLowerCase()));
  const ready = sorted.filter(j => !j.archivedAt && j.date >= today && j.status === "needs_booking" && now && bookingInstant(j) <= now).length;
  const breaks = today ? findBreaks(planner, today) : [];
  const currentMonth = month || today.slice(0, 7);
  const firstDay = currentMonth ? `${currentMonth}-01` : "";
  const gridStart = firstDay ? addDays(firstDay, -((weekday(firstDay) - planner.settings.weekStartsOn + 7) % 7)) : "";
  const activeDay = day || today;
  const dayEvents = editor?.type === "day" ? eventsFor(editor.date) : {journeys:[],bookings:[],holidays:[]};
  const ruleName = (j: Journey) => planner.rules.find(r => r.id === j.ruleId)?.name;
    /** Saves edits with the current concurrency revision and preserves unsaved work on conflicts. */
  async function commit(next: Planner, message: string, restore = false) {
    if (saveLock.current) return false;
    if (loaded.invalid && !restore) { setError("Restore a valid backup before editing. Your unreadable saved data has been preserved."); return false; }
    const previous=remote; saveLock.current=true;
    try {
      const data=plannerSchema.parse(next);
      {setSaving(true);setRemote(JSON.stringify(data));const saved=await apiRequest<AccountWorkspace>("/api/railwatch/workspace",{method:"PUT",body:JSON.stringify({planner:data,revision,base:restore?undefined:loaded.planner})});setRemote(JSON.stringify(saved.planner));setRevision(saved.revision);}
      setNotice(message);setUndo(null);setError("");return true;
    }catch(e){setRemote(previous);setError(e instanceof Error ? e.message : "Could not save your changes.");return false;}finally{saveLock.current=false;setSaving(false);}
  }
    /** Opens the selected item editor and clears stale feedback. */
  function open(next: Editor) { setError(""); setEditor(next); }
    /** Closes the active editor and clears its transient feedback. */
  function close() { if(saving)return; setEditor(null); setError(""); }
    /** Persists the edited journey while retaining the other account travel plans. */
  function update(j: Journey) { return commit({ ...planner, journeys: planner.journeys.map(old => old.id === j.id ? j : old) }, "Journey updated."); }
    /** Changes a journey board status and records an undo opportunity. */
  async function move(id: string, column: string) {
    const j = planner.journeys.find(j => j.id === id); if (!j || j.status === column) return;
    setDragged(null); setDropTarget(null);
    const status = column as Journey["status"];
    if (await update(transitionJourney(j, status))) { setUndo({ id, status: j.status, next: status }); setNotice(`Moved to ${STATUS[status].toLowerCase()}.`); }
  }
    /** Reverts the last supported board status change. */
  function undoMove() {
    if (!undo) return; const journey = planner.journeys.find(j => j.id === undo.id);
    if (journey?.status === undo.next) update(transitionJourney(journey, undo.status));
  }
    /** Archives or restores a journey without deleting its record or entered ticket details. */
  function archiveJourney(j: Journey) { update({ ...j, archivedAt: j.archivedAt ? undefined : today, cancelledAt:j.archivedAt && ["cancelled","skipped"].includes(j.status)?today:j.cancelledAt }); }
    /** Exports the account planner and available original ticket files. */
  async function backup() {
    try { download("railwatch-backup.json", loaded.invalid && raw ? raw : await exportTicketBackup(planner), "application/json"); setNotice("Workspace backup downloaded, including available ticket files."); }
    catch (e) { setError(e instanceof Error ? e.message : "Backup failed."); }
  }
    /** Validates and persists routine changes while keeping booked occurrences. */
  async function saveRoutine(rule: Rule) {
    try { if (await commit(saveLinkedRule(planner, rule, today), "Routine saved. Future journeys are ready.")) close(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save this routine."); }
  }
    /** Removes a routine while retaining its existing tickets and individual records. */
  function removeRoutine(rule: Rule) {
    if (!confirm(`Remove ${rule.name} and its unbooked generated journeys? Booked tickets and individual exceptions will stay.`)) return;
    commit({ ...planner, rules: planner.rules.filter(r => r.id !== rule.id).map(r => r.linkedRuleId === rule.id ? { ...r, linkedRuleId: undefined } : r), journeys: planner.journeys.filter(j => j.ruleId !== rule.id || j.status !== "needs_booking" || j.manualOverride || j.date < today) }, "Routine removed. Tickets and exceptions preserved.");
  }
    /** Validates and saves a time-off entry. */
  async function addHoliday(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); const start = String(form.get("date")); const end = String(form.get("end") || start);
    const h = holidaySchema.safeParse({ id: crypto.randomUUID(), name: form.get("name"), date: start, type: form.get("type") });
    if (!h.success || !isDay(end) || end < start || daysBetween(start, end) > 366) { setError("Choose a name and valid dates, no more than a year apart."); return; }
    const holidays = [...planner.holidays];
    for (let date = start; date <= end; date = addDays(date, 1)) if (!holidays.some(x => x.date === date && x.name.toLowerCase() === h.data.name.toLowerCase())) holidays.push({ ...h.data, id: crypto.randomUUID(), date });
    if (await commit({ ...planner, holidays }, "Time off added to your calendar.")) close();
  }
    /** Parses a holiday import and adds validated entries to the current account. */
  async function importHolidays(text: string) {
    try { const holidays = [...planner.holidays]; const parsed = parseHolidayCSV(text);
      for (const h of parsed) if (!holidays.some(x => x.date === h.date && x.name.toLowerCase() === h.name.toLowerCase())) holidays.push({ ...h, id: crypto.randomUUID() });
      if (await commit({ ...planner, holidays }, `${holidays.length - planner.holidays.length} holidays imported.`)) close();
    } catch (e) { setError(e instanceof Error ? e.message : "Check the CSV file."); }
  }
    /** Validates a backup, restores its files, and saves the account workspace. */
  async function restore(file?: File) {
    if (!file) return; if (file.size > 80000000) { setError("Choose a backup smaller than 80 MB."); return; }
    const previous: { id: string; blob?: Blob }[] = [];
    try {
      const value = JSON.parse(await file.text()); const next = migratePlanner(value); const files = decodeBackupFiles(value, next);
      if (!confirm("Replace this browser’s plans with this backup?")) return;
      for (const file of files) { previous.push({ id: file.id, blob: await getTicketFile(file.id) }); await saveTicketFile(file.id, file.blob, next.journeys.flatMap(j=>j.attachments??[]).find(f=>f.id===file.id)?.name); }
      if (!await commit(next, "Backup restored, including its ticket files.", true)) throw new Error("Could not save restored plans.");
    } catch (e) {
      await Promise.all(previous.map(f => (f.blob ? saveTicketFile(f.id, f.blob) : deleteTicketFile(f.id)).catch(() => undefined)));
      setError(e instanceof Error ? e.message : "That file is not a valid RailWatch backup.");
    }
  }
    /** Reloads account workspace and policy after administrator changes. */
  async function refreshWorkspace(){const saved=await apiRequest<AccountWorkspace>("/api/railwatch/workspace",{cache:"no-store"});setRemote(JSON.stringify(saved.planner));setRevision(saved.revision);router.refresh();}
    /** Returns travel, booking, and time-off events for the selected calendar day. */
  function eventsFor(date: string) {
    const journeys = calendarLayers.journeys ? sorted.filter(j => j.date === date && !j.archivedAt && !["skipped", "cancelled", "completed"].includes(j.status)) : [];
    const bookings = calendarLayers.bookings ? sorted.filter(j => bookingDay(j) === date && !j.archivedAt && j.status === "needs_booking") : [];
    const holidays = calendarLayers.holidays ? planner.holidays.filter(h => h.date === date) : [];
    return { journeys, bookings, holidays };
  }
    /** Moves the calendar to the previous or next month. */
  function shiftMonth(offset: number) { const d = new Date(`${firstDay}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + offset); setMonth(d.toISOString().slice(0, 7)); }
    /** Selects a calendar day and opens its event view. */
  function chooseDay(date: string) { setDay(date); setMonth(date.slice(0, 7)); }
    /** Renders a journey board or history card with current ticket and reminder state. */
  function card(j: Journey) {
    const reminders = effectiveReminders(planner, j);
    const isOpen = j.status === "needs_booking" && now && bookingInstant(j) <= now;
    return <article key={j.id} className={`${s.card} ${dragged === j.id ? s.dragging : ""}`} draggable tabIndex={0} onClick={e => { if (!(e.target as HTMLElement).closest("button")) open({ type: "journey", journey: j }); }} onKeyDown={e => { if (e.target === e.currentTarget && ["Enter", " "].includes(e.key)) { e.preventDefault(); open({ type: "journey", journey: j }); } }} onDragStart={e => { e.dataTransfer.setData("text/plain", j.id); e.dataTransfer.effectAllowed = "move"; setDragged(j.id); }} onDragEnd={() => { setDragged(null); setDropTarget(null); }} aria-label={`${j.from} to ${j.to}, ${formatDay(j.date)}`}>
      <div className={s.cardTop}><span className={s.ticketId}>TR-{shortId(j.id)}</span><GripVertical size={15} aria-hidden="true" /></div>
      <button className={s.cardOpen} onClick={() => open({ type: "journey", journey: j })} aria-label={`Open journey ${j.from} to ${j.to}`}><h3>{j.from}<ArrowRight size={15} />{j.to}</h3><p><CalendarDays size={13} />{formatDay(j.date, { day: "numeric", month: "short", year: "numeric" })}{j.departureConfirmed && <><span>·</span>{j.departure}</>}</p></button>
      <div className={`${s.bookingStrip} ${isOpen ? s.bookingUrgent : ""}`}>{j.status === "needs_booking" ? <><span>{isOpen ? "Booking window open" : "Estimated booking"}</span><b>{formatDay(bookingDay(j))} · 8 AM</b></> : <><span>{STATUS[j.status]}</span><b>{[j.trainNumber, j.trainName || j.train].filter(Boolean).join(" · ") || (j.pnr ? `PNR ${j.pnr}` : "")}</b></>}</div>
      {j.notes && <p className={s.cardNotes}>{j.notes}</p>}
      <footer className={s.cardFooter}><span>{j.ruleId ? <Repeat2 size={12} /> : <TrainFront size={12} />}{ruleName(j) || "One-off journey"}</span><span aria-label={j.status === "needs_booking" && reminders.times.length ? "Reminders enabled" : "Reminders off"}><Bell size={13} />{j.status === "needs_booking" && reminders.times.length ? "On" : "Off"}</span></footer>
      <div className={s.cardActions}>{Boolean(j.attachments?.length) && <span><Files size={13} />{j.attachments!.length} files</span>}{(j.archivedAt || ["completed", "cancelled", "skipped"].includes(j.status)) && <button className={s.textButton} onClick={() => archiveJourney(j)}><Archive size={13} />{j.archivedAt ? "Restore" : "Archive"}</button>}</div>
    </article>;
  }
  if (!now || raw === null) return <div className={s.loading}><TrainFront /><span>Loading your travel space…</span></div>;
  return <div className={s.app} data-theme={planner.settings.theme} data-sidebar={planner.settings.sidebarCollapsed ? "collapsed" : "expanded"}>
    {viewTicket&&<TicketViewer file={viewTicket} close={()=>setViewTicket(undefined)}/>}
    <aside className={s.sidebar} inert={saving}><div className={s.brandRow}><button className={s.brand} onClick={() => setTab("home")} aria-label="RailWatch Dashboard"><span><RailWatchMark size={30} /></span><b>RailWatch</b></button><button className={`${s.iconButton} ${s.sidebarToggle}`} aria-label={planner.settings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!planner.settings.sidebarCollapsed} aria-controls="planner-navigation" onClick={() => commit({ ...planner, settings: { ...planner.settings, sidebarCollapsed: !planner.settings.sidebarCollapsed } }, "")}>{planner.settings.sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button></div><nav id="planner-navigation" aria-label="Planner Navigation">{navItems.map(n => <Link href={PATHS[n.id]} key={n.id} aria-label={n.label} title={n.label} aria-current={activeNav === n.id ? "page" : undefined} className={activeNav === n.id ? s.navActive : s.navItem} onClick={() => setError("")}><n.icon size={18} /><span data-short={n.short}>{n.label}</span>{n.id === "journeys" && ready > 0 && <b>{ready}</b>}</Link>)}</nav></aside>
    <div className={s.main}><header className={s.topbar}><span><span className={s.breadcrumbLabel}>Workspace</span> <ChevronRight size={13} /><b>{navItems.find(n => n.id === activeNav)?.label}</b></span><div><span>{saving ? "Saving…" : formatDay(today, { day: "numeric", month: "short", year: "numeric" })}{!saving && " · IST"}</span><button className={s.iconButton} aria-label="Toggle Color Theme" onClick={() => commit({ ...planner, settings: { ...planner.settings, theme: planner.settings.theme === "light" ? "dark" : "light" } }, "Color theme updated.")}>{planner.settings.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>{policy.remindersEnabled && <Connections policy={policy} planner={planner} revision={revision} commit={commit} fail={setError} notice={setNotice} settings={false} open={id => { const journey=planner.journeys.find(j=>j.id===id); if(journey)open({type:"journey",journey}); }} />}<Profile account={{...account,name:displayName}} planner={planner} onProfile={async user=>{setDisplayName(user.name);await refreshWorkspace();}} commit={commit} notice={setNotice} fail={setError} backup={()=>void backup()} restore={file=>void restore(file)} exportCalendar={()=>{download("railwatch.ics",calendarFile(planner),"text/calendar;charset=utf-8");setNotice("Calendar exported.");}}/></div></header><main className={s.content} inert={saving}>
      <div className={s.pageHead}><div><h1>{({ home: `Hello, ${displayName.trim().split(/\s+/)[0]}`, journeys: "My Journeys", calendar: "Your Travel Calendar", routines: "Travel Routines", holidays: "Holidays & Leave", vault: "Ticket Vault", settings: "Admin Settings",users:"Admin Settings",integrations:"Admin Settings" })[tab]}</h1><p>{({ home: "A clear view of what’s next and what needs your attention.", journeys: "Plan journeys, track tickets, and manage your travel.", calendar: "Journeys, booking dates, and time off in one calendar.", routines: "Create repeat journeys on a schedule that works for you.", holidays: "Your company holidays and personal time off.", vault: "Your original tickets, linked to every journey.", settings: "Common rules and feature availability for every account.",users:"Manage the accounts that use this RailWatch instance.",integrations:"Configure Telegram, Google Calendar, and WhatsApp for your users." })[tab]}</p></div>{tab !== "settings" && tab !== "users" && tab !== "integrations" && <button className={s.primary} onClick={() => open(tab === "routines" ? { type: "rule" } : tab === "holidays" ? { type: "holiday" } : { type: "journey" })}><Plus size={17} />{tab === "routines" ? "New Routine" : tab === "holidays" ? "Add Time Off" : "New Journey"}</button>}</div>

      {loaded.invalid && !invalidDismissed && <Toast error message="Saved data could not be read. Restore a valid backup in User Settings; your data has been preserved." dismiss={()=>setInvalidDismissed(true)}/>}
      {notice && !error && <Toast key={`${raw}-${notice}`} message={notice} dismiss={() => { setNotice(""); setUndo(null); }} undo={undo ? undoMove : undefined} />}
      {error && <Toast key={error} error message={error} dismiss={() => setError("")} />}
      {tab === "home" && <Dashboard planner={planner} today={today} now={now} openJourney={journey => open({ type: "journey", journey })} createJourney={() => open({ type: "journey" })} chooseDate={date => { chooseDay(date); setTab("calendar"); }} go={(target, status) => { setTab(target); if (target === "journeys") { setJourneyView(status === "completed" ? "completed" : "board"); setRange(status === "completed" ? "all" : "upcoming"); setSearch(""); setRoutineFilter(""); setDateFrom(""); setDateTo(""); } }} />}
      {tab === "journeys" && <>
        <div className={s.viewTabs}>{[["board", "Board"], ["completed", "History"], ["archive", "Archive"]].map(([id, label]) => <button key={id} className={journeyView === id ? s.selected : ""} aria-pressed={journeyView === id} onClick={() => { setJourneyView(id); setRange(id === "board" ? "upcoming" : "all"); }}>{label}<b>{id === "archive" ? sorted.filter(j => j.archivedAt).length : id === "completed" ? sorted.filter(j => j.status === "completed" && !j.archivedAt).length : sorted.filter(j => !j.archivedAt && j.status !== "completed").length}</b></button>)}</div><div className={s.toolbar}><label className={s.search}><Search size={16} /><input aria-label="Search Journeys" placeholder="Search journeys…" value={search} onChange={e => setSearch(e.target.value)} /></label><button className={`${s.secondary} ${showFilters ? s.selected : ""}`} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><ListFilter size={15} />Filters{(routineFilter||dateFrom||dateTo||range!==(journeyView==="board"?"upcoming":"all"))&&<span className={s.count}>Active</span>}</button><div className={s.sortControl}><span>Sort:</span><Select aria-label="Sort Journeys" value={sort} onChange={e => setSort(e.target.value)}><option value="travel">Travel date</option><option value="booking">Booking date</option></Select></div></div>
        {showFilters && <div className={s.filterPanel}><Field label="Routine"><Select aria-label="Routine Filter" value={routineFilter} onChange={e => setRoutineFilter(e.target.value)}><option value="">All routines</option>{planner.rules.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</Select></Field><Field label="Journey Period"><Select aria-label="Journey Period" value={range} onChange={e => setRange(e.target.value)}><option value="upcoming">Upcoming</option><option value="past">Past journeys</option><option value="all">All dates</option></Select></Field><Field label="Travel From"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></Field><Field label="Travel Through"><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></Field><button className={s.textButton} onClick={() => { setDateFrom(""); setDateTo(""); setSearch(""); setRoutineFilter(""); setRange(journeyView==="board"?"upcoming":"all"); }}>Clear Filters</button></div>}
        {journeyView !== "board" ? <div className={s.historyGrid}>{filtered.map(card)}{!filtered.length && <section className={s.emptyPage}><Archive size={28} /><h2>{journeyView === "archive" ? "Your archive is empty" : "No completed journeys yet"}</h2><p>{journeyView === "archive" ? "Cancelled journeys move here after seven days. Their details and tickets stay available." : "Booked journeys move here automatically after their travel date in IST."}</p></section>}</div> : <div className={s.board} aria-label="Journey Board">{COLUMNS.map(column => { const items = filtered.filter(j => column.id === "cancelled" ? ["skipped", "cancelled"].includes(j.status) : j.status === column.id); return <section key={column.id} className={`${s.column} ${dropTarget === column.id ? s.dropTarget : ""}`} aria-label={`${column.title} column`} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(column.id); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }} onDrop={e => { e.preventDefault(); move(e.dataTransfer.getData("text/plain"), column.id); }}><header className={s.columnHead}><span className={`${s.dot} ${s[column.tone]}`} /><h2>{column.title}</h2><b>{items.length}</b>{column.id === "needs_booking" && <button onClick={() => open({ type: "journey" })} aria-label="Add Planned Journey"><Plus size={17} /></button>}</header><div className={s.columnBody}>{items.map(card)}{!items.length && <div className={s.columnEmpty}><span>{column.hint}</span>{column.id === "needs_booking" && <button onClick={() => open({ type: "journey" })}><Plus size={14} />Add a journey</button>}</div>}</div></section>; })}</div>}<p className={s.boardHint}>Drag cards to update progress. Click a card to edit details or change status on mobile. Moving a card saves immediately and keeps all details. Booked journeys complete automatically after their travel date in IST. Cancelled journeys are archived after seven days, keeping their tickets.</p>
      </>}
      {tab === "calendar" && <><div className={s.calendarToolbar}><div><button className={s.iconButton} aria-label="Previous Month" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button><h2>{formatDay(firstDay, { month: "long", year: "numeric" })}</h2><button className={s.iconButton} aria-label="Next Month" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button><button className={s.secondary} onClick={() => { setMonth(today.slice(0, 7)); setDay(today); }}>Today</button></div><div className={s.calendarLegend}>{Object.entries(calendarLayers).map(([key, enabled]) => <label key={key}><input type="checkbox" checked={enabled} onChange={e => setCalendarLayers({ ...calendarLayers, [key]: e.target.checked })} /><span className={`${s.dot} ${key === "journeys" ? s.green : key === "bookings" ? s.blue : s.purple}`} />{key === "bookings" ? "Booking dates" : key === "holidays" ? "Time off" : "Journeys"}</label>)}</div></div><section className={s.calendar}><div className={s.calendarWeek}>{Array.from({length:7},(_,i)=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][(i+planner.settings.weekStartsOn)%7]).map(d => <span key={d}>{d}</span>)}</div><div className={s.calendarGrid}>{Array.from({ length: 42 }, (_, i) => { const date = addDays(gridStart, i); const events = eventsFor(date); const total = events.journeys.length + events.bookings.length + events.holidays.length; const shown = Math.min(events.journeys.length, 1) + Math.min(events.bookings.length, 1) + Math.min(events.holidays.length, 1); return <div key={date} className={`${s.calendarCell} ${date.slice(0, 7) !== currentMonth ? s.otherMonth : ""} ${date === activeDay ? s.selectedDay : ""}`}><button className={`${s.dateButton} ${date === today ? s.todayDate : ""}`} aria-label={`View ${date}`} onClick={() => {chooseDay(date);open({type:"day",date});}}>{Number(date.slice(-2))}</button><div className={s.cellEvents}>{events.holidays.slice(0, 1).map(h => <button className={s.holidayEvent} key={h.id} onClick={() => {chooseDay(date);open({type:"day",date});}}>{h.name}</button>)}{events.bookings.slice(0, 1).map(j => <button className={s.bookingEvent} key={j.id} onClick={() => open({ type: "journey", journey: j })}>Book: {j.from} → {j.to}</button>)}{events.journeys.slice(0, 1).map(j => <button className={s.journeyEvent} key={j.id} onClick={() => open({ type: "journey", journey: j })}>{j.from} → {j.to}</button>)}{total > shown && <button className={s.moreEvents} onClick={() => {chooseDay(date);open({type:"day",date});}}>+{total - shown} more</button>}</div>{total > 0 && <span className={s.mobileEvents}>{events.journeys.length > 0 && <i className={s.green} />}{events.bookings.length > 0 && <i className={s.blue} />}{events.holidays.length > 0 && <i className={s.purple} />}</span>}</div>; })}</div></section></>}
      {tab === "routines" && <><div className={s.routineGrid}>{planner.rules.map(r => { const linked = planner.rules.find(other => other.id === r.linkedRuleId); return <article className={s.routineCard} key={r.id}><div className={s.routineTop}><span className={s.routineIcon}><Repeat2 size={20} /></span><span className={`${s.badge} ${r.paused ? s.badgeGray : s.badgeGreen}`}>{r.paused ? "Paused" : r.end ? "Scheduled" : "Ongoing"}</span></div><h2>{r.name}</h2><p className={s.routineRoute}>{r.from}<ArrowRight size={15} />{r.to}</p><p>{recurrenceLabel(r)}</p><small>From {formatDay(r.start)}{r.end ? ` until ${formatDay(r.end)}` : " · No end date"}</small><div className={s.linkedRoutine}>{linked ? <><Link2 size={14} /><span>Linked with <b>{linked.name}</b></span></> : <button className={s.textButton} onClick={() => open({ type: "rule", rule: { name: `${r.name} · return`, from: r.to, to: r.from, linkedRuleId: r.id, start: r.start > today ? r.start : today, end: r.end, intervalWeeks: r.intervalWeeks, recurrence: r.recurrence } })}><Plus size={14} />Create linked return</button>}</div><footer className={s.routineFooter}><button className={s.secondary} onClick={() => open({ type: "rule", rule: r })}>Edit Routine</button><ActionMenu label={`Actions For ${r.name}`} actions={[{label:r.paused?"Resume Routine":"Pause Routine",onClick:()=>{if(r.paused||confirm("Pause this routine? Future unbooked generated journeys will be removed. Booked tickets and individual changes stay."))commit(saveRule(planner,{...r,paused:!r.paused},today),r.paused?"Routine resumed.":"Routine paused.");}},{label:"Remove Routine",danger:true,onClick:()=>removeRoutine(r)}]}/></footer></article>; })}</div>{!planner.rules.length && <section className={s.emptyPage}><Repeat2 size={32} /><h2>Travel Often? Start A Routine.</h2><p>Choose your route, weekdays and rhythm. Leave the end date empty to keep going. Create another routine for your return and link the two.</p><button className={s.primary} onClick={() => open({ type: "rule" })}><Plus size={16} />Create a routine</button></section>}<p className={s.help}>Booked tickets and individual changes are kept when you edit a routine. {planner.settings.routineHorizonMode === "count" ? `Ongoing routines keep up to ${planner.settings.routineTicketCount} upcoming journeys per routine.` : `Ongoing routines plan ${planner.settings.routineMonthsAhead} months ahead from today.`} New journeys are added automatically.</p></>}
      {tab === "holidays" && <><div className={s.sectionHead}><span>{planner.holidays.length} days on your calendar</span><button className={s.secondary} onClick={() => open({ type: "import" })}><ArrowDownToLine size={15} />Import holidays</button></div><div className={s.holidayLayout}><section><section className={s.holidayTable}>{[...planner.holidays].sort((a, b) => a.date.localeCompare(b.date)).map(h => <div className={s.holidayRow} key={h.id}><span className={s.holidayDate}><b>{formatDay(h.date, { day: "2-digit" })}</b>{formatDay(h.date, { month: "short" })}</span><div><b>{h.name}</b><p>{formatDay(h.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div><span className={`${s.badge} ${h.type === "company" ? s.badgeBlue : s.badgePurple}`}>{h.type === "company" ? "Company" : "Personal"}</span><button className={s.iconButton} aria-label={`Remove ${h.name}`} onClick={() => { if (confirm(`Remove ${h.name} from your time off?`)) commit({ ...planner, holidays: planner.holidays.filter(x => x.id !== h.id) }, "Time off removed."); }}><X size={16} /></button></div>)}</section>{!planner.holidays.length && <section className={s.emptyPage}><CalendarDays size={32} /><h2>Bring Your Time Off Into View.</h2><p>Add company holidays or personal leave. Your long weekends will appear automatically, with the normal booking date for the first day.</p></section>}</section><aside className={s.holidayOpportunities}><h2 className={s.subheading}>Long Weekends Worth A Trip</h2><div className={s.routineGrid}>{breaks.map(b => <article className={s.opportunity} key={b.start}><span className={`${s.badge} ${s.badgePurple}`}>{b.days} days off</span><h3>{b.names.join(" + ")}</h3><p>{formatDay(b.start)} — {formatDay(b.end)}</p><small>{b.bookingAlreadyOpen ? "Standard booking windows are already open." : `Booking for the first day: ${formatDay(b.planBy)} · 8 AM`}</small><button className={s.textButton} onClick={() => open({ type: "journey", date: b.start })}>Plan a journey <ArrowRight size={14} /></button></article>)}</div></aside></div></>}
      {tab === "vault" && <div className={s.vaultGrid}>{sorted.flatMap(j => (j.attachments ?? []).map(file => <article className={s.vaultCard} key={file.id}><div className={s.vaultIcon}><Files size={24} /><span>{file.type === "application/pdf" ? "PDF" : "QR image"}</span></div><h2>{file.name}</h2><p>{j.from} → {j.to}</p><small>{formatDay(j.date, { day: "numeric", month: "short", year: "numeric" })} · {STATUS[j.status]}{j.archivedAt ? " · Archived" : ""}</small><small>{(file.size / 1024).toFixed(0)} KB · Encrypted Account Storage</small><div className={s.cardActions}><button className={s.primary} onClick={()=>setViewTicket(file)}>View Ticket</button><ActionMenu label={"Actions For "+file.name} actions={[{label:"Download Ticket",onClick:()=>void downloadTicketFile(file).catch(e=>setError(e.message))},{label:"Open Journey",onClick:()=>open({type:"journey",journey:j})}]}/></div></article>))}{!sorted.some(j => j.attachments?.length) && <section className={s.emptyPage}><Files size={32} /><h2>A Home For Your Tickets</h2><p>Open a booked journey to upload a PDF or QR image. Ticket files are deleted seven days after cancellation or completion. Journey history and entered ticket details are retained. Backups follow their own retention policy.</p></section>}</div>}
      {(tab === "settings" || tab === "users" || tab === "integrations") && account.role==="ADMIN" && <AdminPanel view={tab==="users"?"users":tab==="integrations"?"integrations":"settings"} currentUserId={account.id} notice={setNotice} refresh={refreshWorkspace}/>}
    </main></div>
    {editor && <Modal title={editor.type === "journey" ? editor.ticket ? "Record Booked Ticket" : editor.journey ? `${editor.journey.from} → ${editor.journey.to}` : "New Journey" : editor.type === "rule" ? editor.rule?.id ? "Edit Routine" : "New Routine" : editor.type === "day" ? formatDay(editor.date,{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : editor.type === "holiday" ? "Add Time Off" : "Import Company Holidays"} subtitle={editor.type === "journey" && editor.journey ? `${formatDay(editor.journey.date)} · ${ruleName(editor.journey) || "One-off journey"}` : undefined} close={close} wide={editor.type === "journey"}>
      <div inert={saving}>
      {editor.type === "journey" && <JourneyForm remindersEnabled={policy.remindersEnabled} uploadsEnabled={policy.ticketUploadsEnabled} journey={editor.journey} date={editor.date} ticket={editor.ticket} planner={planner} today={today} fail={setError} save={async j => { const saved = await commit({ ...planner, journeys: [...planner.journeys.filter(old => old.id !== j.id), j] }, "Journey saved."); if (saved) close(); return saved; }} />}
      {editor.type === "rule" && <RuleForm remindersEnabled={policy.remindersEnabled} rule={editor.rule} planner={planner} today={today} fail={setError} save={saveRoutine} />}
      {editor.type === "day" && <div className={s.form}>{dayEvents.holidays.map(h=><p key={h.id}>{h.name}</p>)}{dayEvents.bookings.map(j=><button key={"b"+j.id} className={s.secondary} onClick={()=>open({type:"journey",journey:j})}>Booking: {j.from} → {j.to}</button>)}{dayEvents.journeys.map(j=><button key={j.id} className={s.secondary} onClick={()=>open({type:"journey",journey:j})}>{j.from} → {j.to} · {STATUS[j.status]}</button>)}<button className={s.primary} onClick={()=>open({type:"journey",date:editor.date})}>Plan Travel</button></div>}
      {editor.type === "holiday" && <form className={s.form} onSubmit={addHoliday}><Field label="Name"><input name="name" maxLength={100} placeholder="Holiday or personal plan" required /></Field><Field label="Type"><Select name="type"><option value="company">Company holiday</option><option value="leave">Personal leave / holiday</option></Select></Field><div className={s.formGrid}><Field label="Date"><input name="date" type="date" defaultValue={today} required /></Field><Field label="Through (Optional)"><input name="end" type="date" /></Field></div><button className={s.primary}>Add time off</button></form>}
      {editor.type === "import" && <form className={s.form} onSubmit={e => { e.preventDefault(); importHolidays(String(new FormData(e.currentTarget).get("csv"))); }}><p className={s.help}>CSV columns: date,name,type. Types: company or leave. Dates use YYYY-MM-DD.</p><pre className={s.csvExample}>date,name,type{"\n"}2027-01-01,New Year,company</pre><Field label="Choose CSV File"><input type="file" accept=".csv,text/csv" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 1000000) { setError("Choose a CSV smaller than 1 MB."); return; } try { importHolidays(await f.text()); } catch { setError("Could not read the CSV file."); } }} /></Field><Field label="Or Paste CSV"><textarea name="csv" rows={6} placeholder="date,name,type" required /></Field><button className={s.primary}>Import holidays</button></form>}
    </div></Modal>}
  </div>;
}

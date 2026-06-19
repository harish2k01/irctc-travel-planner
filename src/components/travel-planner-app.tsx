"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Columns3,
  FileText,
  Home,
  IndianRupee,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Save,
  Smartphone,
  Train,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDays, buildJourneyReminders, calculateBookingOpenDate, getBookingUrgency, isWithinNextDays } from "@/lib/dates";
import type { Holiday, Journey, JourneyStatus, Route, Train as TrainType } from "@/lib/types";
import { analytics, notificationPreferences } from "@/lib/seed-data";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Props = {
  initialJourneys: Journey[];
  routes: Route[];
  trains: TrainType[];
  holidays: Holiday[];
  today: string;
};

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutIcon },
  { id: "planner", label: "Planner", icon: Plus },
  { id: "tracker", label: "Tracker", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "holidays", label: "Holidays", icon: MapPin },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

const statusColumns: JourneyStatus[] = [
  "PLANNED",
  "BOOKING_WINDOW_OPEN",
  "BOOKED",
  "WAITLISTED",
  "RAC",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

const statusLabels: Record<JourneyStatus, string> = {
  PLANNED: "Planned",
  BOOKING_WINDOW_OPEN: "Window Open",
  BOOKED: "Booked",
  WAITLISTED: "Waitlisted",
  RAC: "RAC",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

const statusTone: Record<JourneyStatus, string> = {
  PLANNED: "border-slate-200 bg-slate-50 text-slate-700",
  BOOKING_WINDOW_OPEN: "border-red-200 bg-red-50 text-red-700",
  BOOKED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  WAITLISTED: "border-amber-200 bg-amber-50 text-amber-800",
  RAC: "border-sky-200 bg-sky-50 text-sky-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-zinc-200 bg-zinc-50 text-zinc-500",
  COMPLETED: "border-zinc-200 bg-zinc-50 text-zinc-500",
};

type TabId = (typeof tabs)[number]["id"];
type JourneyPatch = Partial<Omit<Journey, "id" | "bookingOpenDate">>;

function LayoutIcon(props: React.ComponentProps<typeof Home>) {
  return <Home {...props} />;
}

export function TravelPlannerApp({ initialJourneys, routes, trains, holidays, today }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [journeys, setJourneys] = useState(initialJourneys);

  const upcomingJourneys = useMemo(
    () => journeys.filter((journey) => isWithinNextDays(journey.travelDate, today, 30)),
    [journeys, today],
  );
  const currentMonthJourneys = useMemo(
    () => journeys.filter((journey) => isSameMonth(journey.travelDate, today)),
    [journeys, today],
  );
  const bookingSoon = useMemo(
    () => journeys.filter((journey) => isWithinNextDays(journey.bookingOpenDate, today, 7)),
    [journeys, today],
  );
  const pendingBookings = journeys.filter((journey) =>
    ["PLANNED", "BOOKING_WINDOW_OPEN", "WAITLISTED", "RAC"].includes(journey.status),
  );
  const confirmedBookings = journeys.filter((journey) => ["BOOKED", "CONFIRMED"].includes(journey.status));
  const monthlySpend = currentMonthJourneys.reduce((sum, journey) => sum + (journey.farePaid ?? 0), 0);
  const reminders = journeys.flatMap(buildJourneyReminders);

  const routeById = new Map(routes.map((route) => [route.id, route]));
  const trainById = new Map(trains.map((train) => [train.id, train]));

  async function createJourney(formData: FormData) {
    const travelDate = String(formData.get("travelDate"));
    const trainId = String(formData.get("trainId"));
    const train = trainById.get(trainId) ?? trains[0];
    const newJourney: Journey = {
      id: `local-${Date.now()}`,
      routeId: train.routeId,
      trainId,
      travelDate,
      bookingOpenDate: calculateBookingOpenDate(travelDate),
      preferredClass: String(formData.get("preferredClass")),
      direction: String(formData.get("direction")) as Journey["direction"],
      recurrence: String(formData.get("recurrence")) as Journey["recurrence"],
      status: "PLANNED",
      notes: String(formData.get("notes") ?? ""),
    };

    try {
      const response = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: newJourney.routeId,
          trainId: newJourney.trainId,
          travelDate: newJourney.travelDate,
          preferredClass: newJourney.preferredClass,
          direction: newJourney.direction,
          recurrence: newJourney.recurrence,
          notes: newJourney.notes,
        }),
      });
      const payload = await response.json();

      if (response.ok && payload.data?.id) {
        newJourney.id = payload.data.id;
      }
    } catch {
      // Keep the optimistic local journey if the preview API is unavailable.
    }

    setJourneys((current) => [newJourney, ...current]);
    setActiveTab("tracker");
  }

  async function updateJourney(id: string, patch: JourneyPatch) {
    const nextPatch: Partial<Journey> = {
      ...patch,
    };

    if (patch.travelDate) {
      nextPatch.bookingOpenDate = calculateBookingOpenDate(patch.travelDate);
    }

    setJourneys((current) =>
      current.map((journey) => (journey.id === id ? { ...journey, ...nextPatch } : journey)),
    );

    try {
      await fetch(`/api/journeys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // Local state remains editable in preview/offline mode.
    }
  }

  async function deleteJourney(id: string) {
    setJourneys((current) => current.filter((journey) => journey.id !== id));

    try {
      await fetch(`/api/journeys/${id}`, { method: "DELETE" });
    } catch {
      // Local state remains editable in preview/offline mode.
    }
  }

  const calendarEvents = [
    ...journeys.map((journey) => ({
      id: `${journey.id}-travel`,
      title: `${trainById.get(journey.trainId)?.trainNumber ?? journey.trainId} travel`,
      date: journey.travelDate,
      color: ["CONFIRMED", "BOOKED"].includes(journey.status) ? "#15803d" : "#334155",
    })),
    ...journeys.map((journey) => ({
      id: `${journey.id}-booking`,
      title: `Book ${trainById.get(journey.trainId)?.trainNumber ?? journey.trainId}`,
      date: journey.bookingOpenDate,
      color: getBookingUrgency(journey, today).tone === "red" ? "#dc2626" : "#d97706",
    })),
    ...reminders.map((reminder) => ({
      id: reminder.id,
      title: "Reminder",
      date: reminder.dueDate,
      color: "#2563eb",
    })),
    ...holidays.map((holiday) => ({
      id: holiday.id,
      title: holiday.name,
      date: holiday.date,
      color: holiday.type === "PERSONAL_LEAVE" ? "#7c3aed" : "#0f766e",
    })),
  ];

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white">
                <Train className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">IRCTC Travel Planner</p>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
                  Weekly office commute control center
                </h1>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-center text-sm sm:min-w-[360px]">
              <MiniMetric label="Next 30d" value={upcomingJourneys.length.toString()} />
              <MiniMetric label="Pending" value={pendingBookings.length.toString()} />
              <MiniMetric label="Spend" value={formatCurrency(monthlySpend)} />
            </div>
          </div>
          <nav aria-label="Primary">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950",
                      activeTab === tab.id
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === "dashboard" && (
          <Dashboard
            journeys={journeys}
            holidays={holidays}
            upcomingJourneys={upcomingJourneys}
            bookingSoon={bookingSoon}
            pendingBookings={pendingBookings}
            confirmedBookings={confirmedBookings}
            tripsThisMonth={currentMonthJourneys.length}
            monthlySpend={monthlySpend}
            routeById={routeById}
            trainById={trainById}
            today={today}
          />
        )}
        {activeTab === "planner" && (
          <Planner trains={trains} routeById={routeById} onCreateJourney={createJourney} />
        )}
        {activeTab === "tracker" && (
          <Tracker
            journeys={journeys}
            trains={trains}
            trainById={trainById}
            routeById={routeById}
            onUpdateJourney={updateJourney}
            onDeleteJourney={deleteJourney}
          />
        )}
        {activeTab === "calendar" && (
          <CalendarPanel events={calendarEvents} />
        )}
        {activeTab === "holidays" && (
          <HolidayPanel holidays={holidays} />
        )}
        {activeTab === "analytics" && (
          <AnalyticsPanel journeys={journeys} routeById={routeById} />
        )}
      </main>
    </div>
  );
}

function Dashboard({
  journeys,
  holidays,
  upcomingJourneys,
  bookingSoon,
  pendingBookings,
  confirmedBookings,
  tripsThisMonth,
  monthlySpend,
  routeById,
  trainById,
  today,
}: {
  journeys: Journey[];
  holidays: Holiday[];
  upcomingJourneys: Journey[];
  bookingSoon: Journey[];
  pendingBookings: Journey[];
  confirmedBookings: Journey[];
  tripsThisMonth: number;
  monthlySpend: number;
  routeById: Map<string, Route>;
  trainById: Map<string, TrainType>;
  today: string;
}) {
  const bookToday = journeys.filter((journey) => getBookingUrgency(journey, today).daysUntilOpen <= 0 && journey.status === "PLANNED");
  const opensTomorrow = journeys.filter((journey) => getBookingUrgency(journey, today).daysUntilOpen === 1);
  const waitlistRisk = journeys.filter((journey) => ["WAITLISTED", "RAC"].includes(journey.status));

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Dashboard summary">
        <MetricCard icon={AlertTriangle} label="Book Today" value={bookToday.length.toString()} tone="red" />
        <MetricCard icon={Clock} label="Booking Opens Tomorrow" value={opensTomorrow.length.toString()} tone="amber" />
        <MetricCard icon={AlertTriangle} label="Waitlist Risk" value={waitlistRisk.length.toString()} tone="amber" />
        <MetricCard icon={CalendarDays} label="Trips This Month" value={tripsThisMonth.toString()} tone="slate" />
        <MetricCard icon={IndianRupee} label="Travel Spend This Month" value={formatCurrency(monthlySpend)} tone="green" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Upcoming journeys" action="Next 30 days">
          <div className="grid gap-3">
            {upcomingJourneys.map((journey) => (
              <JourneyRow
                key={journey.id}
                journey={journey}
                route={routeById.get(journey.routeId)}
                train={trainById.get(journey.trainId)}
                today={today}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Booking windows" action={`${bookingSoon.length} soon`}>
          <div className="space-y-3">
            {bookingSoon.map((journey) => (
              <div key={journey.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{trainById.get(journey.trainId)?.trainNumber} {trainById.get(journey.trainId)?.trainName}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDate(journey.bookingOpenDate)} booking open</p>
                  </div>
                  <StatusPill journey={journey} today={today} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel title="Pending bookings" action={pendingBookings.length.toString()}>
          <CompactJourneyList journeys={pendingBookings} trainById={trainById} />
        </Panel>
        <Panel title="Confirmed bookings" action={confirmedBookings.length.toString()}>
          <CompactJourneyList journeys={confirmedBookings} trainById={trainById} />
        </Panel>
        <Panel title="Upcoming holidays" action="Long weekend watch">
          <div className="space-y-3">
            {holidays.slice(1, 5).map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{holiday.name}</p>
                  <p className="text-sm text-slate-600">{holiday.region ?? holiday.type.replace("_", " ")}</p>
                </div>
                <span className="text-sm font-medium text-slate-700">{formatDate(holiday.date)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function Planner({
  trains,
  routeById,
  onCreateJourney,
}: {
  trains: TrainType[];
  routeById: Map<string, Route>;
  onCreateJourney: (formData: FormData) => void;
}) {
  const [travelDate, setTravelDate] = useState("2026-08-21");
  const bookingOpenDate = calculateBookingOpenDate(travelDate);

  return (
    <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel title="Create journey" action="60-day booking window">
        <form action={onCreateJourney} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Preferred train
            <select name="trainId" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
              {trains.map((train) => {
                const route = routeById.get(train.routeId);
                return (
                  <option key={train.id} value={train.id}>
                    {train.trainNumber} {train.trainName} - {route?.originCode} to {route?.destinationCode}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Travel date
              <input
                name="travelDate"
                type="date"
                value={travelDate}
                onChange={(event) => setTravelDate(event.target.value)}
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Preferred class
              <select name="preferredClass" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                {["2A", "3A", "SL", "CC", "EC", "2S"].map((coachClass) => (
                  <option key={coachClass}>{coachClass}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Direction
              <select name="direction" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                <option value="HOME_TO_OFFICE">Home to Office</option>
                <option value="OFFICE_TO_HOME">Office to Home</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Recurrence
              <select name="recurrence" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                <option value="ONE_TIME">One-time</option>
                <option value="WEEKLY">Weekly</option>
                <option value="CUSTOM">Custom pattern</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Notes
            <textarea
              name="notes"
              rows={4}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950"
              placeholder="Seat preference, office day, reimbursement tag"
            />
          </label>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950">
            <Plus className="h-4 w-4" aria-hidden />
            Add journey
          </button>
        </form>
      </Panel>
      <Panel title="Generated reminders" action={formatDate(bookingOpenDate)}>
        <div className="grid gap-3">
          {[
            { label: "7 days before booking opens", date: addDays(bookingOpenDate, -7) },
            { label: "1 day before booking opens", date: addDays(bookingOpenDate, -1) },
            { label: "At booking open time", date: bookingOpenDate },
          ].map((reminder) => (
            <div key={reminder.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-blue-700" aria-hidden />
                <span className="text-sm font-medium text-slate-800">{reminder.label}</span>
              </div>
              <span className="text-sm font-semibold text-slate-950">{formatDate(reminder.date)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {notificationPreferences.map((preference) => (
            <div key={preference.channel} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
              {preference.channel === "EMAIL" ? <Mail className="h-4 w-4" /> : preference.channel === "PUSH" ? <Smartphone className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {preference.channel.replace("_", " ")}
              <span className="ml-auto h-5 w-9 rounded-full bg-emerald-600 p-0.5">
                <span className="block h-4 w-4 translate-x-4 rounded-full bg-white" />
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function Tracker({
  journeys,
  trains,
  trainById,
  routeById,
  onUpdateJourney,
  onDeleteJourney,
}: {
  journeys: Journey[];
  trains: TrainType[];
  trainById: Map<string, TrainType>;
  routeById: Map<string, Route>;
  onUpdateJourney: (id: string, patch: JourneyPatch) => void;
  onDeleteJourney: (id: string) => void;
}) {
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);

  function submitEdit(formData: FormData) {
    if (!editingJourney) {
      return;
    }

    const trainId = String(formData.get("trainId"));
    const train = trainById.get(trainId);
    const farePaid = String(formData.get("farePaid") ?? "");
    const waitlistPosition = String(formData.get("waitlistPosition") ?? "");

    onUpdateJourney(editingJourney.id, {
      routeId: train?.routeId ?? editingJourney.routeId,
      trainId,
      travelDate: String(formData.get("travelDate")),
      preferredClass: String(formData.get("preferredClass")),
      direction: String(formData.get("direction")) as Journey["direction"],
      recurrence: String(formData.get("recurrence")) as Journey["recurrence"],
      status: String(formData.get("status")) as JourneyStatus,
      notes: String(formData.get("notes") ?? ""),
      pnr: optionalString(formData.get("pnr")),
      coach: optionalString(formData.get("coach")),
      seat: optionalString(formData.get("seat")),
      bookingDate: optionalString(formData.get("bookingDate")),
      farePaid: farePaid ? Number(farePaid) : undefined,
      waitlistPosition: waitlistPosition ? Number(waitlistPosition) : undefined,
    });
    setEditingJourney(null);
  }

  return (
    <>
      <section className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-3">
        {statusColumns.map((status) => {
          const items = journeys.filter((journey) => journey.status === status);
          return (
            <div key={status} className="min-h-[440px] rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-950">{statusLabels[status]}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((journey) => (
                  <article key={journey.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">{trainById.get(journey.trainId)?.trainNumber} {trainById.get(journey.trainId)?.trainName}</h3>
                        <p className="mt-1 text-xs text-slate-600">{routeLabel(routeById.get(journey.routeId))}</p>
                      </div>
                      <StatusBadge status={journey.status} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Meta label="Travel" value={formatDate(journey.travelDate)} />
                      <Meta label="Book" value={formatDate(journey.bookingOpenDate)} />
                      <Meta label="Class" value={journey.preferredClass} />
                      <Meta label="Fare" value={journey.farePaid ? formatCurrency(journey.farePaid) : "Not booked"} />
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700" aria-label="Upload ticket attachment">
                        <Upload className="h-4 w-4" aria-hidden />
                      </button>
                      <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700" aria-label="Open ticket notes">
                        <FileText className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingJourney(journey)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700"
                        aria-label={`Edit ${trainById.get(journey.trainId)?.trainNumber ?? "journey"}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteJourney(journey.id)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-red-200 bg-red-50 text-red-700"
                        aria-label={`Delete ${trainById.get(journey.trainId)?.trainNumber ?? "journey"}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {editingJourney && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form action={submitEdit} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">Edit journey</h2>
              <button
                type="button"
                onClick={() => setEditingJourney(null)}
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700"
                aria-label="Close edit journey"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Train
                <select name="trainId" defaultValue={editingJourney.trainId} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                  {trains.map((train) => (
                    <option key={train.id} value={train.id}>
                      {train.trainNumber} {train.trainName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status
                <select name="status" defaultValue={editingJourney.status} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                  {statusColumns.map((status) => (
                    <option key={status} value={status}>{statusLabels[status]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Travel date
                <input name="travelDate" type="date" defaultValue={editingJourney.travelDate} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Preferred class
                <input name="preferredClass" defaultValue={editingJourney.preferredClass} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Direction
                <select name="direction" defaultValue={editingJourney.direction} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                  <option value="HOME_TO_OFFICE">Home to Office</option>
                  <option value="OFFICE_TO_HOME">Office to Home</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Recurrence
                <select name="recurrence" defaultValue={editingJourney.recurrence} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                  <option value="ONE_TIME">One-time</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="CUSTOM">Custom pattern</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                PNR
                <input name="pnr" inputMode="numeric" defaultValue={editingJourney.pnr ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Booking date
                <input name="bookingDate" type="date" defaultValue={editingJourney.bookingDate ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Coach
                <input name="coach" defaultValue={editingJourney.coach ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Seat
                <input name="seat" defaultValue={editingJourney.seat ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Fare paid
                <input name="farePaid" type="number" min="0" defaultValue={editingJourney.farePaid ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Waitlist position
                <input name="waitlistPosition" type="number" min="1" defaultValue={editingJourney.waitlistPosition ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
            </div>
            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
              Notes
              <textarea name="notes" rows={4} defaultValue={editingJourney.notes ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingJourney(null)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                <X className="h-4 w-4" aria-hidden />
                Cancel
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
                <Save className="h-4 w-4" aria-hidden />
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function CalendarPanel({ events }: { events: Array<{ id: string; title: string; date: string; color: string }> }) {
  return (
    <Panel title="Unified calendar" action="Month, week, agenda">
      <div className="calendar-shell rounded-lg border border-slate-200 bg-white p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listWeek",
          }}
          events={events}
          editable
          height="auto"
        />
      </div>
    </Panel>
  );
}

function HolidayPanel({ holidays }: { holidays: Holiday[] }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <Panel title="Holiday management" action="CSV and ICS ready">
        <div className="mb-4 flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" aria-hidden />
            Add holiday
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
            <Upload className="h-4 w-4" aria-hidden />
            Import CSV
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
            <CalendarDays className="h-4 w-4" aria-hidden />
            Sync ICS
          </button>
        </div>
        <div className="space-y-3">
          {holidays.map((holiday) => (
            <div key={holiday.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{holiday.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{holiday.type.replace("_", " ")}{holiday.region ? ` - ${holiday.region}` : ""}</p>
              </div>
              <span className="text-sm font-semibold text-slate-900">{formatDate(holiday.date)}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Travel suggestions" action="Long weekends">
        <div className="space-y-3">
          {[
            "Company Recharge Day creates a Friday to Monday office-trip extension.",
            "Independence Day falls near a weekend. Book return trains earlier for high demand.",
            "Personal leave after company holiday reduces one commute leg in July.",
          ].map((suggestion) => (
            <div key={suggestion} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
              {suggestion}
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function AnalyticsPanel({
  journeys,
  routeById,
}: {
  journeys: Journey[];
  routeById: Map<string, Route>;
}) {
  const mostUsedRoutes = Array.from(
    journeys.reduce((map, journey) => {
      map.set(journey.routeId, (map.get(journey.routeId) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).map(([routeId, count]) => ({ route: routeLabel(routeById.get(routeId)), count }));

  const averageFare = journeys.reduce((sum, journey) => sum + (journey.farePaid ?? 0), 0) / journeys.filter((journey) => journey.farePaid).length;
  const waitlistFrequency = Math.round((journeys.filter((journey) => ["WAITLISTED", "RAC"].includes(journey.status)).length / journeys.length) * 100);
  const successRate = Math.round((journeys.filter((journey) => ["BOOKED", "CONFIRMED", "COMPLETED"].includes(journey.status)).length / journeys.length) * 100);

  return (
    <section className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Train} label="Average fare" value={formatCurrency(averageFare)} tone="slate" />
        <MetricCard icon={AlertTriangle} label="Waitlist frequency" value={`${waitlistFrequency}%`} tone="amber" />
        <MetricCard icon={CheckCircle2} label="Booking success rate" value={`${successRate}%`} tone="green" />
        <MetricCard icon={MapPin} label="Routes used" value={mostUsedRoutes.length.toString()} tone="slate" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Trips per month" action="Trend">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="trips" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Travel spend trends" action="INR">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="spend" stroke="#15803d" fill="#bbf7d0" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Most used routes" action="History">
        <div className="grid gap-3 md:grid-cols-3">
          {mostUsedRoutes.map((item) => (
            <div key={item.route} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">{item.route}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{item.count}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {action && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{action}</span>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "red" | "amber" | "green" | "slate" }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-white text-slate-800",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className={cn("grid h-10 w-10 place-items-center rounded-md border", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function JourneyRow({
  journey,
  route,
  train,
  today,
}: {
  journey: Journey;
  route?: Route;
  train?: TrainType;
  today: string;
}) {
  return (
    <article className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Train className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{train?.trainNumber} {train?.trainName}</h3>
          <p className="mt-1 text-sm text-slate-600">{routeLabel(route)} - {formatDate(journey.travelDate)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill journey={journey} today={today} />
        <StatusBadge status={journey.status} />
      </div>
    </article>
  );
}

function CompactJourneyList({ journeys, trainById }: { journeys: Journey[]; trainById: Map<string, TrainType> }) {
  return (
    <div className="space-y-3">
      {journeys.slice(0, 4).map((journey) => (
        <div key={journey.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">{trainById.get(journey.trainId)?.trainNumber} {trainById.get(journey.trainId)?.trainName}</p>
            <p className="text-sm text-slate-600">{formatDate(journey.travelDate)}</p>
          </div>
          <StatusBadge status={journey.status} />
        </div>
      ))}
    </div>
  );
}

function StatusPill({ journey, today }: { journey: Journey; today: string }) {
  const urgency = getBookingUrgency(journey, today);
  const tone = {
    red: "bg-red-600 text-white",
    amber: "bg-amber-500 text-slate-950",
    green: "bg-emerald-600 text-white",
    slate: "bg-slate-200 text-slate-700",
  }[urgency.tone];

  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tone)}>{urgency.label}</span>;
}

function StatusBadge({ status }: { status: JourneyStatus }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone[status])}>
      {statusLabels[status]}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function routeLabel(route?: Route) {
  if (!route) {
    return "Route pending";
  }

  return `${route.originCode} to ${route.destinationCode}`;
}

function isSameMonth(dateOnly: string, today: string) {
  return dateOnly.slice(0, 7) === today.slice(0, 7);
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

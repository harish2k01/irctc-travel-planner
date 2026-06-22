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
  Clock,
  Columns3,
  FileText,
  Home,
  LogOut,
  Mail,
  Menu,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Settings,
  Train,
  Trash2,
  Upload,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildJourneyReminders, calculateBookingOpenDate, daysBetween, getBookingUrgency, isWithinNextDays } from "@/lib/dates";
import type { Holiday, Journey, Route, Train as TrainType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  currentUser: {
    id: string;
    email: string;
    name?: string;
    role: "ADMIN" | "USER";
  };
  initialSettings: AppSettingsState;
  initialUsers: ManagedUser[];
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
  { id: "settings", label: "Admin Settings", icon: Settings },
] as const;

type TabId = (typeof tabs)[number]["id"];
type JourneyPatch = Partial<Omit<Journey, "id" | "bookingOpenDate">> & {
  trainNumber?: string;
  trainName?: string;
};
type HolidayDraft = Omit<Holiday, "id">;
type AppSettingsState = {
  allowSignups: boolean;
  reminderEmailEnabled: boolean;
  reminderDiscordEnabled: boolean;
  reminderInAppEnabled: boolean;
  reminderSevenDaysEnabled: boolean;
  reminderOneDayEnabled: boolean;
  reminderBookingOpenEnabled: boolean;
  smtpUrl: string;
  emailFrom: string;
  discordWebhookUrl: string;
};
type ManagedUser = {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  mustResetPassword: boolean;
  createdAt: string;
};
type HolidaySuggestion = {
  id: string;
  title: string;
  body: string;
  date: string;
  priority: number;
  tone: "warning" | "info" | "success";
};
type ReminderAction = {
  id: string;
  routeLabel: string;
  travelDate: string;
  bookingOpenDate: string;
  headline: string;
  detail: string;
  tone: "red" | "amber" | "slate";
};

const reminderChannelOptions = [
  { key: "reminderEmailEnabled", label: "Email", icon: Mail },
  { key: "reminderDiscordEnabled", label: "Discord", icon: MessageCircle },
  { key: "reminderInAppEnabled", label: "In-App", icon: Bell },
] as const;

type ReminderChannelKey = (typeof reminderChannelOptions)[number]["key"];

const holidaySuggestionTone: Record<HolidaySuggestion["tone"], string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const reminderActionTone: Record<ReminderAction["tone"], string> = {
  red: "bg-red-600 text-white",
  amber: "bg-amber-500 text-slate-950",
  slate: "bg-slate-200 text-slate-700",
};

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";

function LayoutIcon(props: React.ComponentProps<typeof Home>) {
  return <Home {...props} />;
}

export function TravelPlannerApp({
  currentUser,
  initialSettings,
  initialUsers,
  initialJourneys,
  routes: initialRoutes,
  trains: initialTrains,
  holidays,
  today,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [journeys, setJourneys] = useState(initialJourneys);
  const [routeItems, setRouteItems] = useState(initialRoutes);
  const [trainItems, setTrainItems] = useState(initialTrains);
  const [holidayItems, setHolidayItems] = useState(holidays);
  const [settings, setSettings] = useState(initialSettings);
  const [users, setUsers] = useState(initialUsers);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const visibleTabs = currentUser.role === "ADMIN" ? tabs : tabs.filter((tab) => tab.id !== "settings");
  const activeTabDetails = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];

  useEffect(() => {
    if (appVersion === "development") {
      return;
    }

    let cancelled = false;

    async function checkVersion() {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        const payload = await response.json();
        const deployedVersion = typeof payload.version === "string" ? payload.version : appVersion;

        if (!cancelled && deployedVersion !== appVersion) {
          window.location.reload();
        }
      } catch {
        // Version checks should never interrupt normal app usage.
      }
    }

    void checkVersion();
    const interval = window.setInterval(checkVersion, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const upcomingJourneys = useMemo(
    () => journeys.filter((journey) => isWithinNextDays(journey.travelDate, today, 30)),
    [journeys, today],
  );
  const bookingSoon = useMemo(
    () => journeys.filter((journey) => isWithinNextDays(journey.bookingOpenDate, today, 7)),
    [journeys, today],
  );
  const routeById = new Map(routeItems.map((route) => [route.id, route]));
  const trainById = new Map(trainItems.map((train) => [train.id, train]));
  const pendingBookings = journeys.filter((journey) => !journey.pnr && !["CANCELLED", "COMPLETED"].includes(journey.status));
  const confirmedBookings = journeys.filter((journey) => Boolean(journey.pnr));
  const reminders = journeys.flatMap((journey) => buildConfiguredReminders(journey, settings));
  const inAppReminderActions = buildReminderActions(journeys, routeById, settings, today);

  async function createJourney(formData: FormData) {
    const travelDate = String(formData.get("travelDate"));
    const pnr = optionalString(formData.get("pnr"));
    const reminderEmailEnabled = settings.reminderEmailEnabled && formData.get("reminderEmailEnabled") === "on";
    const reminderDiscordEnabled = settings.reminderDiscordEnabled && formData.get("reminderDiscordEnabled") === "on";
    const reminderInAppEnabled = settings.reminderInAppEnabled && formData.get("reminderInAppEnabled") === "on";
    const sourceCode = optionalString(formData.get("sourceCode"))?.toUpperCase();
    const sourceName = optionalString(formData.get("sourceName"));
    const destinationCode = optionalString(formData.get("destinationCode"))?.toUpperCase();
    const destinationName = optionalString(formData.get("destinationName"));
    const trainNumber = optionalString(formData.get("trainNumber")) ?? `${sourceCode ?? "SRC"}-${destinationCode ?? "DST"}`;
    const trainName = optionalString(formData.get("trainName")) ?? "Manual ticket";
    const preferredClass = optionalString(formData.get("preferredClass")) ?? "NA";
    const routeId = `local-route-${Date.now()}`;
    const nextTrainId = `local-train-${Date.now()}`;
    const nextRoute: Route = {
      id: routeId,
      originCode: sourceCode ?? "",
      originName: sourceName ?? sourceCode ?? "",
      destinationCode: destinationCode ?? "",
      destinationName: destinationName ?? destinationCode ?? "",
    };
    const nextTrain: TrainType = {
      id: nextTrainId,
      routeId,
      trainNumber: trainNumber ?? "",
      trainName: trainName ?? "",
      preferredClasses: [preferredClass],
    };
    const newJourney: Journey = {
      id: `local-${Date.now()}`,
      routeId,
      trainId: nextTrainId,
      travelDate,
      bookingOpenDate: calculateBookingOpenDate(travelDate),
      preferredClass,
      sourceCode: sourceCode ?? nextRoute.originCode,
      sourceName: sourceName ?? nextRoute.originName,
      destinationCode: destinationCode ?? nextRoute.destinationCode,
      destinationName: destinationName ?? nextRoute.destinationName,
      direction: "HOME_TO_OFFICE",
      recurrence: "ONE_TIME",
      status: "PLANNED",
      pnr,
      remindersEnabled: reminderEmailEnabled || reminderDiscordEnabled || reminderInAppEnabled,
      reminderEmailEnabled,
      reminderDiscordEnabled,
      reminderInAppEnabled,
      notes: String(formData.get("notes") ?? ""),
    };

    try {
      const response = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: newJourney.routeId,
          trainNumber,
          trainName,
          travelDate: newJourney.travelDate,
          preferredClass: newJourney.preferredClass,
          sourceCode: newJourney.sourceCode,
          sourceName: newJourney.sourceName,
          destinationCode: newJourney.destinationCode,
          destinationName: newJourney.destinationName,
          ...(newJourney.pnr ? { pnr: newJourney.pnr } : {}),
          remindersEnabled: newJourney.remindersEnabled,
          reminderEmailEnabled: newJourney.reminderEmailEnabled,
          reminderDiscordEnabled: newJourney.reminderDiscordEnabled,
          reminderInAppEnabled: newJourney.reminderInAppEnabled,
          notes: newJourney.notes,
        }),
      });
      const payload = await response.json();

      if (response.ok && payload.data?.id) {
        newJourney.id = payload.data.id;
        newJourney.routeId = payload.data.routeId ?? newJourney.routeId;
        newJourney.trainId = payload.data.trainId ?? newJourney.trainId;
        nextRoute.id = newJourney.routeId;
        nextTrain.id = newJourney.trainId;
        nextTrain.routeId = newJourney.routeId;
      }
    } catch {
      // Keep the optimistic local journey if the preview API is unavailable.
    }

    setRouteItems((current) => current.some((route) => route.id === nextRoute.id) ? current : [...current, nextRoute]);
    setTrainItems((current) => current.some((train) => train.id === nextTrain.id) ? current : [...current, nextTrain]);
    setJourneys((current) => [newJourney, ...current]);
    setActiveTab("tracker");
  }

  async function updateJourney(id: string, patch: JourneyPatch) {
    const { trainNumber, trainName, ...journeyOnlyPatch } = patch;
    const nextPatch: Partial<Journey> = {
      ...journeyOnlyPatch,
    };

    if (journeyOnlyPatch.travelDate) {
      nextPatch.bookingOpenDate = calculateBookingOpenDate(journeyOnlyPatch.travelDate);
    }

    const currentJourney = journeys.find((journey) => journey.id === id);
    if (currentJourney && (trainNumber || trainName)) {
      setTrainItems((current) =>
        current.map((train) =>
          train.id === currentJourney.trainId
            ? {
                ...train,
                trainNumber: trainNumber ?? train.trainNumber,
                trainName: trainName ?? train.trainName,
                preferredClasses: journeyOnlyPatch.preferredClass
                  ? Array.from(new Set([journeyOnlyPatch.preferredClass, ...train.preferredClasses]))
                  : train.preferredClasses,
              }
            : train,
        ),
      );
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

  async function createHoliday(draft: HolidayDraft) {
    const newHoliday: Holiday = {
      id: `local-holiday-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...draft,
    };

    try {
      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();

      if (response.ok && payload.data?.id) {
        newHoliday.id = payload.data.id;
      }
    } catch {
      // Keep the optimistic local holiday if the API is unavailable.
    }

    setHolidayItems((current) => [...current, newHoliday].sort(sortHolidays));
  }

  async function importHolidays(drafts: HolidayDraft[]) {
    for (const draft of drafts) {
      await createHoliday(draft);
    }
  }

  async function deleteHoliday(id: string) {
    setHolidayItems((current) => current.filter((holiday) => holiday.id !== id));

    try {
      await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    } catch {
      // Local state remains editable in preview/offline mode.
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const calendarEvents = [
    ...journeys.map((journey) => ({
      id: `${journey.id}-travel`,
      title: `${journeyRouteLabel(journey, routeById.get(journey.routeId))} Travel`,
      date: journey.travelDate,
      color: ["CONFIRMED", "BOOKED"].includes(journey.status) ? "#15803d" : "#334155",
    })),
    ...journeys.map((journey) => ({
      id: `${journey.id}-booking`,
      title: `Booking Opens ${journeyRouteLabel(journey, routeById.get(journey.routeId))}`,
      date: journey.bookingOpenDate,
      color: getBookingUrgency(journey, today).tone === "red" ? "#dc2626" : "#d97706",
    })),
    ...reminders.map((reminder) => ({
      id: reminder.id,
      title: "Reminder",
      date: reminder.dueDate,
      color: "#2563eb",
    })),
    ...holidayItems.map((holiday) => ({
      id: holiday.id,
      title: holiday.name,
      date: holiday.date,
      color: holiday.type === "PERSONAL_LEAVE" ? "#7c3aed" : "#0f766e",
    })),
  ];

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200",
            sidebarCollapsed ? "w-24" : "w-24 lg:w-72",
          )}
          aria-label="Primary navigation"
        >
          <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
              <Train className="h-5 w-5" aria-hidden />
            </div>
            <div className={cn("min-w-0 flex-1", sidebarCollapsed && "hidden", !sidebarCollapsed && "hidden lg:block")}>
              <p className="truncate text-sm font-semibold text-slate-950">IRCTC Travel Planner</p>
              <p className="truncate text-xs font-medium text-slate-500">Ticket tracker</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <div className="grid gap-1">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const showLabel = !sidebarCollapsed;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    className={cn(
                      "flex h-11 w-full items-center rounded-md text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950",
                      showLabel ? "justify-center px-0 lg:justify-start lg:gap-3 lg:px-3" : "justify-center px-0",
                      activeTab === tab.id
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className={cn("truncate", showLabel ? "hidden lg:inline" : "hidden")}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-200 p-3">
            <div className={cn("mb-3 min-w-0 rounded-md bg-slate-50 p-3", sidebarCollapsed && "hidden", !sidebarCollapsed && "hidden lg:block")}>
              <p className="truncate text-xs font-medium text-slate-500">Signed in</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-950">{currentUser.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className={cn(
                "flex h-10 w-full items-center rounded-md border border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
                sidebarCollapsed ? "justify-center px-0" : "justify-center px-0 lg:justify-start lg:gap-3 lg:px-3",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span className={cn(sidebarCollapsed ? "hidden" : "hidden lg:inline")}>Log out</span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                    {activeTabDetails.label}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <NotificationMenu
                    open={notificationsOpen}
                    actions={inAppReminderActions}
                    onToggle={() => setNotificationsOpen((current) => !current)}
                    onClose={() => setNotificationsOpen(false)}
                    onOpenTracker={() => {
                      setActiveTab("tracker");
                      setNotificationsOpen(false);
                    }}
                  />
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-center text-sm sm:min-w-[360px]">
                    <MiniMetric label="Next 30 Days" value={upcomingJourneys.length.toString()} />
                    <MiniMetric label="Pending" value={pendingBookings.length.toString()} />
                    <MiniMetric label="Booked" value={confirmedBookings.length.toString()} />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === "dashboard" && (
          <Dashboard
            journeys={journeys}
            holidays={holidayItems}
            upcomingJourneys={upcomingJourneys}
            bookingSoon={bookingSoon}
            pendingBookings={pendingBookings}
            confirmedBookings={confirmedBookings}
            routeById={routeById}
            today={today}
          />
        )}
        {activeTab === "planner" && (
          <Planner settings={settings} onCreateJourney={createJourney} />
        )}
        {activeTab === "tracker" && (
          <Tracker
            journeys={journeys}
            trainById={trainById}
            routeById={routeById}
            settings={settings}
            today={today}
            onUpdateJourney={updateJourney}
            onDeleteJourney={deleteJourney}
          />
        )}
        {activeTab === "calendar" && (
          <CalendarPanel events={calendarEvents} />
        )}
        {activeTab === "holidays" && (
          <HolidayPanel
            holidays={holidayItems}
            journeys={journeys}
            routeById={routeById}
            today={today}
            onCreateHoliday={createHoliday}
            onImportHolidays={importHolidays}
            onDeleteHoliday={deleteHoliday}
          />
        )}
        {activeTab === "analytics" && (
          <AnalyticsPanel journeys={journeys} routeById={routeById} />
        )}
        {activeTab === "settings" && currentUser.role === "ADMIN" && (
          <SettingsPanel
            currentUserId={currentUser.id}
            settings={settings}
            users={users}
            onSettingsChange={setSettings}
            onUsersChange={setUsers}
          />
        )}
          </main>
        </div>
      </div>
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
  routeById,
  today,
}: {
  journeys: Journey[];
  holidays: Holiday[];
  upcomingJourneys: Journey[];
  bookingSoon: Journey[];
  pendingBookings: Journey[];
  confirmedBookings: Journey[];
  routeById: Map<string, Route>;
  today: string;
}) {
  const bookToday = journeys.filter((journey) => getBookingUrgency(journey, today).daysUntilOpen <= 0 && journey.status === "PLANNED");
  const opensTomorrow = journeys.filter((journey) => getBookingUrgency(journey, today).daysUntilOpen === 1);
  const plannedTickets = journeys.filter((journey) => journey.status === "PLANNED");

  return (
    <>
      <section className="grid gap-3 md:grid-cols-3" aria-label="Dashboard summary">
        <MetricCard icon={AlertTriangle} label="Book Today" value={bookToday.length.toString()} tone="red" />
        <MetricCard icon={Clock} label="Booking Opens Tomorrow" value={opensTomorrow.length.toString()} tone="amber" />
        <MetricCard icon={CalendarDays} label="Tickets to Book" value={plannedTickets.length.toString()} tone="slate" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Upcoming Tickets" action="Next 30 Days">
          <div className="grid gap-3">
            {upcomingJourneys.map((journey) => (
              <JourneyRow
                key={journey.id}
                journey={journey}
                route={routeById.get(journey.routeId)}
                today={today}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Booking Windows" action={`${bookingSoon.length} Soon`}>
          <div className="space-y-3">
            {bookingSoon.map((journey) => (
              <div key={journey.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{journeyRouteLabel(journey, routeById.get(journey.routeId))}</p>
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
        <Panel title="Tickets to Book" action={pendingBookings.length.toString()}>
          <CompactJourneyList journeys={pendingBookings} routeById={routeById} />
        </Panel>
        <Panel title="Booked Tickets" action={confirmedBookings.length.toString()}>
          <CompactJourneyList journeys={confirmedBookings} routeById={routeById} />
        </Panel>
        <Panel title="Upcoming Holidays" action="Long Weekend Watch">
          <div className="space-y-3">
            {holidays.slice(1, 5).map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{holiday.name}</p>
                  <p className="text-sm text-slate-600">{formatEnumLabel(holiday.type)}</p>
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
  settings,
  onCreateJourney,
}: {
  settings: AppSettingsState;
  onCreateJourney: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [trainNumber, setTrainNumber] = useState("");
  const [trainName, setTrainName] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [preferredClass, setPreferredClass] = useState("");
  const [pnr, setPnr] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [pnrMessage, setPnrMessage] = useState<string | null>(null);

  async function syncPnrForCreate() {
    if (!/^\d{10}$/.test(pnr)) {
      setPnrMessage("Enter a valid 10 digit PNR.");
      return;
    }

    const response = await fetch(`/api/pnr/${pnr}`);
    const payload = await response.json();

    if (!response.ok) {
      setPnrMessage(payload.error ?? "PNR sync failed.");
      return;
    }

    const data = payload.data as Partial<Journey> & { trainNumber?: string; trainName?: string };
    if (data.trainNumber) {
      setTrainNumber(data.trainNumber);
      setTrainName(data.trainName ?? "");
    }

    if (data.travelDate) setTravelDate(data.travelDate);
    if (data.preferredClass) setPreferredClass(data.preferredClass);
    if (data.sourceCode) setSourceCode(data.sourceCode);
    if (data.sourceName) setSourceName(data.sourceName);
    if (data.destinationCode) setDestinationCode(data.destinationCode);
    if (data.destinationName) setDestinationName(data.destinationName);
    setPnrMessage("PNR details loaded. Review and save the ticket.");
  }

  return (
    <section className="grid gap-5">
      <Panel title="Add Ticket" action="PNR optional">
        <form ref={formRef} action={onCreateJourney} className="grid gap-4">
          <input type="hidden" name="trainNumber" value={trainNumber} />
          <input type="hidden" name="trainName" value={trainName} />
          <input type="hidden" name="preferredClass" value={preferredClass} />
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            PNR number
            <span className="text-xs font-medium text-slate-500">Optional. Add it now if already booked, or tag it later from Tracker after booking.</span>
            <div className="flex gap-2">
              <input
                name="pnr"
                inputMode="numeric"
                value={pnr}
                onChange={(event) => setPnr(event.target.value)}
                placeholder="10 digit PNR after booking"
                pattern="[0-9]{10}"
                maxLength={10}
                title="PNR must be a 10 digit number."
                className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-slate-950"
              />
              <button
                type="button"
                onClick={syncPnrForCreate}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                <Clock className="h-4 w-4" aria-hidden />
                Load
              </button>
            </div>
          </label>
          {pnrMessage && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              {pnrMessage}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Source station code
              <input name="sourceCode" value={sourceCode} onChange={(event) => setSourceCode(event.target.value.toUpperCase())} required className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Source station name
              <input name="sourceName" value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Destination station code
              <input name="destinationCode" value={destinationCode} onChange={(event) => setDestinationCode(event.target.value.toUpperCase())} required className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Destination station name
              <input name="destinationName" value={destinationName} onChange={(event) => setDestinationName(event.target.value)} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Travel date
              <input
                name="travelDate"
                type="date"
                value={travelDate}
                onChange={(event) => setTravelDate(event.target.value)}
                required
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950"
              />
            </label>
          </div>
          <ReminderChannelFields settings={settings} />
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
            Add ticket
          </button>
        </form>
      </Panel>
    </section>
  );
}

function ReminderChannelFields({
  settings,
  journey,
}: {
  settings: AppSettingsState;
  journey?: Journey;
}) {
  const channels = reminderChannelOptions.filter((channel) => settings[channel.key]);

  if (channels.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm font-medium text-slate-600">
        No reminder channels are enabled in Admin Settings.
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-800">Reminder channels for this ticket</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <label key={channel.key} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-500" aria-hidden />
                {channel.label}
              </span>
              <input
                name={channel.key}
                type="checkbox"
                defaultChecked={journey ? journey[channel.key] !== false : true}
                className="h-4 w-4"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ReminderChannelButtons({
  journey,
  settings,
  onUpdate,
}: {
  journey: Journey;
  settings: AppSettingsState;
  onUpdate: (patch: JourneyPatch) => void;
}) {
  const channels = reminderChannelOptions.filter((channel) => settings[channel.key]);

  if (channels.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
        Reminders disabled globally
      </div>
    );
  }

  function toggleChannel(key: ReminderChannelKey) {
    const next = {
      reminderEmailEnabled: journey.reminderEmailEnabled !== false,
      reminderDiscordEnabled: journey.reminderDiscordEnabled === true,
      reminderInAppEnabled: journey.reminderInAppEnabled !== false,
    };
    next[key] = !next[key];
    onUpdate({
      ...next,
      remindersEnabled: next.reminderEmailEnabled || next.reminderDiscordEnabled || next.reminderInAppEnabled,
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const enabled = journey[channel.key] !== false;
          return (
            <button
              key={channel.key}
              type="button"
              onClick={() => toggleChannel(channel.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold",
                enabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-500",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {channel.label} {enabled ? "on" : "off"}
            </button>
          );
        })}
    </div>
  );
}

function Tracker({
  journeys,
  trainById,
  routeById,
  settings,
  today,
  onUpdateJourney,
  onDeleteJourney,
}: {
  journeys: Journey[];
  trainById: Map<string, TrainType>;
  routeById: Map<string, Route>;
  settings: AppSettingsState;
  today: string;
  onUpdateJourney: (id: string, patch: JourneyPatch) => void;
  onDeleteJourney: (id: string) => void;
}) {
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [pnrSyncMessage, setPnrSyncMessage] = useState<string | null>(null);
  const [ticketFilter, setTicketFilter] = useState<"all" | "toBook" | "booked">("toBook");
  const filteredJourneys = journeys
    .filter((journey) => {
      if (ticketFilter === "toBook") return !journey.pnr && !["CANCELLED", "COMPLETED"].includes(journey.status);
      if (ticketFilter === "booked") return Boolean(journey.pnr);
      return true;
    })
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate));

  function submitEdit(formData: FormData) {
    if (!editingJourney) {
      return;
    }

    const trainId = String(formData.get("trainId"));
    const train = trainById.get(trainId);
    const pnr = editableOptionalString(formData.get("pnr"));

    onUpdateJourney(editingJourney.id, {
      routeId: train?.routeId ?? editingJourney.routeId,
      trainId,
      travelDate: String(formData.get("travelDate")),
      sourceCode: optionalString(formData.get("sourceCode")),
      sourceName: optionalString(formData.get("sourceName")),
      destinationCode: optionalString(formData.get("destinationCode")),
      destinationName: optionalString(formData.get("destinationName")),
      status: pnr ? "BOOKED" : "PLANNED",
      notes: String(formData.get("notes") ?? ""),
      pnr,
      coach: optionalString(formData.get("coach")),
      seat: optionalString(formData.get("seat")),
      trainNumber: optionalString(formData.get("trainNumber")),
      trainName: optionalString(formData.get("trainName")),
      bookingDate: optionalString(formData.get("bookingDate")),
      reminderEmailEnabled: settings.reminderEmailEnabled && formData.get("reminderEmailEnabled") === "on",
      reminderDiscordEnabled: settings.reminderDiscordEnabled && formData.get("reminderDiscordEnabled") === "on",
      reminderInAppEnabled: settings.reminderInAppEnabled && formData.get("reminderInAppEnabled") === "on",
      remindersEnabled:
        (settings.reminderEmailEnabled && formData.get("reminderEmailEnabled") === "on") ||
        (settings.reminderDiscordEnabled && formData.get("reminderDiscordEnabled") === "on") ||
        (settings.reminderInAppEnabled && formData.get("reminderInAppEnabled") === "on"),
    });
    setEditingJourney(null);
    setPnrSyncMessage(null);
  }

  async function syncPnr(form: HTMLFormElement) {
    if (!editingJourney) {
      return;
    }

    const pnr = optionalString(new FormData(form).get("pnr"));

    if (!pnr || !/^\d{10}$/.test(pnr)) {
      setPnrSyncMessage("Enter a valid 10 digit PNR before syncing.");
      return;
    }

    const response = await fetch(`/api/pnr/${pnr}`);
    const payload = await response.json();

    if (!response.ok) {
      setPnrSyncMessage(payload.error ?? "PNR sync failed.");
      return;
    }

    onUpdateJourney(editingJourney.id, {
      pnr,
      ...payload.data,
      status: "BOOKED",
    });
    setEditingJourney((current) => (current ? { ...current, pnr, ...payload.data, status: "BOOKED" } : current));
    setPnrSyncMessage("PNR data synced.");
  }

  return (
    <>
      <TicketTable
        journeys={filteredJourneys}
        allCount={journeys.length}
        toBookCount={journeys.filter((journey) => !journey.pnr && !["CANCELLED", "COMPLETED"].includes(journey.status)).length}
        bookedCount={journeys.filter((journey) => Boolean(journey.pnr)).length}
        filter={ticketFilter}
        routeById={routeById}
        settings={settings}
        today={today}
        onFilterChange={setTicketFilter}
        onEdit={(journey) => {
          setEditingJourney(journey);
          setPnrSyncMessage(null);
        }}
        onDelete={onDeleteJourney}
        onUpdateJourney={onUpdateJourney}
      />

      {editingJourney && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form key={JSON.stringify(editingJourney)} action={submitEdit} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">Edit Ticket</h2>
              <button
                type="button"
                onClick={() => {
                  setEditingJourney(null);
                  setPnrSyncMessage(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700"
                aria-label="Close edit ticket"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="trainId" value={editingJourney.trainId} />
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Travel date
                <input name="travelDate" type="date" defaultValue={editingJourney.travelDate} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Source station code
                <input name="sourceCode" defaultValue={editingJourney.sourceCode ?? routeById.get(editingJourney.routeId)?.originCode ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Source station name
                <input name="sourceName" defaultValue={editingJourney.sourceName ?? routeById.get(editingJourney.routeId)?.originName ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Destination station code
                <input name="destinationCode" defaultValue={editingJourney.destinationCode ?? routeById.get(editingJourney.routeId)?.destinationCode ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Destination station name
                <input name="destinationName" defaultValue={editingJourney.destinationName ?? routeById.get(editingJourney.routeId)?.destinationName ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                PNR tag
                <span className="text-xs font-medium text-slate-500">Add after booking to link this planned ticket with the booked PNR. Clear it and save to remove the tag.</span>
                <div className="flex gap-2">
                  <input name="pnr" inputMode="numeric" defaultValue={editingJourney.pnr ?? ""} placeholder="10 digit PNR" pattern="[0-9]{10}" maxLength={10} title="PNR must be a 10 digit number." className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
                  <button
                    type="button"
                    onClick={(event) => syncPnr(event.currentTarget.form as HTMLFormElement)}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                  >
                    <Clock className="h-4 w-4" aria-hidden />
                    Sync
                  </button>
                </div>
              </label>
              {editingJourney.pnr && (
                <>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Train number
                    <input name="trainNumber" defaultValue={isPlaceholderTrain(trainById.get(editingJourney.trainId)) ? "" : trainById.get(editingJourney.trainId)?.trainNumber ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Train name
                    <input name="trainName" defaultValue={isPlaceholderTrain(trainById.get(editingJourney.trainId)) ? "" : trainById.get(editingJourney.trainId)?.trainName ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
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
                </>
              )}
              <ReminderChannelFields settings={settings} journey={editingJourney} />
            </div>
            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
              Notes
              <textarea name="notes" rows={4} defaultValue={editingJourney.notes ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950" />
            </label>
            {pnrSyncMessage && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                {pnrSyncMessage}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => {
                setEditingJourney(null);
                setPnrSyncMessage(null);
              }} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
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

function TicketTable({
  journeys,
  allCount,
  toBookCount,
  bookedCount,
  filter,
  routeById,
  settings,
  today,
  onFilterChange,
  onEdit,
  onDelete,
  onUpdateJourney,
}: {
  journeys: Journey[];
  allCount: number;
  toBookCount: number;
  bookedCount: number;
  filter: "all" | "toBook" | "booked";
  routeById: Map<string, Route>;
  settings: AppSettingsState;
  today: string;
  onFilterChange: (filter: "all" | "toBook" | "booked") => void;
  onEdit: (journey: Journey) => void;
  onDelete: (id: string) => void;
  onUpdateJourney: (id: string, patch: JourneyPatch) => void;
}) {
  const filters = [
    { id: "toBook" as const, label: "To Book", count: toBookCount },
    { id: "booked" as const, label: "Booked", count: bookedCount },
    { id: "all" as const, label: "All", count: allCount },
  ];

  return (
    <Panel title="Tickets" action={`${journeys.length} Shown`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold",
                filter === item.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {item.label}
              <span className={cn("rounded-full px-2 py-0.5 text-xs", filter === item.id ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600")}>{item.count}</span>
            </button>
          ))}
        </div>
        <p className="text-sm font-medium text-slate-500">Sorted by travel date</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Travel</th>
              <th className="px-4 py-3">Book</th>
              <th className="px-4 py-3">PNR</th>
              <th className="px-4 py-3">Reminders</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
        {journeys.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
              No tickets match this view.
            </td>
          </tr>
        )}
        {journeys.map((journey) => (
          <tr key={journey.id} className="align-top hover:bg-slate-50">
            <td className="px-4 py-3">
              <p className="font-semibold text-slate-950">{journeyRouteLabel(journey, routeById.get(journey.routeId))}</p>
              <StatusPill journey={journey} today={today} />
            </td>
            <td className="px-4 py-3 font-medium text-slate-800">{formatDate(journey.travelDate)}</td>
            <td className="px-4 py-3 font-medium text-slate-800">{formatDate(journey.bookingOpenDate)}</td>
            <td className="px-4 py-3">
              <p className="font-medium text-slate-800">{journey.pnr ?? "Not added"}</p>
              {journey.pnr && <p className="mt-1 text-xs text-slate-500">{[journey.coach, journey.seat].filter(Boolean).join(" ") || "Seat not synced"}</p>}
            </td>
            <td className="px-4 py-3">
              <ReminderChannelButtons
                journey={journey}
                settings={settings}
                onUpdate={(patch) => onUpdateJourney(journey.id, patch)}
              />
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-2">
                <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700" aria-label="Upload ticket attachment" title="Upload">
                  <Upload className="h-4 w-4" aria-hidden />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700" aria-label="Open ticket notes" title="Notes">
                  <FileText className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(journey)}
                  className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700"
                  aria-label="Edit ticket"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(journey.id)}
                  className="grid h-9 w-9 place-items-center rounded-md border border-red-200 bg-red-50 text-red-700"
                  aria-label="Delete ticket"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </td>
          </tr>
        ))}
          </tbody>
        </table>
      </div>
    </Panel>
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
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
            list: "Agenda",
          }}
          events={events}
          editable
          height="auto"
        />
      </div>
    </Panel>
  );
}

function SettingsPanel({
  currentUserId,
  settings,
  users,
  onSettingsChange,
  onUsersChange,
}: {
  currentUserId: string;
  settings: AppSettingsState;
  users: ManagedUser[];
  onSettingsChange: (settings: AppSettingsState) => void;
  onUsersChange: (users: ManagedUser[]) => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  async function updateSettings(patch: Partial<AppSettingsState>) {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json();

    if (response.ok) {
      onSettingsChange({
        allowSignups: payload.data.allowSignups,
        reminderEmailEnabled: payload.data.reminderEmailEnabled,
        reminderDiscordEnabled: payload.data.reminderDiscordEnabled,
        reminderInAppEnabled: payload.data.reminderInAppEnabled,
        reminderSevenDaysEnabled: payload.data.reminderSevenDaysEnabled,
        reminderOneDayEnabled: payload.data.reminderOneDayEnabled,
        reminderBookingOpenEnabled: payload.data.reminderBookingOpenEnabled,
        smtpUrl: payload.data.smtpUrl ?? "",
        emailFrom: payload.data.emailFrom ?? "",
        discordWebhookUrl: payload.data.discordWebhookUrl ?? "",
      });
    } else {
      setNotice(payload.error ?? "Could not update settings.");
    }
  }

  async function createUser(formData: FormData) {
    setNotice(null);
    const response = await fetch("/api/settings/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: optionalString(formData.get("name")),
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? "USER"),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error ?? "Could not create user.");
      return;
    }

    onUsersChange([...users, { ...payload.data, createdAt: new Date().toISOString() }]);
    setNotice(
      payload.mail?.sent
        ? `Temporary password sent to ${payload.data.email}.`
        : `SMTP URL is not configured. Temporary password for ${payload.data.email}: ${payload.temporaryPassword}`,
    );
  }

  async function updateUser(id: string, patch: Partial<ManagedUser>) {
    const response = await fetch(`/api/settings/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json();

    if (response.ok) {
      onUsersChange(users.map((user) => (user.id === id ? { ...user, ...payload.data, createdAt: user.createdAt } : user)));
    } else {
      setNotice(payload.error ?? "Could not update user.");
    }
  }

  async function deleteUser(id: string) {
    const response = await fetch(`/api/settings/users/${id}`, { method: "DELETE" });
    const payload = await response.json();

    if (response.ok) {
      onUsersChange(users.filter((user) => user.id !== id));
    } else {
      setNotice(payload.error ?? "Could not delete user.");
    }
  }

  return (
    <section className="grid gap-5">
      {notice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {notice}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Panel title="Access" action={settings.allowSignups ? "Signups On" : "Signups Off"}>
          <SettingToggle
            icon={UserPlus}
            label="Allow public signups"
            checked={settings.allowSignups}
            onChange={(checked) => updateSettings({ allowSignups: checked })}
          />
        </Panel>

        <Panel title="Reminder Channels" action="Global Defaults">
          <div className="grid gap-3">
            <SettingToggle
              icon={Mail}
              label="Email Reminders"
              checked={settings.reminderEmailEnabled}
              onChange={(checked) => updateSettings({ reminderEmailEnabled: checked })}
            />
            <SettingToggle
              icon={MessageCircle}
              label="Discord Reminders"
              checked={settings.reminderDiscordEnabled}
              onChange={(checked) => updateSettings({ reminderDiscordEnabled: checked })}
            />
            <SettingToggle
              icon={Bell}
              label="In-App Reminders"
              checked={settings.reminderInAppEnabled}
              onChange={(checked) => updateSettings({ reminderInAppEnabled: checked })}
            />
          </div>
        </Panel>

        <Panel title="Reminder Schedule" action="Booking Window">
          <div className="grid gap-3">
            <SettingToggle
              icon={CalendarDays}
              label="7 Days Before Booking Opens"
              checked={settings.reminderSevenDaysEnabled}
              onChange={(checked) => updateSettings({ reminderSevenDaysEnabled: checked })}
            />
            <SettingToggle
              icon={CalendarDays}
              label="1 Day Before Booking Opens"
              checked={settings.reminderOneDayEnabled}
              onChange={(checked) => updateSettings({ reminderOneDayEnabled: checked })}
            />
            <SettingToggle
              icon={Clock}
              label="Booking Open Day"
              checked={settings.reminderBookingOpenEnabled}
              onChange={(checked) => updateSettings({ reminderBookingOpenEnabled: checked })}
            />
          </div>
        </Panel>
      </div>

      <Panel title="Delivery Configuration" action="Channel Setup">
        {(!settings.reminderEmailEnabled && !settings.reminderDiscordEnabled) && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm font-medium text-slate-600">
            Enable Email or Discord reminders to configure delivery settings.
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {settings.reminderEmailEnabled && (
            <>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                SMTP URL
                <input
                  type="password"
                  defaultValue={settings.smtpUrl}
                  onBlur={(event) => updateSettings({ smtpUrl: event.target.value.trim() })}
                  placeholder="smtp://user:password@mail.example.com:587"
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Email Sender
                <input
                  type="text"
                  defaultValue={settings.emailFrom}
                  onBlur={(event) => updateSettings({ emailFrom: event.target.value.trim() })}
                  placeholder="IRCTC Travel Planner <noreply@example.com>"
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                />
              </label>
            </>
          )}
          {settings.reminderDiscordEnabled && (
            <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
              Discord Webhook URL
              <input
                type="password"
                defaultValue={settings.discordWebhookUrl}
                onBlur={(event) => updateSettings({ discordWebhookUrl: event.target.value.trim() })}
                placeholder="https://discord.com/api/webhooks/..."
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950"
              />
            </label>
          )}
        </div>
      </Panel>

      <Panel title="Users" action={`${users.length} Total`}>
        <form action={createUser} className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_0.7fr_auto]">
            <input name="name" placeholder="Name" className="h-10 rounded-md border border-slate-300 px-3" />
            <input required name="email" type="email" placeholder="Email" className="h-10 rounded-md border border-slate-300 px-3" />
            <select name="role" defaultValue="USER" className="h-10 rounded-md border border-slate-300 px-3">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
              Create
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-950">{user.name || user.email}</p>
                <p className="text-sm text-slate-600">{user.email}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {user.mustResetPassword ? "Password reset required" : "Password set"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={user.role}
                  onChange={(event) => updateUser(user.id, { role: event.target.value as ManagedUser["role"] })}
                  className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button
                  type="button"
                  onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                  disabled={user.id === currentUserId}
                  className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  {user.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteUser(user.id)}
                  disabled={user.id === currentUserId}
                  className="h-9 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function SettingToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
      <Icon className="h-4 w-4 text-slate-500" aria-hidden />
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="ml-auto h-5 w-5"
      />
    </label>
  );
}

function HolidayPanel({
  holidays,
  journeys,
  routeById,
  today,
  onCreateHoliday,
  onImportHolidays,
  onDeleteHoliday,
}: {
  holidays: Holiday[];
  journeys: Journey[];
  routeById: Map<string, Route>;
  today: string;
  onCreateHoliday: (draft: HolidayDraft) => Promise<void>;
  onImportHolidays: (drafts: HolidayDraft[]) => Promise<void>;
  onDeleteHoliday: (id: string) => void;
}) {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showIcsForm, setShowIcsForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitHoliday(formData: FormData) {
    const draft = holidayDraftFromForm(formData);
    await onCreateHoliday(draft);
    setShowAddForm(false);
    setNotice(`Added ${draft.name}.`);
  }

  async function importCsv(file: File | undefined) {
    if (!file) {
      return;
    }

    const text = await file.text();
    const drafts = parseHolidayCsv(text);

    if (drafts.length === 0) {
      setNotice("No valid holidays found. CSV columns should be name,date,type.");
      return;
    }

    await onImportHolidays(drafts);
    setNotice(`Imported ${drafts.length} holiday${drafts.length === 1 ? "" : "s"}.`);
  }

  async function syncIcs(formData: FormData) {
    const url = optionalString(formData.get("icsUrl"));
    const icsText = optionalString(formData.get("icsText"));

    if (!url && !icsText) {
      setNotice("Paste an ICS URL or ICS text to sync.");
      return;
    }

    const response = await fetch("/api/holidays/import-ics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, icsText }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error ?? "ICS sync failed.");
      return;
    }

    const drafts = payload.data as HolidayDraft[];
    await onImportHolidays(drafts);
    setShowIcsForm(false);
    setNotice(`Synced ${drafts.length} holiday${drafts.length === 1 ? "" : "s"} from ICS.`);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <Panel title="Holiday Management" action="CSV and ICS">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add holiday
          </button>
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Import CSV
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              void importCsv(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => setShowIcsForm((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Sync ICS
          </button>
        </div>

        {notice && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
            {notice}
          </div>
        )}

        {showAddForm && (
          <form action={submitHoliday} className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Name
                <input name="name" required className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Date
                <input name="date" type="date" required className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Type
                <select name="type" defaultValue="COMPANY" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
                  <option value="COMPANY">Company</option>
                  <option value="PERSONAL_LEAVE">Personal Leave</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
                <Save className="h-4 w-4" aria-hidden />
                Save holiday
              </button>
            </div>
          </form>
        )}

        {showIcsForm && (
          <form action={syncIcs} className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              ICS URL
              <input name="icsUrl" type="url" placeholder="https://example.com/calendar.ics" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Or paste ICS text
              <textarea name="icsText" rows={5} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowIcsForm(false)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
                <CalendarDays className="h-4 w-4" aria-hidden />
                Sync holidays
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {holidays.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm font-medium text-slate-600">
              No holidays yet. Add one manually, import a CSV, or sync an ICS calendar.
            </div>
          )}
          {holidays.map((holiday) => (
            <div key={holiday.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{holiday.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{formatEnumLabel(holiday.type)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-sm font-semibold text-slate-900">{formatDate(holiday.date)}</span>
                <button
                  type="button"
                  onClick={() => onDeleteHoliday(holiday.id)}
                  className="grid h-9 w-9 place-items-center rounded-md border border-red-200 bg-red-50 text-red-700"
                  aria-label={`Delete ${holiday.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Travel Suggestions" action="Long Weekends">
        <div className="space-y-3">
          {buildHolidaySuggestions(holidays, journeys, routeById, today).map((suggestion) => (
            <div key={suggestion.id} className={cn("rounded-lg border p-4", holidaySuggestionTone[suggestion.tone])}>
              <p className="text-sm font-semibold">{suggestion.title}</p>
              <p className="mt-1 text-sm">{suggestion.body}</p>
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
  const monthlyAnalytics = buildMonthlyAnalytics(journeys);
  const mostUsedRoutes = Array.from(
    journeys.reduce((map, journey) => {
      const label = journeyRouteLabel(journey, routeById.get(journey.routeId));
      map.set(label, (map.get(label) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).map(([route, count]) => ({ route, count }));

  const ticketsToBook = journeys.filter((journey) => !journey.pnr).length;
  const bookedTickets = journeys.filter((journey) => Boolean(journey.pnr)).length;
  const upcomingTickets = journeys.filter((journey) => !["CANCELLED", "COMPLETED"].includes(journey.status)).length;

  return (
    <section className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Train} label="Upcoming tickets" value={upcomingTickets.toString()} tone="slate" />
        <MetricCard icon={Clock} label="Tickets to Book" value={ticketsToBook.toString()} tone="amber" />
        <MetricCard icon={CalendarDays} label="Booked Tickets" value={bookedTickets.toString()} tone="green" />
        <MetricCard icon={MapPin} label="Routes Used" value={mostUsedRoutes.length.toString()} tone="slate" />
      </div>
      {journeys.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm font-medium text-slate-600">
          No analytics yet. Add tickets to build route and monthly booking views.
        </div>
      )}
      <div className="grid gap-5">
        <Panel title="Tickets per Month" action="Trend">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAnalytics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="trips" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Most Used Routes" action="History">
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

function NotificationMenu({
  open,
  actions,
  onToggle,
  onClose,
  onOpenTracker,
}: {
  open: boolean;
  actions: ReminderAction[];
  onToggle: () => void;
  onClose: () => void;
  onOpenTracker: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="relative grid h-11 w-11 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
        aria-label="Open reminders"
        title="Reminders"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {actions.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {actions.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[360px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-950">Booking Reminders</h2>
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Close reminders">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {actions.length === 0 && (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-600">
                No ticket needs booking attention right now.
              </div>
            )}
            {actions.slice(0, 6).map((action) => (
              <div key={action.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{action.routeLabel}</p>
                    <p className="mt-1 text-sm text-slate-600">{action.detail}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-semibold", reminderActionTone[action.tone])}>
                    {action.headline}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Meta label="Travel" value={formatDate(action.travelDate)} />
                  <Meta label="Book" value={formatDate(action.bookingOpenDate)} />
                </dl>
              </div>
            ))}
          </div>
          {actions.length > 0 && (
            <button
              type="button"
              onClick={onOpenTracker}
              className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
            >
              Open Tracker
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function JourneyRow({
  journey,
  route,
  today,
}: {
  journey: Journey;
  route?: Route;
  today: string;
}) {
  return (
    <article className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Train className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{journeyRouteLabel(journey, route)}</h3>
          <p className="mt-1 text-sm text-slate-600">Travel on {formatDate(journey.travelDate)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill journey={journey} today={today} />
      </div>
    </article>
  );
}

function CompactJourneyList({ journeys, routeById }: { journeys: Journey[]; routeById: Map<string, Route> }) {
  return (
    <div className="space-y-3">
      {journeys.slice(0, 4).map((journey) => (
        <div key={journey.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">{journeyRouteLabel(journey, routeById.get(journey.routeId))}</p>
            <p className="text-sm text-slate-600">{formatDate(journey.travelDate)}</p>
          </div>
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

function journeyRouteLabel(journey: Journey, route?: Route) {
  const source = journey.sourceCode || route?.originCode;
  const destination = journey.destinationCode || route?.destinationCode;

  if (source && destination) {
    return `${source} to ${destination}`;
  }

  return routeLabel(route);
}

function isPlaceholderTrain(train?: TrainType) {
  const legacyPrefix = `${["T", "B", "D"].join("")}-`;
  const legacyName = ["Train", "to", "be", "decided"].join(" ");
  return !train || train.trainNumber.startsWith(legacyPrefix) || train.trainName === legacyName || train.trainName === "Manual ticket";
}

function buildMonthlyAnalytics(journeys: Journey[]) {
  const monthMap = journeys.reduce((map, journey) => {
    const monthKey = journey.travelDate.slice(0, 7);
    const existing = map.get(monthKey) ?? { month: monthKey, trips: 0 };
    existing.trips += 1;
    map.set(monthKey, existing);
    return map;
  }, new Map<string, { month: string; trips: number }>());

  return Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      ...item,
      month: formatMonthLabel(item.month),
    }));
}

function buildConfiguredReminders(journey: Journey, settings: AppSettingsState, channel?: "EMAIL" | "DISCORD" | "IN_APP") {
  if (journey.remindersEnabled === false) {
    return [];
  }

  const channelEnabled = {
    EMAIL: settings.reminderEmailEnabled && journey.reminderEmailEnabled !== false,
    DISCORD: settings.reminderDiscordEnabled && journey.reminderDiscordEnabled === true,
    IN_APP: settings.reminderInAppEnabled && journey.reminderInAppEnabled !== false,
  };

  if (channel) {
    if (!channelEnabled[channel]) {
      return [];
    }
  } else if (!channelEnabled.EMAIL && !channelEnabled.DISCORD && !channelEnabled.IN_APP) {
    return [];
  }

  return buildJourneyReminders(journey).filter((reminder) => {
    if (reminder.type === "SEVEN_DAYS_BEFORE") return settings.reminderSevenDaysEnabled;
    if (reminder.type === "ONE_DAY_BEFORE") return settings.reminderOneDayEnabled;
    return settings.reminderBookingOpenEnabled;
  });
}

function buildReminderActions(
  journeys: Journey[],
  routeById: Map<string, Route>,
  settings: AppSettingsState,
  today: string,
): ReminderAction[] {
  if (!settings.reminderInAppEnabled) {
    return [];
  }

  return journeys
    .filter((journey) => !journey.pnr && journey.remindersEnabled !== false && journey.reminderInAppEnabled !== false)
    .flatMap((journey): ReminderAction[] => {
      const daysUntilOpen = daysBetween(today, journey.bookingOpenDate);

      if (daysUntilOpen <= 0 && settings.reminderBookingOpenEnabled) {
        return [{
          id: `${journey.id}-booking-open`,
          routeLabel: journeyRouteLabel(journey, routeById.get(journey.routeId)),
          travelDate: journey.travelDate,
          bookingOpenDate: journey.bookingOpenDate,
          headline: "Book Now",
          detail: "The booking window is open. Book the ticket, then edit it and tag the PNR.",
          tone: "red",
        }];
      }

      if (daysUntilOpen === 1 && settings.reminderOneDayEnabled) {
        return [{
          id: `${journey.id}-tomorrow`,
          routeLabel: journeyRouteLabel(journey, routeById.get(journey.routeId)),
          travelDate: journey.travelDate,
          bookingOpenDate: journey.bookingOpenDate,
          headline: "Tomorrow",
          detail: "Booking opens tomorrow. Keep ticket details ready.",
          tone: "amber",
        }];
      }

      if (daysUntilOpen > 1 && daysUntilOpen <= 7 && settings.reminderSevenDaysEnabled) {
        return [{
          id: `${journey.id}-soon`,
          routeLabel: journeyRouteLabel(journey, routeById.get(journey.routeId)),
          travelDate: journey.travelDate,
          bookingOpenDate: journey.bookingOpenDate,
          headline: `${daysUntilOpen} Days`,
          detail: "Booking opens within the next week.",
          tone: "slate",
        }];
      }

      return [];
    })
    .sort((a, b) => a.bookingOpenDate.localeCompare(b.bookingOpenDate) || a.travelDate.localeCompare(b.travelDate));
}

function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date(`${monthKey}-01T12:00:00.000Z`));
}

function sortHolidays(a: Holiday, b: Holiday) {
  return a.date.localeCompare(b.date) || a.name.localeCompare(b.name);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function holidayDraftFromForm(formData: FormData): HolidayDraft {
  return {
    name: String(formData.get("name") ?? "").trim(),
    date: String(formData.get("date") ?? ""),
    type: String(formData.get("type") ?? "COMPANY") as Holiday["type"],
  };
}

function parseHolidayCsv(text: string): HolidayDraft[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return rows.flatMap((row, index) => {
    const columns = splitCsvRow(row);
    const [name, date, rawType] = columns;

    if (index === 0 && ["name", "holiday"].includes(name?.toLowerCase())) {
      return [];
    }

    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      return [];
    }

    return [{
      name,
      date,
      type: normalizeHolidayType(rawType),
    }];
  });
}

function splitCsvRow(row: string) {
  const columns: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      columns.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  columns.push(current.trim());
  return columns;
}

function normalizeHolidayType(value?: string): Holiday["type"] {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (["COMPANY", "PERSONAL_LEAVE"].includes(normalized)) {
    return normalized as Holiday["type"];
  }

  return "COMPANY";
}

function buildHolidaySuggestions(
  holidays: Holiday[],
  journeys: Journey[],
  routeById: Map<string, Route>,
  today: string,
): HolidaySuggestion[] {
  const suggestions: HolidaySuggestion[] = [];
  const seen = new Set<string>();
  const activeJourneys = journeys.filter((journey) => !["CANCELLED", "COMPLETED"].includes(journey.status));
  const futureHolidays = holidays
    .filter((holiday) => daysBetween(today, holiday.date) >= -1)
    .sort((a, b) => a.date.localeCompare(b.date));

  function addSuggestion(suggestion: HolidaySuggestion) {
    if (seen.has(suggestion.id)) {
      return;
    }

    seen.add(suggestion.id);
    suggestions.push(suggestion);
  }

  if (futureHolidays.length === 0 && activeJourneys.length === 0) {
    return [{
      id: "empty",
      title: "No Suggestions Yet",
      body: "Add tickets and company or personal leave dates to get weekend, booking-window, and travel-date suggestions.",
      date: today,
      priority: 99,
      tone: "info",
    }];
  }

  for (const holiday of futureHolidays) {
    const holidayLabel = formatEnumLabel(holiday.type);
    const weekday = weekdayName(holiday.date);
    const holidayDate = formatDate(holiday.date);
    const day = weekdayIndex(holiday.date);

    if (day === 5) {
      addSuggestion({
        id: `${holiday.id}-friday-long-weekend`,
        title: "Friday Long Weekend",
        body: `${holiday.name} is on Friday, ${holidayDate}. Saturday and Sunday are already leave days, so check both outbound and return tickets early if you plan to travel.`,
        date: holiday.date,
        priority: 1,
        tone: "success",
      });
    } else if (day === 1) {
      addSuggestion({
        id: `${holiday.id}-monday-long-weekend`,
        title: "Monday Long Weekend",
        body: `${holiday.name} is on Monday, ${holidayDate}. It extends the default Saturday-Sunday leave block, so nearby tickets may see higher demand.`,
        date: holiday.date,
        priority: 1,
        tone: "success",
      });
    } else if (day === 4) {
      addSuggestion({
        id: `${holiday.id}-thursday-bridge`,
        title: "Bridge Leave Opportunity",
        body: `${holiday.name} is on Thursday, ${holidayDate}. Taking Friday as Personal Leave creates a Thursday-to-Sunday break.`,
        date: holiday.date,
        priority: 2,
        tone: "info",
      });
    } else if (day === 2) {
      addSuggestion({
        id: `${holiday.id}-tuesday-bridge`,
        title: "Bridge Leave Opportunity",
        body: `${holiday.name} is on Tuesday, ${holidayDate}. Taking Monday as Personal Leave connects it with the default weekend.`,
        date: holiday.date,
        priority: 2,
        tone: "info",
      });
    } else if (isWeekend(holiday.date)) {
      addSuggestion({
        id: `${holiday.id}-weekend-overlap`,
        title: "Holiday Falls on a Weekend",
        body: `${holiday.name} is on ${weekday}, which is already a default leave day. Confirm whether it changes your ticket plan before adding extra travel.`,
        date: holiday.date,
        priority: 5,
        tone: "info",
      });
    } else {
      addSuggestion({
        id: `${holiday.id}-midweek`,
        title: `${holidayLabel} on ${weekday}`,
        body: `${holiday.name} is on ${holidayDate}. Review tickets around this date in case you want to shift office travel.`,
        date: holiday.date,
        priority: 4,
        tone: "info",
      });
    }

    for (const journey of activeJourneys) {
      const route = journeyRouteLabel(journey, routeById.get(journey.routeId));
      const travelGap = daysBetween(holiday.date, journey.travelDate);
      const bookingGap = daysBetween(holiday.date, journey.bookingOpenDate);

      if (travelGap === 0) {
        addSuggestion({
          id: `${holiday.id}-${journey.id}-same-travel`,
          title: holiday.type === "PERSONAL_LEAVE" ? "Leave Overlaps Travel" : "Holiday on Travel Date",
          body: `${holiday.name} is on the same day as your ${route} ticket. Confirm whether this ticket is still needed before booking.`,
          date: journey.travelDate,
          priority: 0,
          tone: "warning",
        });
      } else if (Math.abs(travelGap) <= 3) {
        const relation = travelGap > 0 ? `${travelGap} day${travelGap === 1 ? "" : "s"} before` : `${Math.abs(travelGap)} day${Math.abs(travelGap) === 1 ? "" : "s"} after`;
        addSuggestion({
          id: `${holiday.id}-${journey.id}-near-travel`,
          title: "Holiday Near Travel Date",
          body: `${holiday.name} is ${relation} your ${route} travel date. Book earlier or recheck the travel date if plans may shift.`,
          date: minDate(holiday.date, journey.travelDate),
          priority: 2,
          tone: "warning",
        });
      }

      if (bookingGap === 0) {
        addSuggestion({
          id: `${holiday.id}-${journey.id}-same-booking`,
          title: "Booking Opens on Leave Day",
          body: `Booking for ${route} opens on ${holiday.name}. Keep an in-app reminder enabled so the booking window is not missed.`,
          date: journey.bookingOpenDate,
          priority: 0,
          tone: "warning",
        });
      } else if (Math.abs(bookingGap) <= 1) {
        addSuggestion({
          id: `${holiday.id}-${journey.id}-near-booking`,
          title: "Holiday Near Booking Window",
          body: `${holiday.name} is close to the booking-open date for ${route}. Check reminders and be ready before the window opens.`,
          date: minDate(holiday.date, journey.bookingOpenDate),
          priority: 2,
          tone: "info",
        });
      }
    }
  }

  for (const journey of activeJourneys) {
    const route = journeyRouteLabel(journey, routeById.get(journey.routeId));

    if (isWeekend(journey.travelDate)) {
      addSuggestion({
        id: `${journey.id}-weekend-travel`,
        title: "Travel Date Is a Default Leave Day",
        body: `${route} is scheduled on ${weekdayName(journey.travelDate)}, which is already a Saturday/Sunday leave day. Confirm the ticket is still required.`,
        date: journey.travelDate,
        priority: 3,
        tone: "info",
      });
    }

    if (isWeekend(journey.bookingOpenDate)) {
      addSuggestion({
        id: `${journey.id}-weekend-booking`,
        title: "Booking Opens on a Weekend",
        body: `Booking for ${route} opens on ${weekdayName(journey.bookingOpenDate)}. Since weekends are default leave days, keep an in-app reminder enabled.`,
        date: journey.bookingOpenDate,
        priority: 1,
        tone: "warning",
      });
    }

    if (["PLANNED", "BOOKING_WINDOW_OPEN"].includes(journey.status) && daysBetween(today, journey.bookingOpenDate) <= 7 && daysBetween(today, journey.bookingOpenDate) >= 0) {
      addSuggestion({
        id: `${journey.id}-booking-soon`,
        title: "Booking Window Coming Up",
        body: `${route} opens for booking on ${formatDate(journey.bookingOpenDate)}. Keep at least one reminder channel enabled for this ticket.`,
        date: journey.bookingOpenDate,
        priority: 1,
        tone: "warning",
      });
    }
  }

  for (let index = 0; index < futureHolidays.length - 1; index += 1) {
    const current = futureHolidays[index];
    const next = futureHolidays[index + 1];
    const gap = daysBetween(current.date, next.date);

    if (gap > 0 && gap <= 4) {
      addSuggestion({
        id: `${current.id}-${next.id}-cluster`,
        title: "Holiday Cluster",
        body: `${current.name} and ${next.name} are ${gap} day${gap === 1 ? "" : "s"} apart. Check whether one ticket can cover both dates or if return tickets need earlier booking.`,
        date: current.date,
        priority: 2,
        tone: "success",
      });
    }
  }

  return suggestions
    .sort((a, b) => a.priority - b.priority || a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .slice(0, 10);
}

function weekdayIndex(dateOnly: string) {
  return new Date(`${dateOnly}T12:00:00.000Z`).getDay();
}

function weekdayName(dateOnly: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(new Date(`${dateOnly}T12:00:00.000Z`));
}

function isWeekend(dateOnly: string) {
  const day = weekdayIndex(dateOnly);
  return day === 0 || day === 6;
}

function minDate(first: string, second: string) {
  return first <= second ? first : second;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function editableOptionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

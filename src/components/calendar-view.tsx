"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dateInTimeZone } from "@/lib/dates";
import { formatDate, formatInstant, routeName } from "@/lib/format";
import type { Holiday, Ticket } from "@/lib/types";

type Selection =
  | { kind: "ticket"; ticket: Ticket; event: "booking" | "travel" }
  | { kind: "holiday"; holiday: Holiday };

type CalendarViewName = "dayGridMonth" | "timeGridWeek" | "listMonth";

export function CalendarView({ tickets, holidays, timeZone, weekStartsOn }: { tickets: Ticket[]; holidays: Holiday[]; timeZone: string; weekStartsOn: 0 | 1 }) {
  const calendarRef = useRef<FullCalendar>(null);
  const [selected, setSelected] = useState<Selection>();
  const [title, setTitle] = useState("");
  const [activeView, setActiveView] = useState<CalendarViewName>("dayGridMonth");
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(undefined);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selected]);

  const events = [
    ...tickets.flatMap((ticket) => [
      {
        id: `booking:${ticket.id}`,
        title: `Book ${routeName(ticket)}`,
        start: dateInTimeZone(ticket.bookingOpensAt, timeZone),
        allDay: true,
        backgroundColor: "#d97706",
        borderColor: "#d97706",
        extendedProps: { kind: "ticket", ticket, event: "booking" },
      },
      {
        id: `travel:${ticket.id}`,
        title: `Travel ${routeName(ticket)}`,
        start: ticket.travelDate,
        allDay: true,
        backgroundColor: ticket.status === "BOOKED" ? "#059669" : "#2563eb",
        borderColor: ticket.status === "BOOKED" ? "#059669" : "#2563eb",
        extendedProps: { kind: "ticket", ticket, event: "travel" },
      },
    ]),
    ...holidays.map((holiday) => ({
      id: `holiday:${holiday.id}`,
      title: holiday.name,
      start: holiday.date,
      allDay: true,
      backgroundColor: holiday.type === "PERSONAL_LEAVE" ? "#7c3aed" : "#475569",
      borderColor: holiday.type === "PERSONAL_LEAVE" ? "#7c3aed" : "#475569",
      extendedProps: { kind: "holiday", holiday },
    })),
  ];

  function navigate(action: "prev" | "next" | "today") {
    calendarRef.current?.getApi()[action]();
  }

  function changeView(view: CalendarViewName) {
    calendarRef.current?.getApi().changeView(view);
  }

  return (
    <section className="calendar-shell rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-600">
        <Legend color="bg-amber-600">Booking</Legend>
        <Legend color="bg-blue-600">Travel to book</Legend>
        <Legend color="bg-emerald-600">Booked travel</Legend>
        <Legend color="bg-slate-600">Company leave</Legend>
        <Legend color="bg-violet-600">Personal leave</Legend>
      </div>
      <div className="mb-3 grid items-center gap-2 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-1 justify-self-start">
          <button type="button" onClick={() => navigate("prev")} title="Previous period" aria-label="Previous period" className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => navigate("next")} title="Next period" aria-label="Next period" className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => navigate("today")} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Today</button>
        </div>
        <h2 aria-live="polite" className="text-base font-semibold md:text-center">{title}</h2>
        <div className="inline-flex justify-self-start overflow-hidden rounded-md border border-slate-950 md:justify-self-end" role="group" aria-label="Calendar view">
          <ViewButton active={activeView === "dayGridMonth"} onClick={() => changeView("dayGridMonth")}>Month</ViewButton>
          <ViewButton active={activeView === "timeGridWeek"} onClick={() => changeView("timeGridWeek")}>Week</ViewButton>
          <ViewButton active={activeView === "listMonth"} onClick={() => changeView("listMonth")}>Agenda</ViewButton>
        </div>
      </div>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        datesSet={(info) => {
          setTitle(info.view.title);
          setActiveView(info.view.type as CalendarViewName);
        }}
        events={events}
        eventClick={(info) => setSelected(info.event.extendedProps as Selection)}
        dayMaxEvents={2}
        fixedWeekCount={false}
        height="auto"
        nowIndicator
        firstDay={weekStartsOn}
        eventDisplay="block"
      />
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onMouseDown={(event) => event.target === event.currentTarget && setSelected(undefined)}>
          <section role="dialog" aria-modal="true" aria-label={selected.kind === "ticket" ? routeName(selected.ticket) : selected.holiday.name} className="w-full max-w-md rounded-md bg-white shadow-xl">
            <header className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
              <h2 className="font-semibold">{selected.kind === "ticket" ? routeName(selected.ticket) : selected.holiday.name}</h2>
              <button type="button" onClick={() => setSelected(undefined)} title="Close" className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </header>
            <div className="grid gap-3 p-4 text-sm">
              {selected.kind === "ticket" ? (
                <>
                  <div><span className="text-slate-500">{selected.event === "booking" ? "Booking opens" : "Travel date"}</span><strong className="mt-1 block">{selected.event === "booking" ? formatInstant(selected.ticket.bookingOpensAt, timeZone) : formatDate(selected.ticket.travelDate)}</strong></div>
                  <div><span className="text-slate-500">PNR</span><strong className="mt-1 block">{selected.ticket.pnrTagged ? `Ending ${selected.ticket.pnrLast4}` : "Not tagged"}</strong></div>
                  <Link href={`/tracker?ticket=${selected.ticket.id}`} className="mt-1 inline-flex h-9 items-center justify-center rounded-md bg-slate-950 px-3 font-semibold text-white">Open ticket</Link>
                </>
              ) : (
                <>
                  <div><span className="text-slate-500">Date</span><strong className="mt-1 block">{formatDate(selected.holiday.date)}</strong></div>
                  <div><span className="text-slate-500">Type</span><strong className="mt-1 block">{selected.holiday.type === "PERSONAL_LEAVE" ? "Personal leave" : "Company"}</strong></div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{children}</span>;
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`h-9 px-3 text-sm font-semibold ${active ? "bg-blue-700 text-white" : "bg-slate-950 text-white hover:bg-slate-800"}`}>{children}</button>;
}

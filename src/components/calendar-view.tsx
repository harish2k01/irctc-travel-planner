"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { dateInTimeZone } from "@/lib/dates";
import { formatDate, formatInstant, routeName } from "@/lib/format";
import type { Holiday, Ticket } from "@/lib/types";

type Selection =
  | { kind: "ticket"; ticket: Ticket; event: "booking" | "travel" }
  | { kind: "holiday"; holiday: Holiday };

export function CalendarView({ tickets, holidays, timeZone }: { tickets: Ticket[]; holidays: Holiday[]; timeZone: string }) {
  const [selected, setSelected] = useState<Selection>();
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

  return (
    <section className="calendar-shell rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-600">
        <Legend color="bg-amber-600">Booking</Legend>
        <Legend color="bg-blue-600">Travel to book</Legend>
        <Legend color="bg-emerald-600">Booked travel</Legend>
        <Legend color="bg-slate-600">Company leave</Legend>
        <Legend color="bg-violet-600">Personal leave</Legend>
      </div>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listMonth" }}
        buttonText={{ today: "Today", month: "Month", week: "Week", list: "Agenda" }}
        events={events}
        eventClick={(info) => setSelected(info.event.extendedProps as Selection)}
        dayMaxEvents={2}
        fixedWeekCount={false}
        height="auto"
        nowIndicator
        firstDay={1}
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

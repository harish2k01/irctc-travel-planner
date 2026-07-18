import { AlertTriangle, CalendarClock, CheckCircle2, Ticket } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dateInTimeZone, daysBetween, todayInTimeZone } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const today = todayInTimeZone(user.timeZone);
  const [tickets, holidays] = await Promise.all([
    prisma.ticketPlan.findMany({ where: { userId: user.id, status: { in: ["PLANNED", "BOOKED"] } }, orderBy: { travelDate: "asc" }, take: 200 }),
    prisma.holiday.findMany({ where: { userId: user.id, date: { gte: new Date(`${today}T00:00:00.000Z`) } }, orderBy: { date: "asc" }, take: 6 }),
  ]);
  const planned = tickets.filter((ticket) => ticket.status === "PLANNED");
  const booked = tickets.filter((ticket) => ticket.status === "BOOKED");
  const bookToday = planned.filter((ticket) => daysBetween(today, dateInTimeZone(ticket.bookingOpensAt, user.timeZone)) <= 0);
  const openingSoon = planned.filter((ticket) => {
    const days = daysBetween(today, dateInTimeZone(ticket.bookingOpensAt, user.timeZone));
    return days > 0 && days <= 7;
  });

  return (
    <div className="grid gap-3">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Ticket summary">
        <Metric icon={AlertTriangle} label="Book now" value={bookToday.length} tone="red" />
        <Metric icon={CalendarClock} label="Opening soon" value={openingSoon.length} tone="amber" />
        <Metric icon={Ticket} label="Tickets to book" value={planned.length} tone="blue" />
        <Metric icon={CheckCircle2} label="Booked tickets" value={booked.length} tone="green" />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,.6fr)]">
        <section className="rounded-md border border-slate-200 bg-white">
          <header className="flex h-11 items-center justify-between border-b border-slate-200 px-3"><h2 className="text-sm font-semibold">Next actions</h2><Link href="/tracker" className="text-xs font-medium text-blue-700">View tracker</Link></header>
          <div className="divide-y divide-slate-100">
            {[...bookToday, ...openingSoon, ...planned.filter((ticket) => !bookToday.includes(ticket) && !openingSoon.includes(ticket))].slice(0, 8).map((ticket) => {
              const openDate = dateInTimeZone(ticket.bookingOpensAt, user.timeZone);
              return <Link key={ticket.id} href={`/tracker?ticket=${ticket.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 hover:bg-slate-50"><span className="min-w-0"><strong className="block truncate text-sm">{ticket.sourceCode} to {ticket.destinationCode}</strong><span className="text-xs text-slate-500">Travel {formatDate(ticket.travelDate.toISOString().slice(0, 10))}</span></span><span className="text-right"><span className="block text-xs text-slate-500">Book</span><strong className="text-sm">{formatDate(openDate)}</strong></span></Link>;
            })}
            {planned.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">No tickets need booking.</p>}
          </div>
        </section>

        <div className="grid content-start gap-3">
          <section className="rounded-md border border-slate-200 bg-white">
            <header className="flex h-11 items-center justify-between border-b border-slate-200 px-3"><h2 className="text-sm font-semibold">Booked</h2><span className="text-xs text-slate-500">{booked.length} total</span></header>
            <div className="divide-y divide-slate-100">
              {booked.slice(0, 5).map((ticket) => <Link key={ticket.id} href={`/tracker?ticket=${ticket.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-slate-50"><strong>{ticket.sourceCode} to {ticket.destinationCode}</strong><span className="text-slate-500">{formatDate(ticket.travelDate.toISOString().slice(0, 10))}</span></Link>)}
              {booked.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No booked PNRs yet.</p>}
            </div>
          </section>
          <section className="rounded-md border border-slate-200 bg-white">
            <header className="flex h-11 items-center justify-between border-b border-slate-200 px-3"><h2 className="text-sm font-semibold">Upcoming leave</h2><Link href="/holidays" className="text-xs font-medium text-blue-700">Manage</Link></header>
            <div className="divide-y divide-slate-100">
              {holidays.map((holiday) => <div key={holiday.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"><span><strong className="block">{holiday.name}</strong><span className="text-xs text-slate-500">{holiday.type === "PERSONAL_LEAVE" ? "Personal leave" : "Company"}</span></span><span className="text-slate-600">{formatDate(holiday.date.toISOString().slice(0, 10))}</span></div>)}
              {holidays.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No upcoming leave.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "red" | "amber" | "blue" | "green" }) {
  const tones = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700" };
  return <article className="flex min-h-20 items-center gap-3 rounded-md border border-slate-200 bg-white p-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${tones[tone]}`}><Icon className="h-4 w-4" /></span><span><span className="block text-xs font-medium text-slate-500">{label}</span><strong className="text-xl">{value}</strong></span></article>;
}

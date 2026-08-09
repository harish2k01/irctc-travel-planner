import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar-view";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { serializeTicket } from "@/lib/tickets";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const [tickets, holidays, settings] = await Promise.all([
    prisma.ticketPlan.findMany({ where: { userId: user.id, status: { not: "ARCHIVED" } }, include: { pnrSnapshot: true }, orderBy: { travelDate: "asc" }, take: 1_000 }),
    prisma.holiday.findMany({ where: { userId: user.id }, orderBy: { date: "asc" }, take: 1_000 }),
    getAppSettings(),
  ]);
  return <CalendarView tickets={tickets.map(serializeTicket)} holidays={holidays.map((holiday) => ({ id: holiday.id, name: holiday.name, date: holiday.date.toISOString().slice(0, 10), type: holiday.type }))} timeZone={user.timeZone} weekStartsOn={settings.calendarWeekStartsOn === 1 ? 1 : 0} />;
}

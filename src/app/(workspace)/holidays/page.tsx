import { redirect } from "next/navigation";
import { HolidayWorkspace } from "@/components/holiday-workspace";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeTicket } from "@/lib/tickets";

export default async function HolidaysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const [ticketRows, holidayRows, weekendDays] = await Promise.all([
    prisma.ticketPlan.findMany({ where: { userId: user.id, status: { not: "ARCHIVED" } }, include: { pnrSnapshot: true }, orderBy: { travelDate: "asc" }, take: 1_000 }),
    prisma.holiday.findMany({ where: { userId: user.id }, orderBy: { date: "asc" }, take: 1_000 }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { weekendDays: true } }).then((value) => value.weekendDays),
  ]);
  const tickets = ticketRows.map(serializeTicket);
  const holidays = holidayRows.map((holiday) => ({ id: holiday.id, name: holiday.name, date: holiday.date.toISOString().slice(0, 10), type: holiday.type }));
  return <HolidayWorkspace initialHolidays={holidays} tickets={tickets} timeZone={user.timeZone} weekendDays={weekendDays} />;
}

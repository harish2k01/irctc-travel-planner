import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInTimeZone } from "@/lib/dates";
import { jsonData, routeError } from "@/lib/http";
import { serializeTicket } from "@/lib/tickets";
import { tripWhere } from "@/lib/workspace-query";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const today = todayInTimeZone();
    const now = new Date();
    const planned = tripWhere(user.id, "planned", today);
    const attentionWhere = { ...planned, bookingOpensAt: { lte: now } };
    const [attention, attentionCount, upcoming, nextTrip, holidays] = await Promise.all([
      prisma.ticketPlan.findMany({ where: attentionWhere, include: { pnrSnapshot: true }, orderBy: [{ travelDate: "asc" }, { id: "asc" }], take: 5 }),
      prisma.ticketPlan.count({ where: attentionWhere }),
      prisma.ticketPlan.findMany({ where: { ...planned, bookingOpensAt: { gt: now } }, include: { pnrSnapshot: true }, orderBy: [{ bookingOpensAt: "asc" }, { id: "asc" }], take: 5 }),
      prisma.ticketPlan.findFirst({ where: tripWhere(user.id, "booked", today), include: { pnrSnapshot: true }, orderBy: { travelDate: "asc" } }),
      prisma.holiday.findMany({ where: { userId: user.id, date: { gte: new Date(today) } }, orderBy: { date: "asc" }, take: 5 }),
    ]);
    return jsonData({ today, attention: attention.map(serializeTicket), attentionCount, upcoming: upcoming.map(serializeTicket), nextTrip: nextTrip ? serializeTicket(nextTrip) : null,
      holidays: holidays.map((item) => ({ id: item.id, name: item.name, date: item.date.toISOString().slice(0, 10), type: item.type })) });
  } catch (error) { return routeError(error, request); }
}

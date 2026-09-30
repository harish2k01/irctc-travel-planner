import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateOnly } from "@/lib/api-schemas";
import { ApiError, jsonData, routeError } from "@/lib/http";
import { serializeTicket } from "@/lib/tickets";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const parsed = z.object({ start: dateOnly, end: dateOnly }).safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(400, "Select a calendar range.", "VALIDATION_ERROR");
    const start = new Date(parsed.data.start), end = new Date(parsed.data.end);
    if (end <= start || +end - +start > 100 * 86400000) throw new ApiError(400, "Calendar range must be within 100 days.", "VALIDATION_ERROR");
    const [tickets, holidays] = await Promise.all([
      prisma.ticketPlan.findMany({ where: { userId: user.id, status: { not: "ARCHIVED" }, OR: [{ travelDate: { gte: start, lt: end } }, { status: "PLANNED", bookingOpensAt: { gte: start, lt: end } }] }, include: { pnrSnapshot: true }, orderBy: { travelDate: "asc" }, take: 1001 }),
      prisma.holiday.findMany({ where: { userId: user.id, date: { gte: start, lt: end } }, orderBy: { date: "asc" }, take: 1001 }),
    ]);
    return jsonData({ tickets: tickets.slice(0, 1000).map(serializeTicket), holidays: holidays.slice(0, 1000).map((item) => ({ id: item.id, name: item.name, date: item.date.toISOString().slice(0, 10), type: item.type })), truncated: tickets.length > 1000 || holidays.length > 1000 });
  } catch (error) { return routeError(error, request); }
}

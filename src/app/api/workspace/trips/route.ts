import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInTimeZone } from "@/lib/dates";
import { jsonData, routeError } from "@/lib/http";
import { serializeTicket } from "@/lib/tickets";
import { parseTripQuery, tripWhere } from "@/lib/workspace-query";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = parseTripQuery(request.url);
    const today = todayInTimeZone();
    const where = { ...tripWhere(user.id, query.view, today), ...(query.q ? { AND: [{ OR: [
      ...["sourceCode", "sourceName", "destinationCode", "destinationName", "notes"].map((field) => ({ [field]: { contains: query.q, mode: "insensitive" as const } })),
    ] }] } : {}) };
    const total = await prisma.ticketPlan.count({ where });
    const pageSize = 20;
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / pageSize)));
    const [rows, planned, booked, history] = await Promise.all([
      prisma.ticketPlan.findMany({ where, include: { pnrSnapshot: true },
        orderBy: [{ [query.sort === "booking" ? "bookingOpensAt" : "travelDate"]: query.view === "history" ? "desc" : "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize, take: pageSize }),
      ...["planned", "booked", "history"].map((view) => prisma.ticketPlan.count({ where: tripWhere(user.id, view, today) })),
    ]);
    return jsonData({ tickets: rows.map(serializeTicket), total, page, pageSize, counts: { planned, booked, history } });
  } catch (error) { return routeError(error, request); }
}

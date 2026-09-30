import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInTimeZone } from "@/lib/dates";
import { getAppSettings } from "@/lib/settings";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";

const updateSchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(), all: z.boolean().optional(),
  snoozeMinutes: z.union([z.literal(60), z.literal(1440)]).optional(),
}).refine((value) => value.all || value.ids?.length, "Select notifications.");

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new ApiError(400, "Invalid page.", "VALIDATION_ERROR");
    if (!(await getAppSettings()).reminderInAppEnabled) return jsonData({ page, unreadCount: 0, total: 0, items: [] });
    const now = new Date();
    const where: Prisma.ReminderDeliveryWhereInput = {
      userId: user.id, channel: "IN_APP", status: { in: ["SENT", "READ"] },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      schedule: { cancelledAt: null, ticket: { status: "PLANNED", reminderInAppEnabled: true, travelDate: { gte: new Date(todayInTimeZone()) } } },
    };
    const [rows, unreadCount, total] = await Promise.all([
      prisma.reminderDelivery.findMany({ where, include: { schedule: { include: { ticket: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20 }),
      prisma.reminderDelivery.count({ where: { ...where, status: "SENT" } }),
      prisma.reminderDelivery.count({ where }),
    ]);
    return jsonData({ page, unreadCount, total, items: rows.map((row) => ({
      id: row.id, ticketId: row.schedule.ticketId,
      route: `${row.schedule.ticket.sourceName || row.schedule.ticket.sourceCode} to ${row.schedule.ticket.destinationName || row.schedule.ticket.destinationCode}`,
      type: row.schedule.type, dueAt: row.schedule.dueAt.toISOString(),
      travelDate: row.schedule.ticket.travelDate.toISOString().slice(0, 10),
      bookingOpensAt: row.schedule.ticket.bookingOpensAt.toISOString(), readAt: row.readAt?.toISOString(),
    })) });
  } catch (error) { return routeError(error, request); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = await parseJson(request, updateSchema);
    await prisma.reminderDelivery.updateMany({
      where: { userId: user.id, channel: "IN_APP", ...(input.all ? {} : { id: { in: input.ids } }), status: { in: ["SENT", "READ"] } },
      data: input.snoozeMinutes ? {
        status: "SENT", readAt: null, snoozedUntil: new Date(Date.now() + input.snoozeMinutes * 60000),
      } : { status: "READ", readAt: new Date(), snoozedUntil: null },
    });
    return jsonData({ ok: true });
  } catch (error) { return routeError(error, request); }
}

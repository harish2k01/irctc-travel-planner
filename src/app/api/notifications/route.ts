import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, jsonData, noStoreHeaders, parseJson, routeError } from "@/lib/http";
import type { NotificationItem } from "@/lib/types";

const updateSchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(),
  all: z.boolean().optional(),
}).refine((value) => value.all || value.ids?.length, "Select one or more notifications.");

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const rows = await prisma.reminderDelivery.findMany({
      where: { userId: user.id, channel: "IN_APP", status: { in: ["SENT", "READ"] } },
      include: { schedule: { include: { ticket: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const data: NotificationItem[] = rows.map((row) => ({
      id: row.id,
      ticketId: row.schedule.ticketId,
      route: `${row.schedule.ticket.sourceCode} to ${row.schedule.ticket.destinationCode}`,
      type: row.schedule.type,
      dueAt: row.schedule.dueAt.toISOString(),
      travelDate: row.schedule.ticket.travelDate.toISOString().slice(0, 10),
      bookingOpensAt: row.schedule.ticket.bookingOpensAt.toISOString(),
      readAt: row.readAt?.toISOString(),
    }));
    return Response.json(
      { data, unreadCount: data.filter((item) => !item.readAt).length },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return routeError(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = await parseJson(request, updateSchema);
    await prisma.reminderDelivery.updateMany({
      where: {
        userId: user.id,
        channel: "IN_APP",
        ...(input.all ? {} : { id: { in: input.ids } }),
        status: "SENT",
      },
      data: { status: "READ", readAt: new Date() },
    });
    return jsonData({ ok: true });
  } catch (error) {
    return routeError(error, request);
  }
}

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createTicketSchema } from "@/lib/api-schemas";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, noStoreHeaders, parseJson, routeError } from "@/lib/http";
import { syncTicketPnr } from "@/lib/pnr-sync";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getAppSettings, resolvePnrConfiguration } from "@/lib/settings";
import { serializeTicket, syncReminderSchedules, ticketBookingInstant } from "@/lib/tickets";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const status = url.searchParams.get("status");
    if (status && !["PLANNED", "BOOKED", "ARCHIVED"].includes(status)) {
      throw new ApiError(400, "Unknown ticket status.", "VALIDATION_ERROR");
    }

    const rows = await prisma.ticketPlan.findMany({
      where: { userId: user.id, ...(status ? { status: status as "PLANNED" | "BOOKED" | "ARCHIVED" } : {}) },
      include: { pnrSnapshot: true },
      orderBy: [{ travelDate: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(serializeTicket);
    return NextResponse.json(
      { data, pagination: { nextCursor: hasMore ? data.at(-1)?.id : null, hasMore } },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return routeError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, "ticket:create", 30, 60_000, user.id);
    const input = await parseJson(request, createTicketSchema);
    const settings = await getAppSettings();
    const pnr = typeof input.pnr === "string" && input.pnr ? input.pnr : undefined;
    const bookingOpensAt = ticketBookingInstant({
      travelDate: input.travelDate,
      bookingWindowDays: settings.bookingWindowDays,
      bookingOpenHour: settings.bookingOpenHour,
      bookingOpenMinute: settings.bookingOpenMinute,
      timeZone: user.timeZone,
    });

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticketPlan.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          sourceCode: input.sourceCode,
          sourceName: input.sourceName,
          destinationCode: input.destinationCode,
          destinationName: input.destinationName,
          travelDate: new Date(`${input.travelDate}T00:00:00.000Z`),
          bookingOpensAt,
          notes: input.notes,
          pnrEncrypted: pnr ? encryptSecret(pnr) : undefined,
          pnrLast4: pnr?.slice(-4),
          status: pnr ? "BOOKED" : "PLANNED",
          reminderEmailEnabled: settings.reminderEmailEnabled && (input.reminderEmailEnabled ?? settings.reminderEmailEnabled),
          reminderDiscordEnabled: settings.reminderDiscordEnabled && (input.reminderDiscordEnabled ?? settings.reminderDiscordEnabled),
          reminderInAppEnabled: settings.reminderInAppEnabled && (input.reminderInAppEnabled ?? settings.reminderInAppEnabled),
        },
      });
      await syncReminderSchedules(tx, created, settings);
      return created;
    });

    let warning: string | undefined;
    if (pnr && resolvePnrConfiguration(settings).providerUrl) {
      try {
        await syncTicketPnr(ticket.id, user.id);
      } catch {
        warning = "The ticket was saved, but PNR details could not be synced yet.";
      }
    }
    const saved = await prisma.ticketPlan.findUniqueOrThrow({ where: { id: ticket.id }, include: { pnrSnapshot: true } });
    await writeAudit({ actorId: user.id, action: "ticket.created", targetType: "TicketPlan", targetId: ticket.id, request });
    return NextResponse.json({ data: serializeTicket(saved), warning }, { status: 201 });
  } catch (error) {
    return routeError(error, request);
  }
}

import { updateTicketSchema } from "@/lib/api-schemas";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { syncTicketPnr } from "@/lib/pnr-sync";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getAppSettings, resolvePnrConfiguration } from "@/lib/settings";
import { serializeTicket, syncReminderSchedules, ticketBookingInstant } from "@/lib/tickets";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, "ticket:update", 60, 60_000, user.id);
    const { id } = await params;
    const input = await parseJson(request, updateTicketSchema);
    const settings = await getAppSettings();
    const existing = await prisma.ticketPlan.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new ApiError(404, "Ticket not found.", "NOT_FOUND");

    const pnrProvided = Object.prototype.hasOwnProperty.call(input, "pnr");
    const nextPnr = typeof input.pnr === "string" && input.pnr ? input.pnr : undefined;
    const travelDate = input.travelDate ?? existing.travelDate.toISOString().slice(0, 10);
    const bookingOpensAt = input.travelDate
      ? ticketBookingInstant({
          travelDate,
          bookingWindowDays: settings.bookingWindowDays,
          bookingOpenHour: settings.bookingOpenHour,
          bookingOpenMinute: settings.bookingOpenMinute,
          timeZone: user.timeZone,
        })
      : existing.bookingOpensAt;

    await prisma.$transaction(async (tx) => {
      const result = await tx.ticketPlan.updateMany({
        where: { id, userId: user.id, version: input.version },
        data: {
          sourceCode: input.sourceCode,
          sourceName: input.sourceName,
          destinationCode: input.destinationCode,
          destinationName: input.destinationName,
          travelDate: input.travelDate ? new Date(`${input.travelDate}T00:00:00.000Z`) : undefined,
          bookingOpensAt,
          notes: input.notes,
          status: pnrProvided ? (nextPnr ? "BOOKED" : "PLANNED") : input.status,
          pnrEncrypted: pnrProvided ? (nextPnr ? encryptSecret(nextPnr) : null) : undefined,
          pnrLast4: pnrProvided ? nextPnr?.slice(-4) ?? null : undefined,
          reminderEmailEnabled: input.reminderEmailEnabled === undefined
            ? undefined
            : settings.reminderEmailEnabled && input.reminderEmailEnabled,
          reminderDiscordEnabled: input.reminderDiscordEnabled === undefined
            ? undefined
            : settings.reminderDiscordEnabled && input.reminderDiscordEnabled,
          reminderInAppEnabled: input.reminderInAppEnabled === undefined
            ? undefined
            : settings.reminderInAppEnabled && input.reminderInAppEnabled,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ApiError(409, "This ticket changed in another session. Reload and try again.", "VERSION_CONFLICT");
      if (pnrProvided && !nextPnr) await tx.pnrSnapshot.deleteMany({ where: { ticketId: id } });
      const updated = await tx.ticketPlan.findUniqueOrThrow({ where: { id } });
      if (
        input.travelDate !== undefined
        || input.status !== undefined
        || pnrProvided
        || input.reminderEmailEnabled !== undefined
        || input.reminderDiscordEnabled !== undefined
        || input.reminderInAppEnabled !== undefined
      ) {
        await syncReminderSchedules(tx, updated, settings);
      }
    });

    let warning: string | undefined;
    if (nextPnr && resolvePnrConfiguration(settings).providerUrl) {
      try {
        await syncTicketPnr(id, user.id);
      } catch {
        warning = "The PNR was tagged, but provider details could not be refreshed.";
      }
    }
    const saved = await prisma.ticketPlan.findUniqueOrThrow({ where: { id }, include: { pnrSnapshot: true } });
    await writeAudit({ actorId: user.id, action: "ticket.updated", targetType: "TicketPlan", targetId: id, request });
    return jsonData({ ticket: serializeTicket(saved), warning });
  } catch (error) {
    return routeError(error, request);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const result = await prisma.ticketPlan.deleteMany({ where: { id, userId: user.id } });
    if (result.count !== 1) throw new ApiError(404, "Ticket not found.", "NOT_FOUND");
    await writeAudit({ actorId: user.id, action: "ticket.deleted", targetType: "TicketPlan", targetId: id, request });
    return jsonData({ id });
  } catch (error) {
    return routeError(error, request);
  }
}

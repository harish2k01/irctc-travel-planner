import { randomUUID } from "crypto";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { lookupPnr } from "@/lib/pnr-provider";
import { getAppSettings, resolvePnrConfiguration } from "@/lib/settings";
import { todayInTimeZone } from "@/lib/dates";

export async function syncTicketPnr(ticketId: string, userId: string) {
  const ticket = await prisma.ticketPlan.findFirst({ where: { id: ticketId, userId } });
  const pnr = decryptSecret(ticket?.pnrEncrypted);
  if (!ticket || !pnr) return null;
  const settings = await getAppSettings();
  const nextSyncAt = new Date(Date.now() + settings.pnrSyncIntervalMinutes * 60000);
  try {
    const result = await lookupPnr(pnr);
    await prisma.$transaction(async (tx) => {
      // Ignore a lookup that finished after the user changed or removed this PNR.
      const current = await tx.ticketPlan.updateMany({
        where: { id: ticket.id, userId, pnrEncrypted: ticket.pnrEncrypted },
        data: { pnrLastError: null, pnrNextSyncAt: nextSyncAt },
      });
      if (!current.count) return;
      const data = {
        provider: "configured-provider", trainNumber: result.trainNumber ?? null, trainName: result.trainName ?? null,
        bookedClass: result.bookedClass ?? null, providerStatus: result.providerStatus ?? null,
        coach: result.coach ?? null, seat: result.seat ?? null, syncedAt: new Date(), nextSyncAt,
      };
      await tx.pnrSnapshot.upsert({ where: { ticketId }, update: data, create: { id: randomUUID(), ticketId, ...data } });
    });
    return result;
  } catch {
    await prisma.ticketPlan.updateMany({
      where: { id: ticketId, userId, pnrEncrypted: ticket.pnrEncrypted },
      data: { pnrNextSyncAt: nextSyncAt, pnrLastError: "The provider could not refresh this PNR. Your trip and booking reference are saved." },
    });
    throw new Error("PNR refresh failed. Your saved trip has not changed.");
  }
}

export async function syncDuePnrs() {
  const settings = await getAppSettings();
  if (!settings.pnrAutoSyncEnabled || !resolvePnrConfiguration(settings).providerUrl) return { attempted: 0, synced: 0 };
  const now = new Date();
  const tickets = await prisma.ticketPlan.findMany({
    where: {
      pnrEncrypted: { not: null }, status: "BOOKED", travelDate: { gte: new Date(todayInTimeZone()) }, user: { isActive: true },
      OR: [{ pnrNextSyncAt: null }, { pnrNextSyncAt: { lte: now } }],
    }, orderBy: { pnrNextSyncAt: { sort: "asc", nulls: "first" } }, take: 25,
  });
  let synced = 0;
  for (const ticket of tickets) {
    const claim = await prisma.ticketPlan.updateMany({
      where: { id: ticket.id, pnrNextSyncAt: ticket.pnrNextSyncAt },
      data: { pnrNextSyncAt: new Date(Date.now() + settings.pnrSyncIntervalMinutes * 60000) },
    });
    if (!claim.count) continue;
    try { await syncTicketPnr(ticket.id, ticket.userId); synced++; } catch { /* Retry time and safe error are persisted by the lookup. */ }
  }
  return { attempted: tickets.length, synced };
}

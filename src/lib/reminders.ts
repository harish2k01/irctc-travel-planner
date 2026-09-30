import { randomUUID } from "crypto";
import type { NotificationChannel, Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { todayInTimeZone } from "@/lib/dates";
import { sendReminderEmail } from "@/lib/mail";
import { getDeliveryConfiguration } from "@/lib/settings";
import { decryptSecret } from "@/lib/crypto";
import { sendDiscordMessage } from "@/lib/delivery";
import { logger } from "@/lib/logger";

type Schedule = Prisma.ReminderScheduleGetPayload<{ include: { ticket: { include: { user: true } } } }>;
type Config = Awaited<ReturnType<typeof getDeliveryConfiguration>>;

export function eligibleChannels(schedule: Schedule, config: Config, today: string): NotificationChannel[] {
  const ticket = schedule.ticket;
  if (schedule.cancelledAt || schedule.revision !== ticket.scheduleRevision || !ticket.user.isActive
    || ticket.status !== "PLANNED" || !ticket.remindersEnabled || ticket.travelDate.toISOString().slice(0, 10) < today) return [];
  const timingEnabled = schedule.type === "SEVEN_DAYS_BEFORE" ? config.reminderSevenDaysEnabled
    : schedule.type === "ONE_DAY_BEFORE" ? config.reminderOneDayEnabled : config.reminderBookingOpenEnabled;
  if (!timingEnabled) return [];
  const channels: NotificationChannel[] = [];
  if (config.reminderEmailEnabled && ticket.reminderEmailEnabled) channels.push("EMAIL");
  if (config.reminderDiscordEnabled && ticket.reminderDiscordEnabled) channels.push("DISCORD");
  if (config.reminderInAppEnabled && ticket.reminderInAppEnabled) channels.push("IN_APP");
  return channels;
}

export async function queueDueReminders(now = new Date()) {
  const today = formatInTimeZone(now, "Asia/Kolkata", "yyyy-MM-dd");
  const config = await getDeliveryConfiguration();
  const schedules = await prisma.reminderSchedule.findMany({
    where: { processedAt: null, cancelledAt: null, dueAt: { lte: now } },
    orderBy: { dueAt: "asc" }, take: 100,
  });
  for (const candidate of schedules) {
    await prisma.$transaction(async (tx) => {
      // Serialize queue creation with trip edits and cancellation.
      await tx.$queryRaw`SELECT id FROM "Journey" WHERE id = ${candidate.ticketId} FOR UPDATE`;
      const schedule = await tx.reminderSchedule.findUnique({ where: { id: candidate.id }, include: { ticket: { include: { user: true } } } });
      if (!schedule || schedule.processedAt || schedule.cancelledAt) return;
      const stale = schedule.type !== "BOOKING_OPEN" && (schedule.dueAt.getTime() < now.getTime() - 86400000 || schedule.ticket.bookingOpensAt <= now);
      const channels = stale ? [] : eligibleChannels(schedule, config, today);
      await tx.reminderDelivery.createMany({ data: channels.map((channel) => ({
        id: randomUUID(), scheduleId: schedule.id, userId: schedule.ticket.userId, channel,
        status: channel === "IN_APP" ? "SENT" : "PENDING", sentAt: channel === "IN_APP" ? now : null,
      })), skipDuplicates: true });
      await tx.reminderSchedule.update({ where: { id: schedule.id }, data: { processedAt: now } });
    });
  }
  return schedules.length;
}

export async function deliverQueuedReminders(now = new Date()) {
  const available: Prisma.ReminderDeliveryWhereInput = {
    channel: { in: ["EMAIL", "DISCORD"] }, attemptCount: { lt: 5 },
    OR: [{ status: "PENDING" }, { status: "FAILED", nextAttemptAt: { lte: now } }, { status: "SENDING", leaseExpiresAt: { lte: now } }],
  };
  const candidates = await prisma.reminderDelivery.findMany({ where: available, orderBy: { createdAt: "asc" }, take: 50 });
  const config = await getDeliveryConfiguration();
  let delivered = 0;
  for (const candidate of candidates) {
    const leaseToken = randomUUID();
    const claim = await prisma.reminderDelivery.updateMany({ where: { id: candidate.id, ...available }, data: {
      status: "SENDING", leaseToken, leaseExpiresAt: new Date(Date.now() + 120000), attemptCount: { increment: 1 }, nextAttemptAt: null,
    } });
    if (!claim.count) continue;
    const delivery = await prisma.reminderDelivery.findUnique({ where: { id: candidate.id }, include: { schedule: { include: { ticket: { include: { user: true } } } } } });
    if (!delivery || delivery.leaseToken !== leaseToken) continue;
    const schedule = delivery.schedule;
    const ticket = schedule.ticket;
    if (!eligibleChannels(schedule, config, todayInTimeZone()).includes(delivery.channel)) {
      await prisma.reminderDelivery.updateMany({ where: { id: delivery.id, leaseToken }, data: { status: "CANCELLED", leaseToken: null, leaseExpiresAt: null } });
      continue;
    }
    const route = `${ticket.sourceName || ticket.sourceCode} to ${ticket.destinationName || ticket.destinationCode}`;
    const travelDate = formatInTimeZone(ticket.travelDate, "UTC", "dd MMM yyyy");
    const bookingDate = formatInTimeZone(ticket.bookingOpensAt, "Asia/Kolkata", "dd MMM yyyy, HH:mm 'IST'");
    const message = `Booking ${ticket.bookingOpensAt <= now ? "opened" : "opens"} on ${bookingDate} for ${route}, travelling ${travelDate}.`;
    try {
      if (delivery.channel === "EMAIL") {
        const result = await sendReminderEmail({ email: ticket.user.email, route, travelDate, bookingDate, message, ticketId: ticket.id });
        if (!result.sent) throw new Error("Email not configured");
      } else {
        // A workspace webhook belongs to its administrator, never to other users.
        const webhook = decryptSecret(ticket.user.discordWebhookUrl) ?? (ticket.user.role === "ADMIN" ? config.discordWebhookUrl : undefined);
        if (!webhook) throw new Error("Discord not configured");
        await sendDiscordMessage(webhook, message);
      }
      const completed = await prisma.reminderDelivery.updateMany({ where: { id: delivery.id, leaseToken, status: "SENDING" }, data: {
        status: "SENT", sentAt: new Date(), lastError: null, leaseToken: null, leaseExpiresAt: null,
      } });
      delivered += completed.count;
    } catch {
      await prisma.reminderDelivery.updateMany({ where: { id: delivery.id, leaseToken, status: "SENDING" }, data: {
        status: "FAILED", lastError: "Delivery was not accepted. Check the destination and service configuration.",
        leaseToken: null, leaseExpiresAt: null,
        nextAttemptAt: delivery.attemptCount >= 5 ? null : new Date(Date.now() + Math.min(60, 2 ** delivery.attemptCount) * 60000),
      } });
      logger.warn("reminder.delivery_failed", { deliveryId: delivery.id, channel: delivery.channel, attempts: delivery.attemptCount });
    }
  }
  await prisma.reminderDelivery.updateMany({ where: { status: "SENDING", attemptCount: { gte: 5 }, leaseExpiresAt: { lte: now } }, data: {
    status: "FAILED", lastError: "Delivery could not be confirmed after repeated attempts.", leaseToken: null, leaseExpiresAt: null, nextAttemptAt: null,
  } });
  return { attempted: candidates.length, delivered };
}

export async function processReminders() {
  const now = new Date();
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.accountToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * 86400000) } } }),
    prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 86400000) } } }),
  ]);
  const queued = await queueDueReminders(now);
  return { queued, ...await deliverQueuedReminders(now) };
}

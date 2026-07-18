import { randomUUID } from "crypto";
import type { NotificationChannel, ReminderType } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/mail";
import { getDeliveryConfiguration } from "@/lib/settings";
import { logger } from "@/lib/logger";

function reminderMessage(type: ReminderType, route: string) {
  if (type === "SEVEN_DAYS_BEFORE") return `Booking opens in 7 days for ${route}.`;
  if (type === "ONE_DAY_BEFORE") return `Booking opens tomorrow for ${route}.`;
  return `Booking is open for ${route}.`;
}

export async function queueDueReminders(now = new Date()) {
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.reminderSchedule.updateMany({
    where: { processedAt: null, dueAt: { lt: staleThreshold } },
    data: { processedAt: now },
  });
  const schedules = await prisma.reminderSchedule.findMany({
    where: { processedAt: null, dueAt: { lte: now, gte: staleThreshold } },
    include: { ticket: true },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
  const settings = await getDeliveryConfiguration();

  for (const schedule of schedules) {
    const typeEnabled = schedule.type === "SEVEN_DAYS_BEFORE"
      ? settings.reminderSevenDaysEnabled
      : schedule.type === "ONE_DAY_BEFORE"
        ? settings.reminderOneDayEnabled
        : settings.reminderBookingOpenEnabled;
    const channels: NotificationChannel[] = [];
    if (typeEnabled && settings.reminderEmailEnabled && schedule.ticket.reminderEmailEnabled) channels.push("EMAIL");
    if (typeEnabled && settings.reminderDiscordEnabled && schedule.ticket.reminderDiscordEnabled) channels.push("DISCORD");
    if (typeEnabled && settings.reminderInAppEnabled && schedule.ticket.reminderInAppEnabled) channels.push("IN_APP");

    await prisma.$transaction(async (tx) => {
      if (channels.length) {
        await tx.reminderDelivery.createMany({
          data: channels.map((channel) => ({
            id: randomUUID(),
            scheduleId: schedule.id,
            userId: schedule.ticket.userId,
            channel,
            status: channel === "IN_APP" ? "SENT" : "PENDING",
            sentAt: channel === "IN_APP" ? now : undefined,
          })),
          skipDuplicates: true,
        });
      }
      await tx.reminderSchedule.update({ where: { id: schedule.id }, data: { processedAt: now } });
    });
  }
  return schedules.length;
}

export async function deliverQueuedReminders(now = new Date()) {
  const candidates = await prisma.reminderDelivery.findMany({
    where: {
      channel: { in: ["EMAIL", "DISCORD"] },
      OR: [
        { status: "PENDING" },
        { status: "FAILED", nextAttemptAt: { lte: now } },
      ],
    },
    include: { schedule: { include: { ticket: { include: { user: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const config = await getDeliveryConfiguration();
  let delivered = 0;

  for (const delivery of candidates) {
    const claimed = await prisma.reminderDelivery.updateMany({
      where: { id: delivery.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SENDING", attemptCount: { increment: 1 }, nextAttemptAt: null },
    });
    if (claimed.count !== 1) continue;

    const ticket = delivery.schedule.ticket;
    const route = `${ticket.sourceCode} to ${ticket.destinationCode}`;
    const message = reminderMessage(delivery.schedule.type, route);
    const timeZone = ticket.user.timeZone;
    const travelDate = formatInTimeZone(ticket.travelDate, "UTC", "dd MMM yyyy");
    const bookingDate = formatInTimeZone(ticket.bookingOpensAt, timeZone, "dd MMM yyyy, HH:mm zzz");

    try {
      if (delivery.channel === "EMAIL") {
        const result = await sendReminderEmail({ email: ticket.user.email, route, travelDate, bookingDate, message });
        if (!result.sent) throw new Error(result.reason);
      } else {
        if (!config.discordWebhookUrl) throw new Error("Discord delivery is not configured.");
        const response = await fetch(config.discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `**${message}**\nTravel: ${travelDate}\nBooking: ${bookingDate}` }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
      }

      await prisma.reminderDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      delivered += 1;
    } catch (error) {
      const attempts = delivery.attemptCount + 1;
      const retryMinutes = Math.min(60, 2 ** attempts);
      await prisma.reminderDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed.",
          nextAttemptAt: attempts >= 5 ? null : new Date(Date.now() + retryMinutes * 60_000),
        },
      });
      logger.warn("reminder.delivery_failed", { deliveryId: delivery.id, channel: delivery.channel, attempts });
    }
  }
  return { attempted: candidates.length, delivered };
}

export async function processReminders() {
  const now = new Date();
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.accountToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
  ]);
  const queued = await queueDueReminders();
  const delivery = await deliverQueuedReminders();
  return { queued, ...delivery };
}

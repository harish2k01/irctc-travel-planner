import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "./db";
import { syncReminderSchedules, ticketBookingInstant } from "./tickets";
import { deliverQueuedReminders, queueDueReminders } from "./reminders";
import { syncTicketPnr } from "./pnr-sync";
import { encryptSecret } from "./crypto";
import { addDays, todayInTimeZone } from "./dates";

const mocks = vi.hoisted(() => ({ email: vi.fn(), discord: vi.fn(), pnr: vi.fn() }));
vi.mock("./mail", () => ({ sendReminderEmail: mocks.email }));
vi.mock("./delivery", () => ({ sendDiscordMessage: mocks.discord }));
vi.mock("./pnr-provider", () => ({ lookupPnr: mocks.pnr }));

const enabled = process.env.RUN_DB_TESTS === "1";
const users: string[] = [];
const settings = { reminderSevenDaysEnabled: true, reminderOneDayEnabled: true, reminderBookingOpenEnabled: true };
const now = () => new Date();
async function fixture() {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@integration.invalid`, name: "Integration test" } });
  users.push(user.id);
  const ticket = await prisma.ticketPlan.create({ data: {
    userId: user.id, sourceCode: "MDU", destinationCode: "MS", travelDate: new Date(addDays(todayInTimeZone(), 60)),
    bookingOpensAt: new Date(Date.now() - 600000), reminderEmailEnabled: true, reminderInAppEnabled: true,
  } });
  await prisma.$transaction((tx) => syncReminderSchedules(tx, ticket, settings));
  return { user, ticket: await prisma.ticketPlan.findUniqueOrThrow({ where: { id: ticket.id } }) };
}
async function queued() {
  const value = await fixture();
  await queueDueReminders(now());
  return value;
}

describe.skipIf(!enabled)("isolated PostgreSQL workspace", () => {
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("Integration tests require an isolated database ending in _test.");
    await prisma.appSettings.upsert({ where: { id: "global" }, create: { id: "global" }, update: { ...settings, reminderEmailEnabled: true, reminderInAppEnabled: true, reminderDiscordEnabled: true } });
    mocks.email.mockResolvedValue({ sent: true }); mocks.discord.mockResolvedValue(undefined);
  });
  afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } }); mocks.email.mockClear(); mocks.discord.mockClear(); mocks.pnr.mockReset(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("computes railway opening in IST regardless of display timezone", () => {
    expect(ticketBookingInstant({ travelDate: "2026-12-01", bookingWindowDays: 60, bookingOpenHour: 8, bookingOpenMinute: 0, timeZone: "America/New_York" }).toISOString()).toBe("2026-10-02T02:30:00.000Z");
  });
  it("queues one catch-up notice, not obsolete 7-day and 1-day notices", async () => {
    const { ticket } = await queued();
    const rows = await prisma.reminderDelivery.findMany({ where: { schedule: { ticketId: ticket.id } }, include: { schedule: true } });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.schedule.type === "BOOKING_OPEN")).toBe(true);
  });
  it("does not duplicate a due schedule under concurrent workers", async () => {
    const { ticket } = await fixture();
    await Promise.all([queueDueReminders(now()), queueDueReminders(now())]);
    expect(await prisma.reminderDelivery.count({ where: { schedule: { ticketId: ticket.id } } })).toBe(2);
  });
  it("only one worker claims an external delivery", async () => {
    await queued();
    await Promise.all([deliverQueuedReminders(now()), deliverQueuedReminders(now())]);
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
  it("booking cancels pending delivery without requiring a PNR", async () => {
    const { ticket } = await queued();
    await prisma.$transaction(async (tx) => {
      const saved = await tx.ticketPlan.update({ where: { id: ticket.id }, data: { status: "BOOKED" } });
      await syncReminderSchedules(tx, saved, settings);
    });
    await deliverQueuedReminders(now());
    expect(mocks.email).not.toHaveBeenCalled();
    expect(await prisma.reminderDelivery.count({ where: { schedule: { ticketId: ticket.id }, status: "CANCELLED" } })).toBe(1);
  });
  it("a changed date creates fresh schedules and preserves prior read history", async () => {
    const { ticket } = await queued();
    const old = await prisma.reminderSchedule.findMany({ where: { ticketId: ticket.id } });
    await prisma.$transaction(async (tx) => {
      const saved = await tx.ticketPlan.update({ where: { id: ticket.id }, data: { bookingOpensAt: new Date(Date.now() + 86400000 * 10) } });
      await syncReminderSchedules(tx, saved, settings);
    });
    const active = await prisma.reminderSchedule.findMany({ where: { ticketId: ticket.id, cancelledAt: null } });
    expect(active).toHaveLength(3);
    expect(active.every((row) => !old.some((prior) => prior.id === row.id))).toBe(true);
    expect(await prisma.reminderDelivery.count({ where: { schedule: { ticketId: ticket.id }, channel: "IN_APP" } })).toBe(1);
  });
  it("channel edits do not replay an already delivered opening", async () => {
    const { ticket } = await queued();
    const old = await prisma.reminderSchedule.findMany({ where: { ticketId: ticket.id, cancelledAt: null } });
    await prisma.$transaction((tx) => syncReminderSchedules(tx, ticket, settings));
    await queueDueReminders(now());
    expect(await prisma.reminderSchedule.count({ where: { ticketId: ticket.id, cancelledAt: null } })).toBe(old.length);
    expect(await prisma.reminderDelivery.count({ where: { schedule: { ticketId: ticket.id } } })).toBe(2);
  });
  it("recovers an expired delivery lease", async () => {
    const { ticket } = await queued();
    await prisma.reminderDelivery.updateMany({ where: { schedule: { ticketId: ticket.id }, channel: "EMAIL" }, data: { status: "SENDING", attemptCount: 1, leaseToken: "abandoned", leaseExpiresAt: new Date(Date.now() - 1000) } });
    await deliverQueuedReminders(now());
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
  it("rechecks disabled accounts before delivery", async () => {
    const { user } = await queued();
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await deliverQueuedReminders(now());
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("a failed provider cannot overwrite the plan or manufacture a snapshot", async () => {
    const { user, ticket } = await fixture();
    await prisma.ticketPlan.update({ where: { id: ticket.id }, data: { pnrEncrypted: encryptSecret("1234567890"), pnrLast4: "7890", status: "BOOKED" } });
    mocks.pnr.mockRejectedValue(new Error("secret provider URL must never appear"));
    await expect(syncTicketPnr(ticket.id, user.id)).rejects.toThrow("PNR refresh failed");
    const saved = await prisma.ticketPlan.findUniqueOrThrow({ where: { id: ticket.id }, include: { pnrSnapshot: true } });
    expect(saved.pnrSnapshot).toBeNull(); expect(saved.pnrNextSyncAt).not.toBeNull(); expect(saved.sourceCode).toBe("MDU");
    expect(saved.pnrLastError).not.toContain("secret");
  });
  it("a successful PNR lookup preserves the user's itinerary", async () => {
    const { user, ticket } = await fixture();
    await prisma.ticketPlan.update({ where: { id: ticket.id }, data: { pnrEncrypted: encryptSecret("1234567890"), status: "BOOKED" } });
    mocks.pnr.mockResolvedValue({ sourceCode: "OTHER", travelDate: "2027-01-01", trainName: "Provider train", coach: "B2", seat: "12" });
    await syncTicketPnr(ticket.id, user.id);
    const saved = await prisma.ticketPlan.findUniqueOrThrow({ where: { id: ticket.id }, include: { pnrSnapshot: true } });
    expect(saved.sourceCode).toBe("MDU"); expect(saved.travelDate).toEqual(ticket.travelDate); expect(saved.pnrSnapshot?.seat).toBe("12");
  });
});

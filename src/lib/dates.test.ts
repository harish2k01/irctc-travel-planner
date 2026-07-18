import { describe, expect, it } from "vitest";
import { addDays, bookingOpenInstant, calculateBookingOpenDate, dateInTimeZone, daysBetween, reminderInstants } from "./dates";

describe("booking dates", () => {
  it("subtracts the configured booking window", () => {
    expect(calculateBookingOpenDate("2026-08-18", 60)).toBe("2026-06-19");
    expect(calculateBookingOpenDate("2026-08-18", 30)).toBe("2026-07-19");
  });

  it("handles month and leap-year boundaries", () => {
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("creates the configured booking instant in Asia/Kolkata", () => {
    expect(bookingOpenInstant("2026-08-18", 60, 8, 0, "Asia/Kolkata").toISOString()).toBe("2026-06-19T02:30:00.000Z");
  });

  it("creates all reminder instants relative to booking open", () => {
    const booking = new Date("2026-06-19T02:30:00.000Z");
    const reminders = reminderInstants(booking);
    expect(reminders.SEVEN_DAYS_BEFORE.toISOString()).toBe("2026-06-12T02:30:00.000Z");
    expect(reminders.ONE_DAY_BEFORE.toISOString()).toBe("2026-06-18T02:30:00.000Z");
    expect(reminders.BOOKING_OPEN).toBe(booking);
  });

  it("formats an instant in the user's timezone", () => {
    expect(dateInTimeZone("2026-06-18T20:00:00.000Z", "Asia/Kolkata")).toBe("2026-06-19");
  });

  it("compares date-only values without time drift", () => {
    expect(daysBetween("2026-06-19", "2026-06-26")).toBe(7);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingOpenInstant } from "@/lib/dates";
import { buildTravelSuggestions } from "@/lib/suggestions";
import type { Holiday, Ticket } from "@/lib/types";

const zone = "Asia/Kolkata";

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1",
    sourceCode: "MDU",
    destinationCode: "MS",
    travelDate: "2026-09-19",
    bookingOpensAt: bookingOpenInstant("2026-09-19", 60, 8, 0, zone).toISOString(),
    status: "PLANNED",
    pnrTagged: false,
    remindersEnabled: true,
    reminderEmailEnabled: true,
    reminderDiscordEnabled: false,
    reminderInAppEnabled: true,
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-19T06:30:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("travel suggestions", () => {
  it("identifies the exact ticket, route, travel date, and booking date", () => {
    const suggestions = buildTravelSuggestions([ticket()], [], zone);
    const booking = suggestions.find((item) => item.id === "window:ticket-1");
    expect(booking).toMatchObject({ ticketId: "ticket-1", title: "Booking window coming up" });
    expect(booking?.detail).toContain("MDU to MS");
    expect(booking?.detail).toContain("19 Sept 2026");
    expect(booking?.detail).toContain("21 Jul 2026");
  });

  it("detects leave-day booking windows and nearby leave", () => {
    const sundayTicket = ticket({ bookingOpensAt: bookingOpenInstant("2026-09-17", 60, 8, 0, zone).toISOString(), travelDate: "2026-09-17" });
    const holidays: Holiday[] = [{ id: "leave-1", name: "Personal leave", date: "2026-09-18", type: "PERSONAL_LEAVE" }];
    const suggestions = buildTravelSuggestions([sundayTicket], holidays, zone, [0, 6]);
    expect(suggestions.some((item) => item.id === "weekend:ticket-1" && item.ticketId === "ticket-1")).toBe(true);
    expect(suggestions.some((item) => item.id === "travel-leave:ticket-1:leave-1")).toBe(true);
  });

  it("warns about colliding booking windows and disabled reminder channels", () => {
    const first = ticket({ reminderEmailEnabled: false, reminderInAppEnabled: false });
    const second = ticket({ id: "ticket-2", sourceCode: "MS", destinationCode: "MDU" });
    const suggestions = buildTravelSuggestions([first, second], [], zone);
    expect(suggestions.some((item) => item.id === "no-reminders:ticket-1")).toBe(true);
    expect(suggestions.some((item) => item.id === "booking-clash:2026-07-21" && item.detail.startsWith("2 ticket plans"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { buildJourneyReminders, calculateBookingOpenDate, getBookingUrgency } from "./dates";
import type { Journey } from "./types";

const journey: Journey = {
  id: "test",
  routeId: "route",
  trainId: "12624",
  travelDate: "2026-08-18",
  bookingOpenDate: "2026-06-19",
  preferredClass: "3A",
  direction: "HOME_TO_OFFICE",
  recurrence: "WEEKLY",
  status: "PLANNED",
};

describe("IRCTC booking window logic", () => {
  it("calculates booking open date exactly 60 days before travel", () => {
    expect(calculateBookingOpenDate("2026-08-18")).toBe("2026-06-19");
  });

  it("creates the three expected reminders", () => {
    expect(buildJourneyReminders(journey).map((reminder) => reminder.dueDate)).toEqual([
      "2026-06-12",
      "2026-06-18",
      "2026-06-19",
    ]);
  });

  it("marks unbooked journeys as book today when the window is open", () => {
    expect(getBookingUrgency(journey, "2026-06-19")).toMatchObject({
      label: "Book Today",
      tone: "red",
    });
  });
});

import { expect, it } from "vitest";
import { groupTimeOff, stationLabel } from "./journey-display";

it("shortens imported station labels without guessing ordinary city names", () => {
  expect(stationLabel("MADURAI JN. - MDU")).toBe("MDU");
  expect(stationLabel("CHENNAI EGMORE - MS")).toBe("MS");
  expect(stationLabel("Chennai")).toBe("Chennai");
});

it("groups matching consecutive leave while preserving original day IDs and separating gaps/types", () => {
  const days = [{ id: "3", name: "PTO", date: "2026-11-04", type: "leave" as const }, { id: "1", name: "PTO", date: "2026-11-02", type: "leave" as const }, { id: "2", name: "PTO", date: "2026-11-03", type: "leave" as const }, { id: "4", name: "PTO", date: "2026-11-06", type: "leave" as const }, { id: "5", name: "PTO", date: "2026-11-07", type: "company" as const }];
  const groups = groupTimeOff(days);
  expect(groups).toHaveLength(3);
  expect(groups[0]).toMatchObject({ start: "2026-11-02", end: "2026-11-04" });
  expect(groups[0].days.map(day => day.id)).toEqual(["1", "2", "3"]);
  expect(days[0].id).toBe("3");
});

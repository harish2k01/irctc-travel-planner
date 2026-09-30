import { describe, expect, it } from "vitest";
import { normalizePnrPayload } from "./pnr-provider";

describe("PNR provider normalization", () => {
  it("normalizes nested provider responses", () => {
    expect(normalizePnrPayload({ data: { train: { number: "12624", name: "Chennai Mail" }, dateOfJourney: "25-08-2026", boardingStation: { code: "MDU", name: "Madurai" }, destinationStation: { code: "MS", name: "Chennai" }, passengers: [{ currentStatus: "CNF B2 31" }], class: "3A" } })).toMatchObject({
      trainNumber: "12624",
      trainName: "Chennai Mail",
      travelDate: "2026-08-25",
      sourceCode: "MDU",
      destinationCode: "MS",
      bookedClass: "3A",
      coach: "B2",
      seat: "31",
    });
  });

  it("does not invent unavailable train details", () => {
    expect(normalizePnrPayload({ status: "Chart not prepared" })).toEqual({ providerStatus: "Chart not prepared" });
  });

  it.each([{}, null, { data: {} }, { message: "No ticket found" }])("rejects an empty lookup result: %j", (payload) => {
    expect(() => normalizePnrPayload(payload)).toThrow("No PNR details were returned.");
  });

  it.each([{ success: false, data: { trainNumber: "12624" } }, { status: "error" }, { error: "Sensitive provider message" }, { data: { status: "PNR not found" } }])("rejects provider failures without exposing their message: %j", (payload) => {
    expect(() => normalizePnrPayload(payload)).toThrow("The PNR provider could not find valid ticket details.");
  });
});

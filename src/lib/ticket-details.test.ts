import { describe, expect, it } from "vitest";
import { parseTicketDetails } from "./ticket-details";
describe("ticket extraction suggestions", () => {
  it("reads labeled PDF text with separate train and optional allocation fields", () => {
    const details = parseTicketDetails("PNR No: 1234567890\nTrain No./Name: 12637 / PANDIAN EXP\nClass: 3A\nDate of Journey: 01/12/2026\nFrom: CHENNAI\nTo: MADURAI\nCoach: B1\nSeat No: 42\nBerth: LB\nDeparture Time: 21:30");
    expect(details).toEqual({ pnr: "1234567890", trainNumber: "12637", trainName: "PANDIAN EXP", travelClass: "3A", date: "2026-12-01", from: "CHENNAI", to: "MADURAI", coach: "B1", seat: "42", berth: "LB", departure: "21:30" });
  });
  it("reads understandable QR JSON aliases", () => {
    expect(parseTicketDetails(JSON.stringify({ PNR: 1234567890, trainNo: "12637", trainName: "Express", seatNo: 42, berthType: "Lower", journeyDate: "01-12-2026" }))).toMatchObject({ pnr: "1234567890", trainNumber: "12637", trainName: "Express", seat: "42", berth: "Lower", date: "2026-12-01" });
  });
  it("reads confirmed passenger allocations", () => { expect(parseTicketDetails("CNF/B1/42/LB")).toEqual({ coach: "B1", seat: "42", berth: "LB" }); });
  it("discards invalid critical values and handles opaque QR payloads", () => {
    expect(parseTicketDetails(JSON.stringify({ pnr: "123", date: "2026-02-30", departure: "25:10", trainNumber: "ABCD" }))).toEqual({});
    expect(parseTicketDetails("opaque-encrypted-QR-payload")).toEqual({});
  });
});

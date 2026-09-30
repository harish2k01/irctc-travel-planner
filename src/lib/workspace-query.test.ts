import { describe, expect, it } from "vitest";
import { parseTripQuery, tripWhere } from "./workspace-query";
import { createTicketSchema, updateTicketSchema } from "./api-schemas";
import { discordUrlSchema } from "./delivery";

describe("production trip queries", () => {
  it("defaults to future plans and excludes archived trips", () => {
    expect(parseTripQuery("https://app.test/api")).toEqual({ view: "planned", q: "", page: 1, sort: "travel" });
    expect(tripWhere("owner", "planned", "2026-09-26")).toMatchObject({ userId: "owner", status: "PLANNED", travelDate: { gte: new Date("2026-09-26") } });
  });
  it.each(["page=NaN", "page=-1", "page=1.5", "view=WAITLISTED", "sort=cost"])("rejects invalid filters %s", (query) => {
    expect(() => parseTripQuery(`https://app.test/api?${query}`)).toThrow();
  });
  it("never removes the ownership restriction for history", () => expect(tripWhere("owner", "history", "2026-09-26").userId).toBe("owner"));
});
describe("manual trip validation", () => {
  const input = { sourceCode: "MDU", destinationCode: "MS", travelDate: "2026-12-01" };
  it("accepts plans and return journeys without PNR", () => expect(createTicketSchema.parse({ ...input, returnDate: "2026-12-03" }).pnr).toBeUndefined());
  it("rejects impossible dates and reverse returns", () => {
    expect(createTicketSchema.safeParse({ ...input, travelDate: "2026-02-30" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...input, returnDate: "2026-11-30" }).success).toBe(false);
  });
  it("preserves empty optional fields to support clearing them", () => expect(updateTicketSchema.parse({ notes: "", version: 2 }).notes).toBe(""));
  it("allows explicit booking without a PNR", () => expect(updateTicketSchema.parse({ status: "BOOKED", version: 1 }).status).toBe("BOOKED"));
});
describe("Discord destination validation", () => {
  it("accepts a Discord webhook", () => expect(discordUrlSchema.safeParse("https://discord.com/api/webhooks/123456/token_abc-123").success).toBe(true));
  it.each(["http://discord.com/api/webhooks/123/token", "https://127.0.0.1/api/webhooks/123/token", "https://discord.com.evil.test/api/webhooks/123/token", "https://discord.com@evil.test/api/webhooks/123/token", "https://discord.com:8443/api/webhooks/123/token", "https://discord.com/api/webhooks/123/token?redirect=https://evil.test"])("rejects unsafe destination %s", (url) => expect(discordUrlSchema.safeParse(url).success).toBe(false));
});

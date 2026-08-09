import { describe, expect, it } from "vitest";
import { calendarWeekStartsOnSchema, createTicketSchema, passwordSchema } from "./api-schemas";

describe("ticket input", () => {
  it("accepts a ticket without a PNR and normalizes station codes", () => {
    const result = createTicketSchema.parse({ sourceCode: "mdu", destinationCode: "ms", travelDate: "2026-08-25" });
    expect(result).toMatchObject({ sourceCode: "MDU", destinationCode: "MS" });
    expect(result.pnr).toBeUndefined();
  });

  it("rejects the same source and destination", () => {
    expect(createTicketSchema.safeParse({ sourceCode: "MS", destinationCode: "MS", travelDate: "2026-08-25" }).success).toBe(false);
  });

  it("requires exactly ten digits when PNR is provided", () => {
    expect(createTicketSchema.safeParse({ sourceCode: "MDU", destinationCode: "MS", travelDate: "2026-08-25", pnr: "123" }).success).toBe(false);
  });
});

describe("password policy", () => {
  it("accepts a strong password", () => expect(passwordSchema.safeParse("Longer#Password9").success).toBe(true));
  it("rejects weak passwords", () => expect(passwordSchema.safeParse("password123").success).toBe(false));
});

describe("calendar week start", () => {
  it("accepts Sunday and Monday", () => {
    expect(calendarWeekStartsOnSchema.parse(0)).toBe(0);
    expect(calendarWeekStartsOnSchema.parse(1)).toBe(1);
  });

  it("rejects unsupported days", () => {
    expect(calendarWeekStartsOnSchema.safeParse(2).success).toBe(false);
  });
});

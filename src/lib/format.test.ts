import { describe, expect, it } from "vitest";
import { formatDate, formatInstant, routeName } from "@/lib/format";
import { cn } from "@/lib/utils";

describe("display formatting", () => {
  it("uses consistent date casing and locale", () => {
    expect(formatDate("2026-09-19")).toBe("19 Sept 2026");
    expect(formatInstant("2026-07-21T02:30:00.000Z", "Asia/Kolkata")).toMatch(/21 Jul 2026/);
  });

  it("formats routes and merges utility classes", () => {
    expect(routeName({ sourceCode: "MDU", destinationCode: "MS" })).toBe("MDU to MS");
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});

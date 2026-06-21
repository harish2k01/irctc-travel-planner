import { NextResponse } from "next/server";
import { z } from "zod";
import type { HolidayType } from "@/lib/types";

const importIcsSchema = z.object({
  url: z.string().url().optional(),
  icsText: z.string().min(1).optional(),
});

const holidayTypes: HolidayType[] = ["COMPANY", "PERSONAL_LEAVE"];

export async function POST(request: Request) {
  const parsed = importIcsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid ICS URL or pasted ICS text." }, { status: 400 });
  }

  let icsText = parsed.data.icsText;

  if (!icsText && parsed.data.url) {
    const response = await fetch(parsed.data.url, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json({ error: "Could not fetch the ICS calendar." }, { status: 400 });
    }

    icsText = await response.text();
  }

  const data = parseIcsHolidays(icsText ?? "");
  return NextResponse.json({ data, source: "ics" });
}

function parseIcsHolidays(icsText: string) {
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  return events.flatMap((event) => {
    const name = readIcsValue(event, "SUMMARY");
    const date = readIcsDate(event, "DTSTART");

    if (!name || !date) {
      return [];
    }

    const category = readIcsValue(event, "CATEGORIES");
    return [{
      name,
      date,
      type: normalizeHolidayType(category),
    }];
  });
}

function readIcsValue(event: string, key: string) {
  const match = event.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, "im"));
  return match ? unescapeIcs(match[1].trim()) : undefined;
}

function readIcsDate(event: string, key: string) {
  const value = readIcsValue(event, key);

  if (!value) {
    return undefined;
  }

  const compact = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso?.[1];
}

function normalizeHolidayType(value?: string): HolidayType {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (holidayTypes.includes(normalized as HolidayType)) {
    return normalized as HolidayType;
  }

  return "COMPANY";
}

function unescapeIcs(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

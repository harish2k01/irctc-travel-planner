import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createHolidaySchema } from "@/lib/api-schemas";
import { writeAudit } from "@/lib/audit";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fetchExternal, limitedResponseText, validateExternalUrl } from "@/lib/safe-fetch";
import type { HolidayType } from "@/lib/types";

const schema = z.object({
  url: z.string().url().optional(),
  icsText: z.string().min(1).max(1_000_000).optional(),
  save: z.boolean().default(false),
  holidays: z.array(createHolidaySchema).min(1).max(500).optional(),
}).refine((value) => Boolean(value.url || value.icsText || value.holidays), "Provide an ICS URL or file content.");

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, "holiday:ics", 10, 60_000, user.id);
    const input = await parseJson(request, schema, 1_100_000);
    let content = input.icsText;
    if (!content && input.url) {
      const response = await fetchExternal(await validateExternalUrl(input.url), { headers: { Accept: "text/calendar" } });
      if (!response.ok) throw new ApiError(400, "The calendar could not be downloaded.", "ICS_FETCH_FAILED");
      content = await limitedResponseText(response);
    }
    const holidays = input.holidays ?? z.array(createHolidaySchema).min(1, "No valid leave dates found.").max(500).parse(parseIcsHolidays(content ?? ""));
    if (!input.save) return jsonData(holidays);
    const added = await prisma.$transaction(async (tx) => {
      // Serialize imports for this owner so repeated submissions are idempotent.
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const existing = await tx.holiday.findMany({ where: { userId: user.id }, select: { name: true, date: true, type: true } });
      const key = (row: { name: string; date: string }) => JSON.stringify([row.name, row.date]);
      const seen = new Set(existing.map((row) => key({ ...row, date: row.date.toISOString().slice(0, 10) })));
      const rows = holidays.filter((row) => { const value = key(row); if (seen.has(value)) return false; seen.add(value); return true; });
      if (!rows.length) return 0;
      const inserted = await tx.holiday.createMany({ data: rows.map((row) => ({ ...row, userId: user.id, date: new Date(`${row.date}T00:00:00.000Z`) })), skipDuplicates: true });
      return inserted.count;
    });
    await writeAudit({ actorId: user.id, action: "holiday.imported", targetType: "Holiday", request, metadata: { added } });
    return jsonData({ added });
  } catch (error) {
    return routeError(error, request);
  }
}

export function parseIcsHolidays(content: string) {
  const unfolded = content.replace(/\r?\n[ \t]/g, "");
  const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  return events.flatMap((event) => {
    const name = readValue(event, "SUMMARY");
    const date = readDate(event, "DTSTART");
    if (!name || !date) return [];
    const category = readValue(event, "CATEGORIES")?.toUpperCase() ?? "";
    const type: HolidayType = category.includes("PERSONAL") || category.includes("LEAVE") ? "PERSONAL_LEAVE" : "COMPANY";
    return [{ name, date, type }];
  });
}

function readValue(event: string, key: string) {
  const match = event.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, "im"));
  return match?.[1].trim().replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function readDate(event: string, key: string) {
  const value = readValue(event, key);
  const compact = value?.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
}

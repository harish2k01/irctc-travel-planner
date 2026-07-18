import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fetchExternal, limitedResponseText, validateExternalUrl } from "@/lib/safe-fetch";
import type { HolidayType } from "@/lib/types";

const schema = z.object({
  url: z.string().url().optional(),
  icsText: z.string().min(1).max(1_000_000).optional(),
}).refine((value) => Boolean(value.url || value.icsText), "Provide an ICS URL or file content.");

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
    return jsonData(parseIcsHolidays(content ?? ""));
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

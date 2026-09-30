import { z } from "zod";

export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a real calendar date.");
const stationCode = z.string().trim().min(2).max(16).transform((value) => value.toUpperCase());
const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalPnr = z.union([z.string().regex(/^\d{10}$/), z.literal(""), z.null()]).optional();

export const calendarWeekStartsOnSchema = z.union([z.literal(0), z.literal(1)]);

const ticketFields = z.object({
  sourceCode: stationCode,
  sourceName: optionalText(120),
  destinationCode: stationCode,
  destinationName: optionalText(120),
  travelDate: dateOnly,
  notes: optionalText(1_000),
  pnr: optionalPnr,
  reminderEmailEnabled: z.boolean().optional(),
  reminderDiscordEnabled: z.boolean().optional(),
  reminderInAppEnabled: z.boolean().optional(),
});

export const createTicketSchema = ticketFields.extend({ returnDate: dateOnly.optional() }).refine((value) => !value.returnDate || value.returnDate >= value.travelDate, {
  path: ["returnDate"], message: "Return date must be on or after the outbound date.",
}).refine((value) => value.sourceCode !== value.destinationCode, {
  path: ["destinationCode"],
  message: "Source and destination must be different.",
});

export const updateTicketSchema = ticketFields.partial().extend({
  status: z.enum(["PLANNED", "BOOKED", "ARCHIVED"]).optional(),
  version: z.number().int().positive(),
}).refine((value) => !value.sourceCode || !value.destinationCode || value.sourceCode !== value.destinationCode, {
  path: ["destinationCode"],
  message: "Source and destination must be different.",
});

export const createHolidaySchema = z.object({
  name: z.string().trim().min(2).max(120),
  date: dateOnly,
  type: z.enum(["COMPANY", "PERSONAL_LEAVE"]),
});

export const passwordSchema = z.string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.");

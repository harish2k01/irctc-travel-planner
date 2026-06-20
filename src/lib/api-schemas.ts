import { z } from "zod";
import { calculateBookingOpenDate } from "@/lib/dates";

export const journeyStatusSchema = z.enum([
  "PLANNED",
  "BOOKING_WINDOW_OPEN",
  "BOOKED",
  "WAITLISTED",
  "RAC",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
]);

export const createJourneySchema = z.object({
  routeId: z.string().min(1),
  trainId: z.string().min(1),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredClass: z.string().min(1),
  sourceCode: z.string().max(16).optional(),
  sourceName: z.string().max(120).optional(),
  destinationCode: z.string().max(16).optional(),
  destinationName: z.string().max(120).optional(),
  direction: z.enum(["HOME_TO_OFFICE", "OFFICE_TO_HOME"]).optional(),
  recurrence: z.enum(["ONE_TIME", "WEEKLY", "CUSTOM"]).optional(),
  pnr: z.string().regex(/^\d{10}$/).optional(),
  notes: z.string().max(500).optional(),
});

export const updateJourneyStatusSchema = z.object({
  status: journeyStatusSchema.optional(),
  routeId: z.string().min(1).optional(),
  trainId: z.string().min(1).optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredClass: z.string().min(1).optional(),
  sourceCode: z.string().max(16).optional(),
  sourceName: z.string().max(120).optional(),
  destinationCode: z.string().max(16).optional(),
  destinationName: z.string().max(120).optional(),
  direction: z.enum(["HOME_TO_OFFICE", "OFFICE_TO_HOME"]).optional(),
  recurrence: z.enum(["ONE_TIME", "WEEKLY", "CUSTOM"]).optional(),
  notes: z.string().max(500).optional(),
  pnr: z.string().regex(/^\d{10}$/).optional(),
  coach: z.string().max(8).optional(),
  seat: z.string().max(12).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  farePaid: z.number().nonnegative().optional(),
  waitlistPosition: z.number().int().positive().optional(),
});

export const createHolidaySchema = z.object({
  name: z.string().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["NATIONAL", "STATE", "COMPANY", "PERSONAL_LEAVE"]),
  region: z.string().max(80).optional(),
});

export function normalizeJourneyInput(input: z.infer<typeof createJourneySchema>) {
  return {
    ...input,
    bookingOpenDate: calculateBookingOpenDate(input.travelDate),
    direction: input.direction ?? "HOME_TO_OFFICE",
    recurrence: input.recurrence ?? "ONE_TIME",
    status: "PLANNED" as const,
  };
}

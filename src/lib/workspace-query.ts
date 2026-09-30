import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/http";

export const tripQuerySchema = z.object({
  view: z.enum(["planned", "booked", "history"]).default("planned"),
  q: z.string().trim().max(120).default(""), sort: z.enum(["travel", "booking"]).default("travel"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export function parseTripQuery(url: string) {
  const result = tripQuerySchema.safeParse(Object.fromEntries(new URL(url).searchParams));
  if (!result.success) throw new ApiError(400, "Invalid trip filter.", "VALIDATION_ERROR");
  return result.data;
}
export function tripWhere(userId: string, view: string, today: string): Prisma.TicketPlanWhereInput {
  return view === "history" ? { userId, OR: [{ travelDate: { lt: new Date(today) } }, { status: "ARCHIVED" }] }
    : { userId, travelDate: { gte: new Date(today) }, status: view === "booked" ? "BOOKED" : "PLANNED" };
}

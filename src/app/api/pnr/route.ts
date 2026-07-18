import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { lookupPnr } from "@/lib/pnr-provider";
import { enforceRateLimit } from "@/lib/rate-limit";

const lookupSchema = z.object({ pnr: z.string().regex(/^\d{10}$/, "PNR must contain 10 digits.") });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, "pnr:lookup", 10, 60_000, user.id);
    const { pnr } = await parseJson(request, lookupSchema, 1_024);
    return jsonData(await lookupPnr(pnr));
  } catch (error) {
    return routeError(error, request);
  }
}

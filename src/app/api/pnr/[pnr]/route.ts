import { NextResponse } from "next/server";
import { z } from "zod";
import { journeyStatusSchema } from "@/lib/api-schemas";

const providerResponseSchema = z.object({
  trainNumber: z.string().max(12).optional(),
  trainName: z.string().max(120).optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredClass: z.string().max(12).optional(),
  sourceCode: z.string().max(16).optional(),
  sourceName: z.string().max(120).optional(),
  destinationCode: z.string().max(16).optional(),
  destinationName: z.string().max(120).optional(),
  status: journeyStatusSchema.optional(),
  coach: z.string().max(8).optional(),
  seat: z.string().max(12).optional(),
  farePaid: z.number().nonnegative().optional(),
  waitlistPosition: z.number().int().positive().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ pnr: string }> }) {
  const { pnr } = await params;

  if (!/^\d{10}$/.test(pnr)) {
    return NextResponse.json({ error: "PNR must be a 10 digit number." }, { status: 400 });
  }

  const providerUrl = process.env.PNR_PROVIDER_URL;

  if (!providerUrl) {
    return NextResponse.json(
      {
        error: "PNR sync is not configured. Set PNR_PROVIDER_URL and map its response before enabling automatic status sync.",
      },
      { status: 501 },
    );
  }

  const url = new URL(providerUrl);
  url.searchParams.set("pnr", pnr);

  const response = await fetch(url, {
    cache: "no-store",
    headers: process.env.PNR_PROVIDER_API_KEY
      ? { Authorization: `Bearer ${process.env.PNR_PROVIDER_API_KEY}` }
      : undefined,
  });

  if (!response.ok) {
    return NextResponse.json({ error: "PNR provider request failed." }, { status: 502 });
  }

  const parsed = providerResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "PNR provider response did not match the expected shape." }, { status: 502 });
  }

  return NextResponse.json({ data: parsed.data, source: "provider" });
}

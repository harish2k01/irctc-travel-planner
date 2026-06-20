import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const trainSearchResultSchema = z.object({
  trainNumber: z.string().min(1).max(12),
  trainName: z.string().min(1).max(120),
  sourceCode: z.string().max(16).optional(),
  sourceName: z.string().max(120).optional(),
  destinationCode: z.string().max(16).optional(),
  destinationName: z.string().max(120).optional(),
  preferredClasses: z.array(z.string().max(12)).optional(),
});

const providerResponseSchema = z.union([
  z.array(trainSearchResultSchema),
  z.object({ data: z.array(trainSearchResultSchema) }),
  z.object({ trains: z.array(trainSearchResultSchema) }),
]);

function normalizeProviderResponse(input: z.infer<typeof providerResponseSchema>) {
  if (Array.isArray(input)) {
    return input;
  }

  return "data" in input ? input.data : input.trains;
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ data: [], source: "empty" });
  }

  const savedTrains = await prisma.train.findMany({
    where: {
      route: { userId: user.id },
      OR: [
        { trainNumber: { contains: query, mode: "insensitive" } },
        { trainName: { contains: query, mode: "insensitive" } },
        { route: { originCode: { contains: query, mode: "insensitive" } } },
        { route: { destinationCode: { contains: query, mode: "insensitive" } } },
        { route: { originName: { contains: query, mode: "insensitive" } } },
        { route: { destinationName: { contains: query, mode: "insensitive" } } },
      ],
    },
    include: { route: true },
    orderBy: { trainNumber: "asc" },
    take: 8,
  });

  if (savedTrains.length > 0) {
    return NextResponse.json({
      data: savedTrains.map((train) => ({
        id: train.id,
        routeId: train.routeId,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        sourceCode: train.route.originCode,
        sourceName: train.route.originName,
        destinationCode: train.route.destinationCode,
        destinationName: train.route.destinationName,
        preferredClasses: train.preferredClasses,
      })),
      source: "saved",
    });
  }

  const providerUrl = process.env.TRAIN_SEARCH_PROVIDER_URL;

  if (!providerUrl) {
    return NextResponse.json(
      {
        data: [],
        error: "Live train search is not configured. Set TRAIN_SEARCH_PROVIDER_URL to a licensed train-search API.",
        source: "not_configured",
      },
      { status: 501 },
    );
  }

  const providerRequestUrl = new URL(providerUrl);
  providerRequestUrl.searchParams.set("q", query);

  const sourceCode = url.searchParams.get("sourceCode")?.trim();
  const destinationCode = url.searchParams.get("destinationCode")?.trim();
  const travelDate = url.searchParams.get("travelDate")?.trim();

  if (sourceCode) providerRequestUrl.searchParams.set("sourceCode", sourceCode);
  if (destinationCode) providerRequestUrl.searchParams.set("destinationCode", destinationCode);
  if (travelDate) providerRequestUrl.searchParams.set("travelDate", travelDate);

  const response = await fetch(providerRequestUrl, {
    cache: "no-store",
    headers: process.env.TRAIN_SEARCH_PROVIDER_API_KEY
      ? { Authorization: `Bearer ${process.env.TRAIN_SEARCH_PROVIDER_API_KEY}` }
      : undefined,
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Train search provider request failed." }, { status: 502 });
  }

  const parsed = providerResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Train search provider response did not match the expected shape." }, { status: 502 });
  }

  return NextResponse.json({ data: normalizeProviderResponse(parsed.data).slice(0, 12), source: "provider" });
}

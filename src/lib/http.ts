import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { logger } from "@/lib/logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
    public details?: unknown,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin && process.env.NODE_ENV !== "production") return;
  if (!origin) throw new ApiError(403, "A same-origin request is required.", "INVALID_ORIGIN");

  const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (new URL(origin).host !== expectedHost) {
    throw new ApiError(403, "The request origin is not allowed.", "INVALID_ORIGIN");
  }
}

export async function parseJson<T>(request: Request, schema: ZodType<T>, maxBytes = 64_000): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) throw new ApiError(413, "The request is too large.", "PAYLOAD_TOO_LARGE");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "The request body must be valid JSON.", "INVALID_JSON");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Review the highlighted fields and try again.", "VALIDATION_ERROR", parsed.error.flatten());
  }
  return parsed.data;
}

export function jsonData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function routeError(error: unknown, request?: Request) {
  const requestId = request?.headers.get("x-request-id") ?? randomUUID();

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details }, requestId },
      { status: error.status, headers: { "x-request-id": requestId } },
    );
  }

  if (error instanceof Response) return error;
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Review the submitted values.", details: error.flatten() }, requestId },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  logger.error("api.unhandled_error", {
    requestId,
    path: request ? new URL(request.url).pathname : undefined,
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." }, requestId },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}

export function noStoreHeaders() {
  return { "Cache-Control": "private, no-store, max-age=0" };
}

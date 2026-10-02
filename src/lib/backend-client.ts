import "server-only";
import { headers } from "next/headers";
import type { AuthUser } from "./auth";
import type { FeaturePolicy } from "./feature-policy";

export type SessionState = { user: AuthUser | null; policy: FeaturePolicy; firstSignup: boolean; allowSignups: boolean };
/** Reads account and feature-policy state from the private backend for server-rendered pages. */
export async function getSessionState(): Promise<SessionState> {
  const incoming = await headers();
  const response = await fetch(new URL("/api/auth/session", process.env.BACKEND_URL ?? "http://127.0.0.1:3001"), {
    headers: { cookie: incoming.get("cookie") ?? "" }, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("RailWatch backend is unavailable.");
  return (await response.json()).data;
}

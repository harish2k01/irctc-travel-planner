import { assertSameOrigin, jsonData, routeError } from "@/lib/http";
import { destroySession } from "@/lib/auth";

/** Revokes the request session and clears its browser cookie. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroySession();
    return jsonData({ ok: true });
  } catch (error) {
    return routeError(error, request);
  }
}

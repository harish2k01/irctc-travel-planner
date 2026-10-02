import { z } from "zod";
import { createAccountToken } from "@/lib/account-tokens";
import { assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { sendPasswordResetEmail } from "@/lib/mail";
import { prisma } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email() });
const genericMessage = "If that account exists, a password reset link has been sent.";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "auth:forgot", 5, 60 * 60_000);
    const { email } = await parseJson(request, schema, 2_048);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user?.isActive) {
      const { token } = await createAccountToken(user.id, "PASSWORD_RESET", 30);
      try {
        await sendPasswordResetEmail(user.email, token);
      } catch {
        // Keep the public response identical to avoid account enumeration.
      }
    }
    return jsonData({ ok: true, message: genericMessage });
  } catch (error) {
    return routeError(error, request);
  }
}

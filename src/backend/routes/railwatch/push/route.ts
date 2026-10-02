import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getFeaturePolicy } from "@/lib/settings";
import { validPushEndpoint, pushEndpointHash, pushIdentity, sendBrowserPush } from "@/lib/browser-push";
const subscriptionSchema = z.object({ endpoint: z.string().max(2048).refine(validPushEndpoint), keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}==?$/).or(z.string().regex(/^[A-Za-z0-9_-]{22}$/)) }).strict() });
/** Exposes the instance public key only to authenticated accounts. */
export async function GET(request: Request) { try { await requireUser(); return jsonData({ publicKey: (await pushIdentity()).publicKey, enabled: (await getFeaturePolicy()).remindersEnabled }); } catch (e) { return routeError(e, request); } }
/** Registers, tests or removes the current device without changing other account devices. */
export async function POST(request: Request) { try {
  assertSameOrigin(request); const user = await requireUser(); await enforceRateLimit(request, "push:" + user.id, 15, 60000);
  const input = await parseJson(request, z.object({ action: z.enum(["subscribe", "remove", "test", "status"]), endpoint: z.string().max(2048).optional(), subscription: subscriptionSchema.optional() }).strict(), 4096);
  const endpoint = input.subscription?.endpoint ?? input.endpoint;
  if (!endpoint || !validPushEndpoint(endpoint)) throw new ApiError(400, "Unsupported browser push service.");
  const endpointHash = pushEndpointHash(endpoint);
  const device = await prisma.railPush.findUnique({ where: { endpointHash } });
  if (input.action === "status") return jsonData({ subscribed: device?.userId === user.id });
  if (input.action === "remove") { await prisma.railPush.deleteMany({ where: { userId: user.id, endpointHash } }); return jsonData({ saved: true }); }
  if (!(await getFeaturePolicy()).remindersEnabled) throw new ApiError(403, "Reminders are disabled by the administrator.");
  if (input.action === "test") { if (!device || device.userId !== user.id) throw new ApiError(400, "Enable notifications on this device first."); await sendBrowserPush(user.id, device.id, "Your browser notifications are working.", "railwatch-test"); return jsonData({ saved: true }); }
  if (!input.subscription) throw new ApiError(400, "A browser subscription is required.");
  const subscription = input.subscription;
  if (Buffer.from(subscription.keys.p256dh, "base64url").length !== 65 || Buffer.from(subscription.keys.p256dh, "base64url")[0] !== 4 || Buffer.from(subscription.keys.auth, "base64url").length !== 16) throw new ApiError(400, "Invalid browser subscription keys.");
  await prisma.$transaction(async tx => {
    // Serialize endpoint ownership and account quota checks across backend replicas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${endpointHash}))`;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const current = await tx.railPush.findUnique({ where: { endpointHash } });
    if (current && current.userId !== user.id) throw new ApiError(409, "This browser is connected to another account. Disable its notifications from that account first.");
    if (!current && await tx.railPush.count({ where: { userId: user.id } }) >= 10) throw new ApiError(400, "This account has reached its ten-device limit.");
    await tx.railPush.upsert({ where: { endpointHash }, create: { userId: user.id, endpointHash, subscription: encryptSecret(JSON.stringify(subscription)) }, update: { subscription: encryptSecret(JSON.stringify(subscription)) } });
  });
  return jsonData({ saved: true });
} catch (e) { return routeError(e, request); } }

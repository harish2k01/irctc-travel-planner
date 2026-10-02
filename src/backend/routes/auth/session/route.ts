import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppSettings, publicPolicy } from "@/lib/settings";
import { jsonData, routeError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const [user, settings, count] = await Promise.all([getCurrentUser(), getAppSettings(), prisma.user.count()]);
    return jsonData({ user, policy: publicPolicy(settings), firstSignup: count === 0, allowSignups: settings.allowSignups });
  } catch (error) { return routeError(error, request); }
}

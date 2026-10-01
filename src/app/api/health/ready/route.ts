import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    encryptSecret("readiness");
    await prisma.$queryRaw`SELECT 1 FROM "RailWorkspace" LIMIT 0`;
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

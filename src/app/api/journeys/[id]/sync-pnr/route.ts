import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, routeError } from "@/lib/http";
import { syncTicketPnr } from "@/lib/pnr-sync";
import { enforceRateLimit } from "@/lib/rate-limit";
import { serializeTicket } from "@/lib/tickets";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, "pnr:sync", 10, 60_000, user.id);
    const { id } = await params;
    const result = await syncTicketPnr(id, user.id);
    if (!result) throw new ApiError(400, "Tag a PNR before syncing ticket details.", "PNR_NOT_TAGGED");
    const ticket = await prisma.ticketPlan.findUniqueOrThrow({ where: { id }, include: { pnrSnapshot: true } });
    return jsonData(serializeTicket(ticket));
  } catch (error) {
    return routeError(error, request);
  }
}

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { noStoreHeaders, routeError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const tickets = await prisma.ticketPlan.findMany({
      where: { userId: user.id },
      select: { sourceCode: true, destinationCode: true, travelDate: true, status: true },
      orderBy: { travelDate: "asc" },
      take: 2_000,
    });
    const byMonth = new Map<string, number>();
    const byRoute = new Map<string, number>();
    for (const ticket of tickets) {
      const month = ticket.travelDate.toISOString().slice(0, 7);
      const route = `${ticket.sourceCode} to ${ticket.destinationCode}`;
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      byRoute.set(route, (byRoute.get(route) ?? 0) + 1);
    }
    return Response.json({
      data: {
        totals: {
          all: tickets.length,
          toBook: tickets.filter((ticket) => ticket.status === "PLANNED").length,
          booked: tickets.filter((ticket) => ticket.status === "BOOKED").length,
          archived: tickets.filter((ticket) => ticket.status === "ARCHIVED").length,
        },
        monthly: Array.from(byMonth, ([month, tickets]) => ({ month, tickets })),
        routes: Array.from(byRoute, ([route, tickets]) => ({ route, tickets })).sort((a, b) => b.tickets - a.tickets).slice(0, 10),
      },
    }, { headers: noStoreHeaders() });
  } catch (error) {
    return routeError(error, request);
  }
}

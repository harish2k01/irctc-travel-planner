import { redirect } from "next/navigation";
import { BellRing, CheckCircle2, ListChecks, Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const tickets = await prisma.ticketPlan.findMany({
    where: { userId: user.id },
    select: { sourceCode: true, destinationCode: true, travelDate: true, status: true, reminderEmailEnabled: true, reminderDiscordEnabled: true, reminderInAppEnabled: true },
    orderBy: { travelDate: "asc" },
    take: 2_000,
  });
  const monthly = new Map<string, number>();
  const routes = new Map<string, number>();
  for (const ticket of tickets) {
    const month = ticket.travelDate.toISOString().slice(0, 7);
    const route = `${ticket.sourceCode} to ${ticket.destinationCode}`;
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
    routes.set(route, (routes.get(route) ?? 0) + 1);
  }
  const months = Array.from(monthly, ([month, count]) => ({ month, count }));
  const routeRows = Array.from(routes, ([route, count]) => ({ route, count })).sort((a, b) => b.count - a.count);
  const maxMonth = Math.max(1, ...months.map((item) => item.count));
  const reminded = tickets.filter((item) => item.reminderEmailEnabled || item.reminderDiscordEnabled || item.reminderInAppEnabled).length;

  return <div className="grid gap-3">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={ListChecks} label="All ticket plans" value={tickets.length} /><Metric icon={Ticket} label="Tickets to book" value={tickets.filter((item) => item.status === "PLANNED").length} /><Metric icon={CheckCircle2} label="Booked tickets" value={tickets.filter((item) => item.status === "BOOKED").length} /><Metric icon={BellRing} label="Reminder coverage" value={tickets.length ? `${Math.round((reminded / tickets.length) * 100)}%` : "0%"} /></section>
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]">
      <section className="rounded-md border border-slate-200 bg-white"><header className="flex h-11 items-center border-b border-slate-200 px-3"><h2 className="text-sm font-semibold">Tickets by travel month</h2></header><div className="grid gap-2 p-3">{months.map((item) => <div key={item.month} className="grid grid-cols-[5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm"><span>{new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}</span><span className="h-6 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-blue-600" style={{ width: `${Math.max(4, (item.count / maxMonth) * 100)}%` }} /></span><strong className="text-right">{item.count}</strong></div>)}{months.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Add ticket plans to see monthly activity.</p>}</div></section>
      <section className="rounded-md border border-slate-200 bg-white"><header className="flex h-11 items-center border-b border-slate-200 px-3"><h2 className="text-sm font-semibold">Routes planned</h2></header><div className="divide-y divide-slate-100">{routeRows.slice(0, 10).map((item) => <div key={item.route} className="flex items-center justify-between px-3 py-2.5 text-sm"><strong>{item.route}</strong><span className="text-slate-500">{item.count} ticket{item.count === 1 ? "" : "s"}</span></div>)}{routeRows.length === 0 && <p className="py-12 text-center text-sm text-slate-500">No route history yet.</p>}</div></section>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) { return <article className="flex min-h-20 items-center gap-3 rounded-md border border-slate-200 bg-white p-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></span><span><span className="block text-xs text-slate-500">{label}</span><strong className="text-xl">{value}</strong></span></article>; }

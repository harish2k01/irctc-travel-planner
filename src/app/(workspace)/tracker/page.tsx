import { redirect } from "next/navigation";
import { TicketTracker } from "@/components/ticket-tracker";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { serializeTicket } from "@/lib/tickets";

export default async function TrackerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const [rows, settings] = await Promise.all([
    prisma.ticketPlan.findMany({ where: { userId: user.id }, include: { pnrSnapshot: true }, orderBy: [{ travelDate: "asc" }, { id: "asc" }], take: 1_000 }),
    getAppSettings(),
  ]);
  return <TicketTracker initialTickets={rows.map(serializeTicket)} channels={{ email: settings.reminderEmailEnabled, discord: settings.reminderDiscordEnabled, inApp: settings.reminderInAppEnabled }} timeZone={user.timeZone} />;
}

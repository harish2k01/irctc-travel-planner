import { redirect } from "next/navigation";
import { AdminSettings } from "@/components/admin-settings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppSettings, serializeAdminSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard");
  const [settings, users] = await Promise.all([
    getAppSettings(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }, take: 500 }),
  ]);
  return <AdminSettings currentUserId={user.id} initialSettings={serializeAdminSettings(settings)} initialUsers={users.map((item) => ({ ...item, name: item.name ?? undefined, createdAt: item.createdAt.toISOString() }))} />;
}

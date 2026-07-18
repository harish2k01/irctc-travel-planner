import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!process.env.DATABASE_URL) return <AuthScreen mode="missingDatabase" allowSignups={false} />;
  const [currentUser, userCount, settings] = await Promise.all([getCurrentUser(), prisma.user.count(), getAppSettings()]);
  if (currentUser && !currentUser.mustResetPassword) redirect("/dashboard");
  if (currentUser?.mustResetPassword) return <AuthScreen mode="resetPassword" allowSignups={settings.allowSignups} />;
  if (userCount === 0) return <AuthScreen mode="firstSignup" allowSignups />;
  return <AuthScreen mode="login" allowSignups={settings.allowSignups} />;
}

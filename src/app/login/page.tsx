import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getSessionState } from "@/lib/backend-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user: currentUser, firstSignup, allowSignups } = await getSessionState();
  if (currentUser && !currentUser.mustResetPassword) redirect("/");
  if (currentUser?.mustResetPassword) return <AuthScreen mode="resetPassword" allowSignups={allowSignups} />;
  if (firstSignup) return <AuthScreen mode="firstSignup" allowSignups />;
  return <AuthScreen mode="login" allowSignups={allowSignups} />;
}

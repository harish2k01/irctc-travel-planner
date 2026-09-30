import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getCurrentUser } from "@/lib/auth";
import { getPreferences } from "@/lib/preferences";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.mustResetPassword) redirect("/");
  return <WorkspaceShell initialPreferences={await getPreferences(user.id)}>{children}</WorkspaceShell>;
}

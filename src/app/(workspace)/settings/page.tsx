import { SettingsScreen } from "@/components/workspace/settings";
import { requireUser } from "@/lib/auth";
export default async function Page() { return <SettingsScreen userId={(await requireUser()).id} />; }

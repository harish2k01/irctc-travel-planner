import { PlannerForm } from "@/components/planner-form";
import { getAppSettings } from "@/lib/settings";

export default async function PlannerPage() {
  const settings = await getAppSettings();
  return <PlannerForm channels={{ email: settings.reminderEmailEnabled, discord: settings.reminderDiscordEnabled, inApp: settings.reminderInAppEnabled }} bookingWindowDays={settings.bookingWindowDays} />;
}

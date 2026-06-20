import type { NotificationPreference } from "@/lib/types";

export const notificationPreferences: NotificationPreference[] = [
  { channel: "EMAIL", enabled: true },
  { channel: "PUSH", enabled: true },
  { channel: "IN_APP", enabled: true },
];

import type { Ticket, Holiday, NotificationItem } from "./types";

export type Preferences = {
  name: string; email: string; role: "ADMIN" | "USER"; timeZone: string;
  weekendDays: number[]; calendarWeekStartsOn: number | null; defaultWeekStart: number;
  defaultEmail: boolean; defaultDiscord: boolean; defaultInApp: boolean;
  available: { email: boolean; discord: boolean; inApp: boolean };
  emailConfigured: boolean; discordConfigured: boolean; discordStored: boolean;
  bookingWindowDays: number; bookingOpenHour: number; bookingOpenMinute: number;
  reminderSevenDaysEnabled: boolean; reminderOneDayEnabled: boolean; reminderBookingOpenEnabled: boolean;
  pnrConfigured: boolean;
};
export type TripPage = { tickets: Ticket[]; total: number; page: number; pageSize: number; counts: { planned: number; booked: number; history: number } };
export type Overview = { attention: Ticket[]; attentionCount: number; upcoming: Ticket[]; nextTrip: Ticket | null; holidays: Holiday[]; today: string };
export type CalendarData = { tickets: Ticket[]; holidays: Holiday[]; truncated: boolean };
export type TripDetailData = { ticket: Ticket; linked: Ticket[]; deliveries: { id: string; channel: string; status: string; sentAt: string | null; lastError: string | null; nextAttemptAt: string | null }[] };
export type NotificationPage = { items: NotificationItem[]; unreadCount: number; total: number; page: number };

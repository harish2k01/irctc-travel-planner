export type TicketStatus = "PLANNED" | "BOOKED" | "ARCHIVED";
export type HolidayType = "COMPANY" | "PERSONAL_LEAVE";
export type ReminderType = "SEVEN_DAYS_BEFORE" | "ONE_DAY_BEFORE" | "BOOKING_OPEN";
export type NotificationChannel = "EMAIL" | "DISCORD" | "IN_APP";

export type PnrSnapshot = {
  trainNumber?: string;
  trainName?: string;
  bookedClass?: string;
  providerStatus?: string;
  coach?: string;
  seat?: string;
  syncedAt: string;
};

export type Ticket = {
  id: string;
  sourceCode: string;
  sourceName?: string;
  destinationCode: string;
  destinationName?: string;
  travelDate: string;
  bookingOpensAt: string;
  status: TicketStatus;
  notes?: string;
  pnrTagged: boolean;
  pnrLast4?: string;
  remindersEnabled: boolean;
  reminderEmailEnabled: boolean;
  reminderDiscordEnabled: boolean;
  reminderInAppEnabled: boolean;
  version: number;
  pnrSnapshot?: PnrSnapshot;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
};

export type NotificationItem = {
  id: string;
  ticketId: string;
  route: string;
  type: ReminderType;
  dueAt: string;
  travelDate: string;
  bookingOpensAt: string;
  readAt?: string;
};

export type ManagedUser = {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
};

export type PublicReminderSettings = {
  email: boolean;
  discord: boolean;
  inApp: boolean;
};

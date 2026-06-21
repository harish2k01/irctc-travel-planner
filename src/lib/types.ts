export type JourneyStatus =
  | "PLANNED"
  | "BOOKING_WINDOW_OPEN"
  | "BOOKED"
  | "WAITLISTED"
  | "RAC"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

export type TravelDirection = "HOME_TO_OFFICE" | "OFFICE_TO_HOME";
export type RecurrenceType = "ONE_TIME" | "WEEKLY" | "CUSTOM";
export type HolidayType = "NATIONAL" | "STATE" | "COMPANY" | "PERSONAL_LEAVE";
export type ReminderType = "SEVEN_DAYS_BEFORE" | "ONE_DAY_BEFORE" | "BOOKING_OPEN";

export type Route = {
  id: string;
  originCode: string;
  originName: string;
  destinationCode: string;
  destinationName: string;
};

export type Train = {
  id: string;
  trainNumber: string;
  trainName: string;
  routeId: string;
  preferredClasses: string[];
};

export type Journey = {
  id: string;
  routeId: string;
  trainId: string;
  travelDate: string;
  bookingOpenDate: string;
  preferredClass: string;
  sourceCode?: string;
  sourceName?: string;
  destinationCode?: string;
  destinationName?: string;
  direction?: TravelDirection;
  recurrence?: RecurrenceType;
  status: JourneyStatus;
  notes?: string;
  pnr?: string;
  coach?: string;
  seat?: string;
  bookingDate?: string;
  waitlistPosition?: number;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  region?: string;
};

export type NotificationPreference = {
  channel: "EMAIL" | "PUSH" | "IN_APP";
  enabled: boolean;
};

export type AnalyticsPoint = {
  month: string;
  trips: number;
  waitlisted: number;
};

export type Reminder = {
  id: string;
  journeyId: string;
  type: ReminderType;
  dueDate: string;
  message: string;
};

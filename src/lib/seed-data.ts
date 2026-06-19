import { calculateBookingOpenDate } from "@/lib/dates";
import type { AnalyticsPoint, Holiday, Journey, NotificationPreference, Route, Train } from "@/lib/types";

export const routes: Route[] = [
  {
    id: "bengaluru-chennai",
    originCode: "SBC",
    originName: "KSR Bengaluru",
    destinationCode: "MAS",
    destinationName: "MGR Chennai Central",
  },
  {
    id: "pune-mumbai",
    originCode: "PUNE",
    originName: "Pune Junction",
    destinationCode: "CSMT",
    destinationName: "C Shivaji Maharaj T",
  },
  {
    id: "hyderabad-vijayawada",
    originCode: "SC",
    originName: "Secunderabad Junction",
    destinationCode: "BZA",
    destinationName: "Vijayawada Junction",
  },
];

export const trains: Train[] = [
  {
    id: "12624",
    trainNumber: "12624",
    trainName: "Chennai Mail",
    routeId: "bengaluru-chennai",
    preferredClasses: ["2A", "3A", "SL"],
  },
  {
    id: "12028",
    trainNumber: "12028",
    trainName: "Shatabdi Express",
    routeId: "bengaluru-chennai",
    preferredClasses: ["CC", "EC"],
  },
  {
    id: "12128",
    trainNumber: "12128",
    trainName: "Intercity Express",
    routeId: "pune-mumbai",
    preferredClasses: ["CC", "2S"],
  },
  {
    id: "12796",
    trainNumber: "12796",
    trainName: "Lingampalli Intercity",
    routeId: "hyderabad-vijayawada",
    preferredClasses: ["CC", "2S"],
  },
];

const journeyInputs: Omit<Journey, "bookingOpenDate">[] = [
  {
    id: "journey-001",
    routeId: "bengaluru-chennai",
    trainId: "12624",
    travelDate: "2026-08-18",
    preferredClass: "3A",
    direction: "HOME_TO_OFFICE",
    recurrence: "WEEKLY",
    status: "PLANNED",
    notes: "High-demand Monday arrival. Book as soon as window opens.",
  },
  {
    id: "journey-002",
    routeId: "bengaluru-chennai",
    trainId: "12028",
    travelDate: "2026-08-19",
    preferredClass: "CC",
    direction: "OFFICE_TO_HOME",
    recurrence: "WEEKLY",
    status: "BOOKING_WINDOW_OPEN",
    notes: "Prefer aisle seat.",
  },
  {
    id: "journey-003",
    routeId: "pune-mumbai",
    trainId: "12128",
    travelDate: "2026-07-03",
    preferredClass: "CC",
    direction: "HOME_TO_OFFICE",
    recurrence: "ONE_TIME",
    status: "CONFIRMED",
    pnr: "8214567390",
    coach: "C3",
    seat: "42",
    bookingDate: "2026-05-04",
    farePaid: 685,
  },
  {
    id: "journey-004",
    routeId: "hyderabad-vijayawada",
    trainId: "12796",
    travelDate: "2026-07-10",
    preferredClass: "2S",
    direction: "OFFICE_TO_HOME",
    recurrence: "CUSTOM",
    status: "WAITLISTED",
    bookingDate: "2026-05-11",
    farePaid: 220,
    waitlistPosition: 14,
  },
  {
    id: "journey-005",
    routeId: "bengaluru-chennai",
    trainId: "12624",
    travelDate: "2026-06-24",
    preferredClass: "3A",
    direction: "HOME_TO_OFFICE",
    recurrence: "WEEKLY",
    status: "RAC",
    pnr: "6412398751",
    bookingDate: "2026-04-25",
    farePaid: 1450,
  },
  {
    id: "journey-006",
    routeId: "bengaluru-chennai",
    trainId: "12028",
    travelDate: "2026-06-27",
    preferredClass: "CC",
    direction: "OFFICE_TO_HOME",
    recurrence: "WEEKLY",
    status: "COMPLETED",
    pnr: "4781236590",
    coach: "C1",
    seat: "18",
    bookingDate: "2026-04-28",
    farePaid: 995,
  },
];

export const journeys: Journey[] = journeyInputs.map((journey) => ({
  ...journey,
  bookingOpenDate: calculateBookingOpenDate(journey.travelDate),
}));

export const holidays: Holiday[] = [
  {
    id: "holiday-001",
    name: "Bakrid / Eid al-Adha",
    date: "2026-05-27",
    type: "NATIONAL",
  },
  {
    id: "holiday-002",
    name: "Independence Day",
    date: "2026-08-15",
    type: "NATIONAL",
  },
  {
    id: "holiday-003",
    name: "Company Recharge Day",
    date: "2026-07-03",
    type: "COMPANY",
    region: "Bengaluru",
  },
  {
    id: "holiday-004",
    name: "Personal Leave",
    date: "2026-07-06",
    type: "PERSONAL_LEAVE",
  },
  {
    id: "holiday-005",
    name: "Varalakshmi Vratam",
    date: "2026-08-28",
    type: "STATE",
    region: "Karnataka",
  },
];

export const notificationPreferences: NotificationPreference[] = [
  { channel: "EMAIL", enabled: true },
  { channel: "PUSH", enabled: true },
  { channel: "IN_APP", enabled: true },
];

export const analytics: AnalyticsPoint[] = [
  { month: "Jan", trips: 6, spend: 7400, waitlisted: 1 },
  { month: "Feb", trips: 8, spend: 9200, waitlisted: 2 },
  { month: "Mar", trips: 7, spend: 8450, waitlisted: 1 },
  { month: "Apr", trips: 9, spend: 10900, waitlisted: 2 },
  { month: "May", trips: 8, spend: 9900, waitlisted: 1 },
  { month: "Jun", trips: 6, spend: 6475, waitlisted: 1 },
];

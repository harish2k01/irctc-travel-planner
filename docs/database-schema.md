# Database Schema

The executable schema is in `prisma/schema.prisma`.

## Required Entities

- `User`: identity, email/password and Google Sign-In fields.
- `Route`: origin/destination station pair owned by a user.
- `Train`: train number, name, and classes tagged to a tracked PNR after booking.
- `Journey`: travel plan, booking state, PNR, coach/seat, waitlist position, recurrence, and notes.
- `JourneyReminder`: generated reminder records for 7 days before, 1 day before, and booking-open day.
- `Holiday`: national, state, company, and personal leave dates.
- `LeaveRequest`: date ranges for user leave.
- `Notification`: email, Discord, and in-app delivery records.
- `Attachment`: object storage references for ticket PDFs and screenshots.

## Key Relationships

- `User 1..n Route`
- `Route 1..n Train`
- `User 1..n Journey`
- `Route 1..n Journey`
- `Train 1..n Journey`
- `Journey 1..n JourneyReminder`
- `Journey 1..n Attachment`
- `User 1..n Notification`

## Important Indexes

- `Journey(userId, travelDate)` for upcoming trip queries.
- `Journey(userId, bookingOpenDate)` for booking-window dashboards.
- `Journey(status)` for Kanban boards.
- `JourneyReminder(dueAt)` for notification workers.
- `Holiday(date)` and `Holiday(type)` for calendar overlays.

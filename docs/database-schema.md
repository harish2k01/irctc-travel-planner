# Database Schema

- `User`, `Session`, `AccountToken`, `RateLimitBucket`: identity, secure sessions, one-time links, and abuse controls.
- `AppSettings`: signup, booking timing, provider refresh, and encrypted delivery configuration.
- `Journey` (Prisma `TicketPlan`): source, destination, travel date, booking instant, optional encrypted PNR, notes, reminder flags, and version.
- `PnrSnapshot`: provider-returned booked train, class, seat, coach, and status details.
- `JourneyReminder` (Prisma `ReminderSchedule`): configured reminder milestones.
- `ReminderDelivery`: durable email, Discord, and in-app delivery attempts/read state.
- `Holiday`: company and personal leave owned by a user.
- `AuditLog`: security-relevant actor and target events without secret content.

Ticket status is intentionally limited to `PLANNED`, `BOOKED`, and `ARCHIVED`. Provider status remains descriptive snapshot data and does not create application workflow states.

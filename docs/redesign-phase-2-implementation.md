# Phase 2: Backend Implementation Map

Status: Original implementation plan. The live workspace now implements the core changes; see live-workspace-release.md for shipped behaviour and remaining work. Proposals below are not a claim that every item shipped.

The earlier /design-preview prototype has been removed and redirects to /today.
Authenticated routes use real APIs and persisted records. No fixture repository or
simulated delivery implementation is included in the workspace.

## Existing Contracts to Preserve

- TicketPlan maps to the Journey table; bookingOpensAt maps to bookingOpenDate.
- ReminderSchedule maps to JourneyReminder. Existing delivery IDs and read history
  should remain stable while reminder schedules evolve.
- PNR and provider credentials already use application-level encryption. Keep
  encryption at rest and the existing key available during migration and restore.
- Trip updates already use an optimistic version. Preserve conflict detection.
- Existing status values PLANNED, BOOKED and ARCHIVED are sufficient initially.
  Reservation status must stay inside PNR details, not become main workflow columns.
- Existing API and deep links remain compatible until the new UI replaces them.

## Implementation Order

### 1. Characterisation and integration tests

Add database-backed tests before changing the worker and scheduling code. Use an
isolated PostgreSQL database and fake provider transports, not deployment data.

Required cases:
- Concurrent first signups and signup-disabled access.
- Create and mark booked without a PNR; PNR lookup failure leaves a valid plan.
- Cross-user read, update, delete, reminder and destination access denial.
- Edit dates after reminders have been sent; obsolete queued delivery cancellation.
- Two workers claim the same due batch; one worker crashes after claiming.
- Provider timeout, acceptance followed by process death, exhaustion and retry.
- Disabled user/channel and booked/deleted trip immediately before delivery.
- Railway timezone boundary, leap day and travel dates in the past.

### 2. Fix current correctness independently of new UI

Primary files: src/app/api/journeys/route.ts, the individual journey route,
src/lib/tickets.ts, src/lib/dates.ts and the dashboard/tracker page queries.

- Make Mark booked an explicit, authorised mutation. Do not require a PNR.
- Keep PNR attachment and live snapshot freshness as separate facts. Removing a PNR
  must not silently undo the user's booking decision.
- Compute current urgency using an instant, not only a calendar-day comparison.
- Use Asia/Kolkata for railway opening calculations; user timezone affects display.
- Classify past journeys in History at query time. Do not delete them or infer that
  a journey was taken simply because its travel date passed.
- Replace take:200-derived summary counts with database aggregates, and connect
  the tracker to the existing cursor API with stable ordering and bounded page sizes.

### 3. Additive schema migration

Proposed changes, to finalise with the migration tests:

| Area | Proposed data | Backfill rule |
| --- | --- | --- |
| TicketPlan | bookingDateSource: ESTIMATED or OVERRIDE | Existing calculated dates are estimates; preserve their stored instant initially. |
| TicketPlan | optional journeyGroupId | Existing single journeys remain ungrouped. New outbound/return pairs are created atomically. |
| User | nullable calendarWeekStartsOn | Null inherits the admin default. Existing weekendDays and timeZone remain unchanged. |
| User preferences | default channel selection and validated reminder offsets | Preserve existing per-ticket choices; do not overwrite them from new defaults. |
| User delivery destination | encrypted private Discord URL and verified delivery-email reference | Do not copy a shared webhook into every user account. Require explicit assignment. |
| ReminderSchedule | revision, offsetMinutes, cancelledAt | Map existing reminder types to offsets and a baseline revision. Preserve sent history. |
| ReminderDelivery | lease token, lease expiry, cancellation/terminal state, stable dedupe key | Old pending work remains attributable to the exact schedule revision. |

Keep old columns readable through the transition. New enum values and uniqueness
changes require a worker cutover plan: an older worker must not process a newer
schedule or misinterpret a cancellation state.

Do not drop the old (ticketId, type) uniqueness constraint until all writers know
how to create revisioned schedules. Avoid reusing an old schedule ID for a changed
deadline, because its unique delivery rows may already have been sent.

### 4. Reminder state machine and worker recovery

Primary files: src/lib/reminders.ts, src/lib/tickets.ts, mail/settings services,
cron route and Prisma migration.

1. A trip change atomically updates the trip, cancels obsolete unsent revisions,
   and inserts the next eligible schedule revision.
2. A due schedule creates unique per-channel delivery records in one transaction.
3. A worker atomically claims eligible work with a lease token and expiry.
4. Before sending, reload current user, trip, schedule revision and channel state.
   Cancel work that is no longer eligible or no longer useful.
5. Apply network timeouts and bounded retries with backoff and jitter. Handle
   provider rate limits; persist a sanitised reason for a terminal failure.
6. Expired leases become reclaimable. A stale worker may not acknowledge work after
   its lease has been replaced; completion writes must match the lease token.
7. Record provider acceptance separately from reading an in-app notification.

There is a network uncertainty window if a provider accepts a message and the
worker dies before persisting acknowledgement. Use provider idempotency keys where
supported; otherwise document the limited duplicate risk. Do not claim exactly-once
email/Discord delivery.

Catch-up policy needs explicit product behaviour. A missed opening alert should
create one useful catch-up notice while the journey is still relevant, not replay
every obsolete 7-day/1-day message. Use absolute dates in delayed messages.

### 5. Personal settings and administration boundary

Primary files: src/lib/settings.ts, settings routes and account/authentication code.

- Administrators own transport availability, SMTP, provider credentials, user
  access and workspace defaults. Users own their destinations and preferences.
- New private destination endpoints authorise the current user, encrypt values,
  mask responses, rate-limit tests and prevent arbitrary outbound-network access.
- Delivery tests are separately auditable and cannot be used as unrestricted spam
  relays. Never log secrets, complete PNRs or message payloads containing them.
- Changing email requires verification before using it as an account/recovery or
  reminder destination. Existing emailVerifiedAt values created by the old signup
  path are not evidence of verification; define a migration policy without locking
  the current owner out unexpectedly.
- Use a transaction-scoped database lock or a single bootstrap record to elect the
  first administrator. Read the signup policy again inside the protected operation.
- Preserve password reset and invitation functionality while correcting verification.

### 6. UI contracts for Phase 3

Expose data the interface can state truthfully:
- Trip: independent booking state, date source, travel date, booking instant,
  reminder choices, actual enabled destinations, version and optional linked trip.
- Today: complete aggregate counts and a bounded priority-ordered action list.
- Notifications: paginated history, server-calculated unread total, absolute dates,
  read/snooze state and a stable authorised trip link.
- Delivery status: scheduled, attempting, accepted by provider, failed or cancelled.
  Use a separate field for whether the user read the in-app notice.
- PNR: tagged versus successfully fetched, provider name, last successful refresh,
  next retry, and an actionable lookup error with sensitive information removed.

Preserve the current PNR parser until the optional integration phase, but do not
claim an empty/error provider payload was a successful lookup. No new live provider
is selected or paid service purchased by this plan.

## Migration and Rollout Gate

- Restore a backup into a disposable database and run the migration there first.
- Verify row counts, ownership, encrypted-value readability, indexes and query plans.
- Disable/coordinate the old reminder worker during the worker-version cutover;
  prevent old/new code from racing over incompatible schedule semantics.
- Reconcile migrated pending work and test worker restart before re-enabling it.
- Release compatible backend changes before switching the UI.
- Document which application versions can safely run against the new schema.
  Restoring a stale database backup is not a routine application rollback strategy.
- Keep a tested recovery procedure, off-cluster backups and encryption-key recovery.

## Explicitly Outside This Phase

No cost tracking, train search, auto-booking, CAPTCHA automation, payment collection,
waitlist prediction, browser push, new infrastructure framework or data deletion.
Production readiness requires the later end-to-end and operational release gate;
completion of these backend changes alone is not that gate.

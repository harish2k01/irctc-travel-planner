# Live Workspace Release

## Implemented

- The approved redesign is the actual authenticated app: Today, Trips, Calendar,
  Notifications and Settings. The old routes redirect, preserving trip links.
- Trip creation does not require PNR/train/class. Return journeys are atomic,
  linked, independent records. Booking completion and PNR attachment are separate.
- Owned, version-checked edits; explicit destructive confirmations; server search,
  pagination, total counts, bounded dashboard lists and past-trip history.
- Actual delivery records drive notifications. Read/snooze state is persisted,
  old schedules are cancelled, and booked trips stop booking reminders.
- Worker claims are leased. Expired claims recover, competing workers cannot
  acknowledge each other's work, and obsolete 7-day/1-day messages do not replay.
- Private encrypted Discord destinations; administrators configure transport
  availability, credentials, users, signups and booking/calendar defaults.
- Calendar week-start overrides and regular days off; editable Company/Personal
  leave; reviewed, atomic and duplicate-safe ICS imports.
- PNR refresh preserves the user's manually entered itinerary. Failures remain
  visible and eligible for retry even before the first successful snapshot.
- Accessible native dialogs, keyboard navigation, compact desktop layout and
  mobile bottom navigation. No production fixtures or prototype entry point.

## Verification

- Unit and PostgreSQL integration tests cover scheduling revisions, claims,
  concurrent workers, cancellation, recovery, PNR failures, validation and URLs.
- Browser tests exercise the built standalone server with real authentication,
  concurrent administrator bootstrap, ownership and CSRF denials, optional PNR,
  linked journeys, edits, notifications, snooze, pagination, imports and logout.
- Responsive screenshots and overflow checks cover 320, 390, 768, 1280 and 1920px.
- CI blocks release publication on audit, lint, types, tests and production build.
- A restored live-database rehearsal preserves every pre-existing column value
  and row count, except explicitly recovering SENDING deliveries to PENDING.

## Upgrade From 0.14.x

1. Build and verify the release image before starting maintenance.
2. Suspend reminder/PNR CronJobs and allow active worker requests to finish.
3. Stop old web writers. Take a fresh backup on the backup PVC and retain a
   protected off-cluster copy together with the encryption-key recovery procedure.
4. Update the migration CronJob image and run it once. Confirm migration success.
5. Start the new web image, verify readiness/version and authenticated data reads.
6. Resume the workers and confirm successful jobs. Check the UI against live data.

Do not roll an old writer back over the new schema: reminder uniqueness changed
from (trip, type) to (trip, revision, type). Prefer a forward fix. A full database
restore is a separately approved recovery operation, not a routine image rollback.

## Remaining Operational Work

- Live SMTP, Discord and licensed PNR delivery depend on configured credentials.
  A mocked transport test does not prove an external provider accepted a message.
- SMTP/Discord can duplicate a message if the provider accepts it immediately
  before a worker dies. Exactly-once external delivery is not guaranteed.
- Public-registration email verification is not yet enforced. Signup no longer
  falsely records verification. Keep public signups disabled for a private instance.
- Off-cluster backup retention, external availability alerts, a sustained load
  test and a recovery drill remain operator responsibilities.
- Booking dates are estimates using the administrator's window/time, always in
  Asia/Kolkata. Train-specific booking-rule overrides are not implemented.
- ICS import handles explicit event start dates, not recurring-event expansion.
- Advanced trip templates, custom reminder offsets and broad offline support are
  follow-on features, not simulated controls in this release.

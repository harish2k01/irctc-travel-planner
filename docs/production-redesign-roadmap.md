# Product and UI Redesign Roadmap

Status: Phase 1 interactive preview implemented; design review pending. Phase 2
implementation map prepared. Production implementation and deployment are pending.
Prepared: 26 September 2026.

Progress:
- Phase 1: development-only /design-preview with responsive screens and local
  interactions. See redesign-preview.md for scope and verification.
- Phase 2: planned in redesign-phase-2-implementation.md; no schema changes made.
- Phases 3-7: not started. The prototype does not implement production services.

This document describes the target experience and implementation order. The other
architecture and wireframe documents describe the existing application until
their corresponding redesign phase is implemented.

## Product Contract

Help regular train travellers remember which journeys need booking, act at the
appropriate time, and keep booked journeys organised. The core product must work
without a live PNR provider.

- Create a plan with a route and travel date. Train, class and PNR are optional.
- Mark a plan booked independently of adding or successfully verifying a PNR.
- Support outbound and return plans with separate booking deadlines.
- Make the next action and both the travel date and booking deadline explicit.
- Preserve existing plans, leave, reminder preferences and linked PNRs.
- Keep manual entry, email, Discord and in-app reminders. Do not add push support.
- Do not restore costs, reservation-status boards, prediction scores or train search.
- Use Saturday and Sunday as default leave days, with personal configuration.
- Booking occurs on the official service. Do not store IRCTC passwords or automate booking.
- Booking dates calculated without a chosen train are estimates, with an explicit override.

## Target Navigation and Screens

| Surface | Purpose and layout |
| --- | --- |
| Today | A prioritised action list: due bookings, missed actions and the next booked journey. No repeated metric-card dashboard. |
| Trips | Search and filters above a server-paginated list. To book, Booked and History views. Desktop table; mobile divided rows. |
| Add trip | Shared form opened from the primary Add trip action. From, To and travel date first; return date, additional dates, notes and reminders optional. |
| Trip details | Linkable detail view, presented in a desktop side panel and a mobile full-screen view. Dates, actions and reminder schedule first; booked details only when available. |
| Calendar | Booking, travel and leave in one calendar with an integrated leave list. Agenda is the mobile default. |
| Notifications | A compact inbox preview with a full inbox route for history. Fresh unread counts, clear dates and links to specific trips. |
| Settings | Personal preferences and delivery settings for everyone. Restricted administration for users, signups, services, providers and operational health. |
| Authentication | Consistent sign-in, signup, verification, forgot-password, reset and invitation screens. |

Replace Dashboard with Today and Tracker with Trips. Planner becomes an action;
Holidays becomes part of Calendar; Analytics is removed. Preserve existing URLs
and notification links with redirects and ticket-selection compatibility.

## Visual and Interaction Direction

Aim for a quiet, polished operational application. Modernity should come from
clear hierarchy, predictable behaviour and useful information, not more effects.

- Use white surfaces, a neutral grey workspace, charcoal text and a restrained
  teal accent. Amber means attention, red means error or destructive action.
  Verify contrast in the prototype; never communicate status through colour alone.
- Use one type family with fixed role-based sizes: approximately 20px page titles,
  16px section titles, 14px body and 12px metadata. Mobile inputs remain at least
  16px where necessary to avoid browser auto-zoom. No viewport-scaled type.
- Use a 4px spacing scale, typically 8px within controls and 12-16px between groups.
  Use the available workspace rather than a narrow, heavily padded central column.
- Desktop starting dimensions: 224px expanded sidebar, 64px collapsed rail and a
  56px header. Keep the logo at the left and the collapse control after the name.
  In the collapsed rail, place controls without exceeding the rail width.
- Header: one page title, one Add trip action and the notification bell. No repeated
  counters. Sidebar footer: user identity and a distinct Log out action.
- Mobile: bottom navigation for Today, Trips, Calendar and Settings; a reachable
  Add trip action; safe-area spacing. Do not force a desktop sidebar onto the phone.
- Use unframed sections, subtle dividers and one clear toolbar per view. Cards are
  reserved for genuinely separate repeated items or framed tools, with 4-8px radii.
- Use the existing Lucide icon library. Icon-only controls need accessible names
  and tooltips. Use switches for channel preferences and checkboxes for selection.
- Use compact controls on desktop and at least 44px interaction targets on touch
  layouts. Keep table dates readable rather than compressing every cell.
- Use short colour/opacity transitions and restrained panel transitions. Remove
  universal button lifting and broad entry animations; respect reduced motion.
- Every surface includes loading, empty, error, permission-denied, saving and
  network-failure states. Errors stay next to the affected action with a retry.
- Drawers and dialogs need focus trapping, focus restoration and Escape support.
  Outside click closes non-destructive popovers; unsaved forms require protection.
- Use consistent sentence case and date formatting. Station codes are uppercase;
  station names and free text retain their intended casing.

## Phase 1: Experience Blueprint and Design System

Outcome: validate the complete design before rebuilding individual screens.

Work:
- Inventory current screens, routes, controls, API contracts and supported actions.
- Map add, return, reschedule, book, tag PNR, delete, restore navigation and reminder flows.
- Produce high-fidelity interactive prototypes for all target screens and their
  important states, including a dense Trips view, empty Today and delivery failure.
- Define reusable tokens and components for typography, spacing, buttons, switches,
  fields, menus, tabs, tables, lists, panels, notices and confirmation dialogs.
- Include desktop, tablet and phone compositions. Use synthetic non-production
  fixtures only in previews and tests, never seed dummy journeys into real accounts.
- Retain the current name until the owner approves any independent rebranding.

Gate:
- Review Today, Trips, Add trip, Trip details, Calendar, Notifications, Settings and
  authentication as one coherent system, not isolated screenshots.
- No clipping or page-wide horizontal scrolling at 320, 390, 768, 1280 and 1920px.
- No duplicated titles, nested section cards, unexplained icons or dead-end actions.
- Approve the prototype direction before broad UI implementation.

## Phase 2: Correctness, Data and Safety Foundations

Outcome: the new interface rests on trustworthy behaviour and compatible data.

Work:
- Separate planned/booked state from PNR presence and provider validation.
- Define future trips versus History without deleting or silently changing bookings.
- Persist whether a booking deadline is estimated or manually overridden. Calculate
  railway deadlines in the railway timezone and display local time unambiguously.
- Introduce compatible models for linked return trips, personal preferences and
  versioned reminder schedules. Specify what happens when a date changes.
- Add reclaimable delivery leases, bounded retries and deduplication. Recheck trip,
  user and channel eligibility immediately before sending. Cancel stale queued work.
- Decide how outages create missed-reminder notices rather than silently dropping
  old schedules. Never promise exactly-once delivery across external providers.
- Correct email verification and make first-admin bootstrap atomic. Test tenant
  isolation, permissions and secret redaction before expanding public signups.
- Replace bounded client datasets with server-side search, pagination and accurate
  aggregate counts; exclude past travel from current booking-action queues.

Gate:
- A plan can be created, edited, marked booked and retained without any PNR.
- Editing a date supersedes the old schedule; an old queued reminder cannot send.
- Workers recover after a crash; concurrent workers do not claim the same job.
- Users cannot read another user's trips, files, destinations or secrets.
- Migrations are rehearsed on a backup copy, preserve data and support a staged rollout.

Primary areas: Prisma schema/migrations, journeys API, tickets, reminders, dates,
authentication and settings services. Keep Next.js, PostgreSQL and the existing
worker approach; no infrastructure rewrite is required for this scope.

## Phase 3: New Shell, Today and Complete Trip Workflow

Outcome: the main everyday workflow is usable in the new UI end to end.

Work:
- Implement the new responsive shell, navigation, header and shared components.
- Build Today around actionable bookings and the next booked journey. Use actual
  instants for urgency; a deadline later today must not already show as open.
- Rebuild Trips with server-side filters, sorting, pagination and shareable URLs.
  Keep search, selected trip and scroll context when opening and closing details.
- Build the shared Add/Edit trip form with route favourites, swap direction,
  duplicate, Add return and optional selection of additional travel dates.
- Avoid four mandatory station fields: support saved routes and a local station
  catalogue if available, with manual entry. This is not live train search.
- Create one Trip details view for Today, Trips, Calendar and reminder links.
  Expose Edit, Mark booked, Link PNR and Delete clearly; secondary actions use a menu.
- Keep PNR/class/seat placeholders out of unbooked plans. Preserve existing real PNR
  details, but distinguish an entered PNR from a successfully refreshed snapshot.
- Confirm permanent deletion and explain its effect on reminders. Preserve existing
  document/export functions in a secondary menu where they remain useful.
- Redirect legacy routes and remove obsolete navigation without breaking old links.

Gate:
- On desktop and mobile, create a round trip, edit one leg, mark it booked without
  PNR, attach PNR later and delete the other leg without losing navigation context.
- Large datasets remain searchable; all records are reachable, not capped at 1,000.
- User acceptance review uses both sparse and dense data and real error states.

## Phase 4: Reminders, Inbox, Settings and Account Access

Outcome: users can configure and trust their own reminders without deployment edits.

Work:
- Build personal Settings for verified delivery email, private Discord destination,
  timezone, weekend days, optional week-start override and reminder presets.
- Keep admin Settings separate: users, signups, SMTP, available channels, default
  calendar week start, booking defaults, PNR provider and service health.
- Only show channel-specific fields when relevant. Save explicitly, preserve masked
  secrets and provide rate-limited test actions with actionable failure messages.
- Support reminders relative to the booking deadline, using validated presets and
  bounded custom timing. Show the concrete next send date/time before saving.
- Quiet hours apply to ordinary notices; users explicitly choose whether exact
  booking alerts may bypass them. Do not silently move a critical deadline alert.
- Show per-trip Scheduled, Sent to provider or Failed states accurately. Provider
  acceptance is not proof that an email was read or reached an inbox.
- Refresh the notification inbox when opened and after changes, with appropriate
  background refresh while the app is active. Include pagination and true unread counts.
- Use route, travel date and absolute booking time in messages. Offer View trip,
  Snooze, Mark read and Mark booked where applicable. Future schedules are not unread alerts.
- Rebuild sign-in, verification, invitation and password recovery with the same
  design system and accessible validation; place personal access settings in Settings.

Gate:
- Two users receive only their own reminders, including Discord messages.
- No notification requires reading an internal identifier to identify the journey.
- Test-delivery failures, disabled services and missing destinations are visible.
- In-app reminders are explicitly an inbox, not browser push or an offline alert.
- Booking or changing a trip updates its inbox state and cancels obsolete sends.

## Phase 5: Calendar, Leave and Useful Suggestions

Outcome: planning dates and booking deadlines are understandable at a glance.

Work:
- Rebuild FullCalendar presentation with one title, accessible Lucide navigation,
  a compact toolbar and a restrained event palette with text/icon distinctions.
- Default to Sunday first, following the admin default unless a personal override
  is set. Preserve Saturday/Sunday leave defaults independently of week-start display.
- Use month and agenda as primary views; retain week only if it remains useful.
  Cap visible month-cell events and open an accessible agenda for overflow.
- Every event opens its specific trip or leave details. A booking event displays the
  corresponding travel date, including when several trips share the same route.
- Integrate Company and Personal leave CRUD and existing CSV/ICS import. Do not
  reintroduce National/State types or a region field. Show import errors and duplicates.
- Replace the long suggestion feed with prioritised, dismissible suggestions:
  missing return leg, overlapping plans, leave/commute conflict, duplicate trip,
  reminders unavailable or multiple booking deadlines at the same time.
- Require user-provided travel purpose before inferring that leave makes a trip
  unnecessary. Explain evidence and show the affected dates; confirm all changes.
- Exclude past, dismissed and irrelevant suggestions. Do not claim demand or
  confirmation probabilities without a validated source.

Gate:
- Calendar is readable on a phone and when many events share a day.
- Booking, travel and leave cannot be confused solely because colours are similar.
- Suggestions identify the exact trip and offer a useful action, not generic advice.

## Phase 6: Production Verification and Controlled Release

Outcome: the complete redesigned core is eligible for real everyday use.

Work:
- Test the whole create-to-book workflow in a real browser, with keyboard navigation,
  mobile layouts, zoom, screen-reader labels and reduced motion.
- Exercise provider outages, email failures, worker restarts, concurrent jobs, date
  changes, closed signups, expired sessions and denied cross-user requests.
- Run unit, integration and end-to-end suites, lint, type checking and production
  builds in CI. Add visual regression coverage for the agreed screen states.
- Measure server queries and page performance on representative large accounts.
  Set explicit latency and reminder-lateness targets and alert on violations.
- Add operational visibility for queue age, exhausted retries, worker heartbeat,
  provider failures, errors and backup freshness without exposing PNRs or secrets.
- Store encrypted backups off-cluster, protect encryption keys separately and prove
  a restore. Agree recovery objectives; document incident and recovery procedures.
- Test compatible migrations and application rollback. Publish an identifiable
  build version, verify the deployed image/version and smoke-test the live app.
- Release through staging and a small invited pilot before enabling wider signups.
  Observe whether users can complete tasks and whether reminders arrive as intended.

Gate:
- No unresolved critical/high issues in authentication, user isolation, data loss or
  reminder delivery paths. No broken core flow or inaccessible primary control.
- Backup restore and restart recovery are demonstrated, not merely documented.
- The release version is verified in the deployed app and core smoke tests pass.
- Pilot feedback is addressed before describing the app as ready for wider use.

## Phase 7: Optional Enhancements After the Core Release

These must not block the production-ready planning/reminder release.

- Provider-specific PNR adapters with strict response validation, all-passenger
  details, source/freshness indicators and bounded refresh for relevant journeys.
- Retry first-time lookup failures and configure existing tickets when enabling
  auto-refresh. Never overwrite a manual plan with provider differences silently.
- Ticket PDF or pasted booking-text import with confirmation and private,
  access-controlled storage; validate file types, sizes and retention.
- Optional offline access to selected ticket details, with clear stale-state labels,
  opt-in storage and removal on logout. Never cache provider credentials.
- Optional Tatkal planning only when the necessary train-origin date and category
  are known. Do not make class mandatory in the ordinary Add trip form.
- Evaluate additional features from observed traveller needs, not feature count.

## Delivery Rules

- Phase 1 has a reviewable prototype; Phase 2 remains read-only planning. Agree the
  target model and design before their dependent production changes.
- Each phase ends with tests, a changelog and a reviewable running preview. Backend
  foundations can ship compatibly; keep incomplete redesign routes out of public use.
- Keep live user data out of screenshots, test fixtures and external research tools.
- Do not automatically deploy, rename the product or change production notification
  destinations as a side effect of writing this plan.
- Prefer backwards-compatible migrations and one deliberate cutover after the core
  UI is complete; do not leave users navigating permanently between design systems.
- Update architecture, API contracts and user-flow documentation with implementation.
- Reassess scope after each review. Any new feature must make booking preparation,
  reminder reliability or booked-trip access measurably easier.

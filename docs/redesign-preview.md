# Phase 1 Design Preview

Status: historical design record, superseded by the live workspace. The prototype
and its fixtures have been removed; /design-preview now redirects to /today.
See live-workspace-release.md for current behaviour. The rest of this document
describes the earlier review, not an available application mode.

## Open the Preview

Run the existing Next.js development server and open /design-preview. The current
local preview is at http://127.0.0.1:3100/design-preview.

The route only renders when NODE_ENV is development. The production build emits
a 404 for it. It does not use application APIs, the database, SMTP, Discord or a
PNR provider. Fixtures are visibly labelled as a preview and anchored to
26 September 2026 at 08:10 IST. Reloading discards all local changes.

Example screens:
- /design-preview?screen=today
- /design-preview?screen=trips
- /design-preview?screen=calendar
- /design-preview?screen=settings
- /design-preview?screen=inbox
- /design-preview?screen=signin

The Preview controls menu provides typical, busy (64 trips), empty, loading and
connection-error scenarios. A scenario switch resets the sample trips and notices.
Use these to evaluate layout density, empty states and recovery copy.

## Reviewable Interactions

- Desktop collapsible sidebar; mobile bottom navigation; one header title.
- Today shows actionable booking windows, upcoming windows and the next journey.
- Trips supports filters, search, sort and local pagination over sample records.
- Add a single trip or outbound/return pair with route presets and per-trip channels.
- Inspect, edit, duplicate, mark booked without PNR, attach/unlink a PNR and delete.
- Protect unsaved trip edits; close dialogs with Escape, backdrop or a close button.
- Open the same trip details from lists, calendar events and notification links.
- Dismiss the notification popover outside or with Escape; mark read and preview
  snoozing. Marking a trip booked removes its booking notices from the active inbox.
- Configure personal channels and timing; conditionally reveal destination fields.
- Toggle admin service availability, public signup and default calendar week start.
- Save local preferences and inspect their effect on the calendar and trip forms.
- Create, edit and delete company/personal leave; switch calendar month/agenda.
- Preview sign-in, signup, verification, invitations and password recovery. These
  are interface flows only, not real authentication or email delivery.

## Deliberate Prototype Boundaries

- Data and preferences are held in memory, not persisted to local storage or a server.
- Test-delivery and password-recovery responses explicitly say no message was sent.
- PNR input saves a manual sample reference; there is no fabricated live seat data.
- Admin membership is a sample listing; real invitations/roles, integrations,
  security enforcement and scheduled workers remain implementation work.
- The production design will use server-side filtering/pagination and actual read
  totals. Local pagination is appropriate only for this isolated design fixture.
- Reminder timing demonstrates presets. Custom schedules, actual snooze jobs,
  verified destinations and precise delivery history depend on Phase 2.
- CSV/ICS importing, accessibility audit beyond the checked flows, offline tickets
  and provider-specific integrations are not implemented by this preview.
- Do not enter real SMTP passwords, API keys or personal PNRs into a design exercise.

## Verification

Verified on 26 September 2026: lint, type checking, production build and the
63-test suite passed. The Playwright script passed all six screens at five
viewport widths, with no browser exceptions or application API calls. Desktop
and mobile screenshots were inspected and layout issues corrected. Production
build metadata reports 404 for /design-preview; its CSP does not include unsafe-eval.

The browser script is scripts/verify-design-preview.mjs. It requires Playwright
and a local Chrome installation. PLAYWRIGHT_MODULE may point to a bundled
Playwright installation; PREVIEW_URL may point to another development port.

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3100
node scripts/verify-design-preview.mjs
```

The script checks:
- Add outbound/return, mark booked without PNR, edit, unsaved-change protection,
  confirmed deletion and notification outside-click/Escape dismissal.
- Conditional delivery fields and inherited/admin versus personal week start.
- Dense-list pagination, search and collapsed sidebar.
- Six screens at 320, 390, 768, 1280 and 1920px without page-wide overflow.
- Mobile forms, password recovery and empty/loading/error scenarios.
- No browser exceptions and no application /api/ requests.

Screenshots are saved to build/design-preview-qa, which is gitignored. The model
has focused unit tests for optional PNR, current/past trips, exact booking instants,
fixture search and date/return validation. Run the existing lint, typecheck,
test:coverage and build commands as well.

During this work, Next.js regenerated its own AGENTS.md block. The only shared
configuration changes hide the development badge and permit the React development
debugger on /design-preview in development. Production security headers are unchanged.

## Review Gate

Review hierarchy and density in Today and Trips, then complete one outbound/return
flow on desktop and phone. Review the calendar and settings layout as part of the
same experience. Capture design changes before replacing live screens.

Phase 2 planning is in redesign-phase-2-implementation.md. No existing journey,
reminder, account, secret or database table has been changed by this prototype.

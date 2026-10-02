# Desktop, mobile and PWA review

Reviewed the live Chrome app on 2 October 2026 at desktop 1482×876 and phone-sized 390×844 and 320×740 viewports, in light and dark themes. Responsive viewport checks are not physical Android/iPhone installation tests. No ticket, account or provider data was changed; the theme was restored after review.

## Findings and delivery checklist

- [x] Fix mobile navigation: inherited `width:100%` makes each bottom link almost a full phone width. Provide Home, Journeys, Calendar and More, with all other pages accessible under More.
- [x] Give mobile journeys a status selector so 35 planned cards do not bury booked tickets and cancellation tasks. Keep desktop Kanban and drag/drop.
- [x] Reduce dashboard metric/card padding and repeated summaries; prioritize attention and next booking openings. Explain the chart denominator. Make metric links select the corresponding journeys.
- [x] Use a journey summary before editing, with ticket details, original PDF access, quick cancellation confirmation and an explicit Edit action. Compact booking information and keep editing actions visible.
- [x] Guard unsaved dialog changes, including close, Escape and backdrop dismissal.
- [x] Distinguish cancellation-pending/calendar statuses with text and amber styling, and provide a selectable agenda view for mobile rather than only tiny dots.
- [x] Group consecutive leave days for display without changing individual stored days or removal semantics. Align columns and offer mobile access to weekend suggestions without scrolling through every leave day.
- [x] Compact routine cards, preserve independent direction editing, and avoid stretching cards merely to fill empty space.
- [x] Improve small muted metadata in both themes; retain readable body text and touch controls. Reduce headings modestly rather than scaling the whole app down. Use 16px mobile text inputs to avoid iOS focus zoom; account for safe areas.
- [x] Make settings tabs fit phones, hide irrelevant planning inputs, simplify long integration instructions, and preserve independent settings saves/kebab actions.
- [x] Normalize displayed station codes without rewriting imported ticket data. Improve PDF viewer zoom/fit/download controls.
- [x] Clarify History/Archive and seven-day PDF deletion copy. Clarify booking openings and cancellation-pending days in the weekly strip.
- [x] Add standalone PWA manifest, app icons, Apple metadata, installation guidance, safe-area spacing and an offline fallback. Do not cache authenticated pages, API responses or ticket PDFs. Updates should not leave an old application shell cached.

## Scope and acceptance

Check all primary pages, settings and item dialogs at 320px, 390px, tablet and desktop widths in both themes. No unexpected page overflow; navigation destinations remain visible/reachable; essential controls support touch and keyboard. Validate manifest/icon endpoints, scoped service worker registration, network-only private data, and offline navigation fallback. Physical Android Chrome and iPhone Safari installation remains a separate acceptance check; document it honestly.

Keep server reminder jobs, persistence, retention and outgoing provider connections unchanged. Installability does not add browser push or offline ticket access. HTTPS is required for production PWA installation; localhost is suitable for development. A plain HTTP self-hosted address remains usable as a website but cannot promise the same installation/service-worker capabilities.

Operational backlog (reminder recovery, pagination, monitoring and restore rehearsals) stays in production-readiness.md. This review does not silently expand into those projects.

## Verification result

Implemented on feat/mobile-pwa-ux. This checklist records code delivery, not a production deployment. Automated checks cover every main route in light/dark at 320, 390, 768 and 1482 pixels, four visible mobile destinations, More navigation, status switching, settings tab fit, agenda, guarded journey edits and the PWA offline cache. Physical-device acceptance remains in mobile-pwa.md.

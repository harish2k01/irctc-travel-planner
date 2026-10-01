# Railplan deployment

Railplan is the application at `/railplan`. Sign up or sign in at `/`. Plans and ticket files are stored in PostgreSQL, encrypted with the application key. This repository uses a fresh initial schema; install it against a new empty database. The old app and browser prototype have been removed.

## Local run

Run `docker compose up --build`. The migration service prepares the database, the app serves port 3000, and the worker processes reminders every minute. Compose uses development credentials only. Its named PostgreSQL volume persists through container restarts; do not remove that volume to update the app.

Alternatively, configure `.env` from `.env.example`, run `npm ci`, `npm run prisma:generate`, `npm run prisma:migrate:deploy`, and `npm run dev`. A separately scheduled authenticated POST to `/api/internal/railplan/process` is required for background work.

## Homelab: GHCR, Helm, and Argo CD

Local-only deployment files (not included in the release PR): the chart in `deploy/chart` follows the portfolio's container/GitOps hosting pattern. Release CI publishes the existing GHCR image. Pin a published digest in `image.digest` before syncing; `development` is a placeholder, not a release. Confirm the hostname in BOTH `publicUrl` and `gateway.hostname`. The defaults retain the existing planner hostname: do not install a competing HTTPRoute for that hostname during a parallel rollout. Use a temporary unique hostname or coordinate the existing route cutover.

Create namespace `railplan` and an externally managed Secret named `railplan-secrets` with these keys:

- `POSTGRES_PASSWORD`: random database password.
- `DATABASE_URL`: `postgresql://railplan:<URL-encoded-password>@railplan-postgres:5432/railplan?schema=public`.
- `APP_ENCRYPTION_KEY`: base64 of 32 random bytes. Keep this key stable and back it up separately; losing it makes stored plans, files, and credentials unreadable.
- `CRON_SECRET` and `RATE_LIMIT_SALT`: separate random values.

Never commit populated secrets. Supply registry pull credentials in `imagePullSecrets` if the GHCR package is private. Verify the configured storage class, Traefik Gateway reference, DNS, and HTTPS certificate. Readiness checks database migrations and encryption configuration. Argo sync waves provision PostgreSQL, run migrations, then start the application and its minute CronJob. `deploy/argocd-application.yaml` intentionally uses manual sync; update its source revision and values to the reviewed release before applying it through your homelab GitOps repository.

The first account becomes administrator. The workspace has shared booking-window settings per account. Existing installations must use a new database and deployment namespace; this baseline is not an upgrade migration for the old app.

Before production use, arrange regular PostgreSQL backups, retain the encryption key, and test restoring both. PostgreSQL contains ticket attachments as well as plans. Upload limits are 10 MiB per PDF/image and 250 MiB total per account. The chart provisions durable storage but does not provision a backup destination or backup schedule.

## WhatsApp setup later

Add `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` (a currently supported Meta Graph version), `WHATSAPP_TEMPLATE_NAME`, and optionally `WHATSAPP_TEMPLATE_LANGUAGE` (default `en`) to the application Secret. Approve a Meta template with three body text parameters in this order: route, travel date, booking-opening date/time. Example: "Book {{1}} for {{2}}. Booking opens {{3}}."

After restarting the app, each user adds an international phone number and enables WhatsApp in Settings. Until credentials exist, WhatsApp is disabled and no messages are sent. In-app reminders still work. Worker leases and deterministic job identities prevent ordinary duplicate processing; delivery retries can produce a duplicate if Meta accepted a message but the response was lost. Provider delivery requires a live setup test.

## Google Calendar

Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register the exact HTTPS redirect URI `<publicUrl>/api/railplan/google/callback` in your Google OAuth application and configure consent/test users or publishing as appropriate. Each user connects in Settings. The app creates a dedicated Railplan calendar using the `calendar.app.created` scope and synchronizes journeys, booking events, and company/personal holidays. Pausing sync retains existing calendar events. Credentials are encrypted. Live OAuth and provider behavior require testing after setup.

## Validation

`npm run verify` runs type checking, lint, tests with coverage, and the production build. Database tests require `RUN_DB_TESTS=1` and an isolated database whose name ends in `_test`. `npm run test:e2e` requires `RUN_E2E=1`, that isolated database, and Playwright Chromium. The browser suite resets that test database and checks the account workflow. Never use a live database for it.

# RailWatch Deployment

The dashboard is at `/`, authentication at `/login`, and each section has its own route. PostgreSQL holds private account workspaces, encrypted tickets, jobs, and provider credentials.

## Local Run

Run `docker compose up --build` for PostgreSQL, migrations, the app on port 3000, and a worker. Compose credentials are for development only; its named volume persists across updates. Alternatively configure `.env` from `.env.example`, install dependencies, generate Prisma, apply migrations, and run `npm run dev`. Background work requires a scheduled authenticated POST to `/api/internal/railwatch/process` every minute.

## Manual Kubernetes Deployment

Pin `ghcr.io/harish2k01/railwatch` to the digest in the release's `image.json` asset. The homelab deployment uses namespace `railwatch`, PostgreSQL 18 with database/user `railwatch`, two web replicas, a minute worker CronJob, and daily database backups. Deployment manifests remain local until GitOps is enabled.

The public URL is `https://railwatch.k8s.harish2k01.xyz`. The HTTPRoute references `traefik/traefik-gateway`, listener `websecure`, and path prefix `/`. The existing `wildcard-k8s-tls` certificate covers this hostname; no additional certificate or Caddy site is required.

Set runtime `APP_URL` to the public HTTPS URL. Supply an externally managed `railwatch-secrets` Secret with:

- `POSTGRES_USER`, `POSTGRES_DB`, and a random `POSTGRES_PASSWORD`.
- `DATABASE_URL`: `postgresql://railwatch:<URL-encoded-password>@railwatch-postgres:5432/railwatch`.
- `APP_ENCRYPTION_KEY`: base64 of 32 random bytes. Preserve and back up this key separately.
- Independent random `CRON_SECRET` and `RATE_LIMIT_SALT` values.

Never commit populated secrets. Run Prisma migrations before rollout, then verify readiness, worker execution, and HTTPS. Supply registry credentials if the GHCR package is private. Backups contain encrypted plans and ticket files; restoration also requires the original encryption key. Supplement daily cluster-storage backups with an off-cluster copy and a restore test.

## Accounts And Shared Settings

The first account becomes administrator. Admin Settings controls signup availability, booking-window days, reminders, WhatsApp, Google Calendar, ticket uploads, and calendar exports for every account. Disabled features disappear from User Settings; provider actions are also blocked on the server.

User Management supports invitations, temporary-password accounts, role changes, and account disabling. Temporary-password users must choose their own password before accessing plans. Invitations expire after 24 hours and can be used once. Configure SMTP in Admin Settings or through `SMTP_URL` and `EMAIL_FROM`. Without SMTP, administrators can copy and share the invitation link.

Users manage username, email, phone, preferences, connections, and passwords in User Settings. Changing email requires the current password. Email/password changes sign out other sessions. Plans and tickets are private per account. Upload limits are 10 MiB per file and 250 MiB per account.

## WhatsApp Setup Later

Add `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` (a supported Meta Graph version), `WHATSAPP_TEMPLATE_NAME`, and optional `WHATSAPP_TEMPLATE_LANGUAGE` (default `en`) to the application Secret. Approve a template with three body parameters: route, travel date, and booking-opening date/time. Restart the app and worker.

Each user adds an international phone number under User Settings / Profile and enables WhatsApp under Connections. The administrator must permit reminders and WhatsApp. Without provider credentials, no WhatsApp messages are sent; in-app reminders still work. A retry can duplicate a message if Meta accepted it but its response was lost. Verify live delivery after setup.

## Google Calendar

Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and runtime `APP_URL`. Register `<APP_URL>/api/railwatch/google/callback` as the exact redirect URI, with appropriate OAuth consent/test users. Each user connects under User Settings / Connections when the administrator permits it. RailWatch creates a dedicated calendar with `calendar.app.created`, synchronizing journeys, booking events, and company/personal holidays. Pausing sync retains existing events. Verify live OAuth after setup.

## Validation

`npm run verify` checks types, lint, coverage, release logic, and production build. Database tests need `RUN_DB_TESTS=1` and an isolated database ending in `_test`. Browser tests need `RUN_E2E=1`, that isolated database, and Playwright Chromium. They reset the test database and cover private workspaces, routing, tickets, invitations, user access, and feature controls. Never run them against production. CI runs browser tests on PRs; release validation excludes them.

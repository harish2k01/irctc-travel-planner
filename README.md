# RailWatch

A self-hosted train travel planner with configurable recurring journeys, booking reminders, a Kanban board, calendar, company holidays and personal leave, and private PDF/QR ticket storage.

## Run locally

Requires Node.js 24+ and PostgreSQL. Copy .env.example to .env, configure a fresh database and a base64-encoded 32-byte encryption key, then run:

```sh
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Or use `docker compose up --build` for a local app, persistent PostgreSQL, migrations, and a background worker. Compose credentials are for development only. Sign up at http://localhost:3000; the first account is administrator.

## Deployment and providers

[Deployment guide](docs/railplan-deployment.md) covers GHCR releases, manual Kubernetes hosting, secrets, backups, WhatsApp setup, and Google Calendar OAuth. Providers can be configured later.

The dashboard is at `/`; journeys, calendar, routines, holidays, tickets, and admin pages have their own routes. User Settings manages profile details, phone number, preferences, connections, and passwords. Admin Settings contains General, Integrations, and User Management. Administrators control shared booking rules and features, configure encrypted Google/WhatsApp credentials in the app, create or invite users, and manage roles and access. Each account has a private workspace.

Set `APP_URL` to the public base URL at runtime so invitation links, password resets, and Google OAuth use the deployed hostname. The first account becomes administrator. Existing RailWatch installations can apply the checked-in Prisma migrations; a fresh installation starts with an empty database.

## Verify

`npm run verify` runs type checking, lint, coverage, and the production build. Database tests need `RUN_DB_TESTS=1` and an isolated database ending in `_test`. Browser tests need `RUN_E2E=1`, that isolated database, and Playwright Chromium: `npm run test:e2e`. The browser suite resets the test database.

## Releases

Like portfolio-next, every PR needs exactly one label: `major`, `minor`, or `patch`. After merge, validation runs before release reconciliation assigns the next version to each merged PR in order. The release workflow publishes that exact commit to GHCR with `vX.Y.Z`, `X.Y.Z`, full commit-SHA, and latest aliases. The `image.json` release asset records the digest for manual deployment. Retries reuse an existing commit image. The fresh rebuild is a major release because it requires an empty database.

Deployment charts and Argo CD definitions are being kept locally until GitOps deployment is enabled; this PR does not include them.

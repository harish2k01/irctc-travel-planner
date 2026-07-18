# IRCTC Travel Planner

A self-hosted Indian Railways ticket planning and PNR tracking application. It tracks tickets that need to be booked, computes booking windows, sends configurable reminders, links a plan to a PNR after booking, and combines travel dates with company and personal leave.

This project is independent and is not affiliated with or endorsed by IRCTC or Indian Railways. It does not automate login, CAPTCHA, booking, or payment.

## Capabilities

- Optional PNR tagging; plans can be created before a ticket is booked
- Per-ticket email, Discord, and in-app reminder channels
- Persistent reminder delivery with retry and read history
- Calendar with booking, travel, company leave, and personal leave events
- Ticket-specific leave and booking suggestions, including Saturday/Sunday leave
- Administrator-controlled signups, invitations, users, delivery settings, and booking timing
- One-time invitation and password-reset links
- Encrypted PNR, SMTP, and Discord values at rest
- PostgreSQL migrations, health endpoints, audit records, rate limits, and worker endpoints

## Technology

Next.js App Router, React, TypeScript, Tailwind CSS, FullCalendar, PostgreSQL, Prisma, Zod, Vitest, Docker, Kubernetes Gateway API, and GitHub Actions.

## Local Setup

Requirements: Node.js 24 and PostgreSQL 18.

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Open `http://localhost:3000`. The first account becomes the administrator. No tickets, holidays, analytics, or other user data are seeded.

Docker Compose runs PostgreSQL, migrations, and the application:

```bash
docker compose up --build
```

The Compose encryption key is only for local development. Replace every credential in production.

## Configuration

Required environment variables:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `APP_ENCRYPTION_KEY`: base64-encoded 32-byte key
- `CRON_SECRET`

SMTP and Discord values can be entered in Settings and are encrypted before storage. Environment variables remain supported as deployment-level fallbacks.

## PNR Provider

The app expects a licensed provider endpoint in `PNR_PROVIDER_URL`. Use `{pnr}` in the URL or accept a `pnr` query parameter. Optional authentication uses `PNR_PROVIDER_API_KEY` as both a bearer token and `x-api-key`.

Expected response fields can be top-level or under `data`: `trainNumber`, `trainName`, `travelDate`, `class`, source/destination codes and names, current status, coach, seat, and passengers.

RailRadar currently documents train, station, route, and live-running APIs, not PNR lookup, and states that it does not collect PNR numbers. Its live-train endpoint must not be configured as a PNR provider. See [RailRadar API documentation](https://railradar.in/docs) and [privacy policy](https://railradar.in/privacy).

Without a valid provider, ticket plans and PNR tags still work; only automatic PNR detail refresh is unavailable.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

`npm run verify` runs the complete local quality gate.

## Releases

Conventional commits drive semantic versions:

- `feat:` minor release
- `fix:`, `perf:`, `revert:` patch release
- `type!:` or `BREAKING CHANGE:` major release
- `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `build:` patch release

The release workflow verifies the source before publishing a versioned GHCR image and only creates the GitHub Release after the image succeeds. Images include provenance and SBOM attestations.

## Kubernetes

The canonical manifest is [k8s/irctc-travel-planner.yaml](k8s/irctc-travel-planner.yaml). It includes the web deployment, PostgreSQL StatefulSet, migration template, reminder and PNR workers, backup job, HPA, PDB, network policies, health probes, Service, and Traefik Gateway API `HTTPRoute` for `irctc-travel-planner.k8s.harish2k01.xyz`.

Secret creation and migration instructions are in [k8s/README.md](k8s/README.md). Keep database backups off-cluster as part of the recovery plan.

## Security and Privacy

See [SECURITY.md](SECURITY.md) for vulnerability reporting and [PRIVACY.md](PRIVACY.md) for stored data and retention guidance.

## License

[MIT](LICENSE)

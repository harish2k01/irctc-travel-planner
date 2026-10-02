# RailWatch Services

RailWatch has a Next.js frontend, a Fastify backend, and PostgreSQL. A single immutable GHCR image contains both application entrypoints; deploy it twice with different roles. Frontend and backend processes, credentials, health checks, replicas, and network access are independent.

| Service | Runtime configuration | Access |
| --- | --- | --- |
| Frontend | `RAILWATCH_SERVICE=frontend`, `BACKEND_URL=http://railwatch-backend:3001`, `APP_URL` | Public port 3000; outgoing requests to backend only |
| Backend | `RAILWATCH_SERVICE=backend`, `BACKEND_PORT=3001`, `APP_URL`, database/encryption/rate-limit/provider secrets | Private port 3001; database, DNS, SMTP, and provider egress |
| PostgreSQL | Existing database/user/password and persistent storage | Private port 5432; backend and operational migration/backup tasks only |

The frontend renders authenticated pages using the backend's session API. Browser API calls use a same-origin gateway, so no cross-origin cookies or CORS setup is needed. Authentication, authorization, request size limits, storage, and provider access remain enforced in the backend. Session cookies are secure for HTTPS deployments and work on an HTTP LAN origin when `APP_URL` uses HTTP. Never expose HTTP credentials across an untrusted network.

The backend starts a scheduler on boot and checks work at minute boundaries after each completed run. PostgreSQL advisory locking selects one active run across replicas. Each reminder also retains a durable claim, delivery state, and retry schedule in the database. Telegram uses outgoing polling. Google OAuth and Telegram authorization return through the user's browser; providers do not initiate server connections. Provider timeouts are bounded. Graceful shutdown waits for current processing, so give the backend up to 300 seconds to terminate.

Set `SCHEDULER_ENABLED=false` for tests or deliberately API-only replicas. At least one production backend must leave it enabled. The authenticated `/api/internal/railwatch/process` endpoint remains for operational/manual processing and PR tests, uses the same scheduler lock, and never creates a Kubernetes job. Its bearer secret is not sent to the frontend.

## Upgrade An Existing Installation

1. Back up PostgreSQL and preserve its encryption key, database credentials, and persistent volumes.
2. Apply the release's Prisma migrations using a one-time task with backend secrets.
3. Deploy the private backend and permit backend access to PostgreSQL, DNS, HTTPS providers, and the configured SMTP port.
4. Confirm `/api/health/ready` on the backend. The existing plans, users, provider credentials, and tickets require no data conversion.
5. Deploy the frontend with `BACKEND_URL` and `APP_URL` only. Permit frontend-to-backend traffic; do not mount backend secrets into the frontend.
6. Switch the existing HTTPRoute's service to the new frontend after readiness succeeds.
7. Suspend and remove the old minute worker CronJob and its owned jobs. Retire the old combined web deployment once the new frontend is ready. Keep PostgreSQL and the daily backup CronJob.
8. Verify login, journey storage, ticket downloads, and backend scheduler logs. Browser E2E tests run only in PR CI.

Helm and Argo CD definitions remain local. The manual deployment helper is also local under ignored `build/`. Release versioning and the digest recorded in `image.json` remain unchanged.

## Local Development

`npm run dev` starts the frontend on 3000 and backend on 3001. The backend reads `.env`. `docker compose up --build` runs separate frontend/backend/database services and migrations. Compose credentials are development examples; existing `postgres-data` storage is preserved. No separate worker container is required.

`npm run build` builds both services. `npm run start:backend` starts the compiled backend; `npm start` serves the frontend outside Docker. Container startup selects its role using `RAILWATCH_SERVICE`. Backend health endpoints are `/api/health/live` and `/api/health/ready`; the frontend forwards them to check the complete request path.

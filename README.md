# IRCTC Travel Planner

A calendar-first commute planner for working professionals who travel regularly by Indian Railways. The app helps users plan journeys, track booking windows, manage holidays/leave, and monitor travel spending.

This is not an IRCTC booking platform. It does not automate IRCTC login, CAPTCHA solving, ticket purchase, or payment flows.

## Stack

- Next.js App Router with React and TypeScript
- Tailwind CSS with shadcn-style local components
- FullCalendar for unified travel/reminder/holiday calendar views
- Recharts for analytics
- PostgreSQL with Prisma ORM
- zod-validated API handlers
- Docker and Kubernetes deployment assets

## Quick Start

```bash
npm install
npm run prisma:generate
npm run dev
```

Open `http://localhost:3000`.

The app starts with no journeys when `DATABASE_URL` is not set. Set `NEXT_PUBLIC_USE_DEMO_DATA=true` if you want to show bundled demo journeys locally.

## Run With PostgreSQL

```bash
copy .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Docker

```bash
docker compose up --build
```

The Compose file starts PostgreSQL and the Next.js app. Run migrations before production rollout:

```bash
npm run prisma:migrate
```

## Kubernetes

Base manifests are in `k8s/manifests.yaml` and include:

- Secret for `DATABASE_URL`
- ConfigMap for app configuration
- Deployment with readiness/liveness probes
- Service
- Ingress

Update image names, hostnames, and secret values before applying.

The test manifest in `k8s/irctc-travel-planner.yaml` creates:

- Namespace `irctc-travel-planner`
- PostgreSQL
- Schema/seed setup job
- Web deployment and service
- Gateway API `HTTPRoute` for `irctc-travel-planner.k8s.harish2k01.xyz` through `traefik/traefik-gateway`

Create the database secret in the cluster before applying the manifest. Do not commit real secret values to this public repository.

```bash
kubectl create namespace irctc-travel-planner
kubectl -n irctc-travel-planner create secret generic irctc-travel-planner-secrets \
  --from-literal=POSTGRES_DB=irctc \
  --from-literal=POSTGRES_USER=irctc \
  --from-literal=POSTGRES_PASSWORD='<strong-password>' \
  --from-literal=DATABASE_URL='postgresql://irctc:<strong-password>@irctc-travel-planner-postgres:5432/irctc?schema=public'
```

The manifest image is set to:

```text
ghcr.io/harish2k01/irctc-travel-planner:latest
```

If your public GitHub repo name differs, update the image to `ghcr.io/<owner>/<repo>:latest` or pin a released semantic version such as `ghcr.io/<owner>/<repo>:1.2.3`.

Apply when the cluster is reachable:

```bash
kubectl apply -f k8s/irctc-travel-planner.yaml
```

## GitHub Releases and Container Publishing

The workflow in `.github/workflows/build.yaml` builds the Docker image for pull requests without pushing it.

The workflow in `.github/workflows/release.yaml` runs when a pull request is merged into `main`, when `main` is pushed directly, or when manually dispatched. It computes the next semantic version from conventional commits, creates a GitHub Release, and publishes these image tags to GitHub Container Registry:

```text
ghcr.io/<owner>/<repo>:<major>.<minor>.<patch>
ghcr.io/<owner>/<repo>:<major>.<minor>
ghcr.io/<owner>/<repo>:<major>
ghcr.io/<owner>/<repo>:latest
```

Version bump rules:

- `feat:` creates a minor release.
- `fix:` and `revert:` create a patch release.
- `perf:` is listed under performance and creates a patch release.
- `type!:` or `BREAKING CHANGE:` creates a major release.

## Project Structure

```text
src/app                  Next.js routes and API handlers
src/components           Main travel planner UI
src/lib                  Domain types, seed data, date logic, validation, Prisma client
prisma                   Database schema and seed script
docs                     IA, user flows, schema notes, API contracts, wireframes
k8s                      Kubernetes manifests
```

## Domain Rules

- Booking open date is always `travelDate - 60 days`.
- Reminders are generated for:
  - 7 days before booking opens
  - 1 day before booking opens
  - booking-open day
- Journey states:
  - Planned
  - Booking Window Open
  - Booked
  - Waitlisted
  - RAC
  - Confirmed
  - Cancelled
  - Completed

## Planning Artifacts

- [Information architecture](docs/information-architecture.md)
- [User flows](docs/user-flows.md)
- [Database schema notes](docs/database-schema.md)
- [API contracts](docs/api-contracts.md)
- [Low-fidelity wireframes](docs/wireframes.md)

## Next Iterations

- Add real authentication with email/password and Google Sign-In.
- Add notification workers for email, Web Push, and in-app delivery.
- Add attachment upload to object storage.
- Add CSV export and holiday CSV/ICS import processors.
- Add optional IRCTC deep links without automation.

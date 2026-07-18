# API Contracts

All user APIs require a secure session. Mutations require same-origin requests, validate JSON with Zod, and return `{ data }` or `{ error: { code, message, details }, requestId }`.

- `GET|POST /api/journeys`: paginate/list or create ticket plans.
- `PATCH|DELETE /api/journeys/:id`: optimistic version update or delete an owned plan.
- `POST /api/journeys/:id/sync-pnr`: refresh an owned tagged PNR.
- `POST /api/pnr`: authenticated and throttled provider preview.
- `GET|PATCH /api/notifications`: list in-app deliveries or mark them read.
- `GET|POST /api/holidays`, `PATCH|DELETE /api/holidays/:id`: leave CRUD.
- `POST /api/holidays/import-ics`: bounded, public-network-only ICS import.
- `GET|PATCH /api/settings`: administrator settings without returning stored secrets.
- `GET|POST /api/settings/users`, `PATCH|DELETE /api/settings/users/:id`: administrator user management.
- `POST /api/internal/reminders/process`, `POST /api/internal/pnr-sync`: bearer-protected worker endpoints.
- `GET /api/health/live`, `GET /api/health/ready`: process and dependency health.

# API Contracts

Base path: `/api`

Authentication is designed for email/password and Google Sign-In. The current implementation uses a demo user id for local seed data; production auth should bind every request to the authenticated user.

## `GET /journeys`

Returns journeys with route, train, reminder, and attachment context when PostgreSQL is configured. Without `DATABASE_URL`, it returns an empty journey list unless `NEXT_PUBLIC_USE_DEMO_DATA=true` is set.

```json
{
  "data": [],
  "source": "database"
}
```

## `POST /journeys`

Creates a journey and generated reminders.

```json
{
  "routeId": "bengaluru-chennai",
  "trainId": "12624",
  "travelDate": "2026-08-18",
  "preferredClass": "3A",
  "direction": "HOME_TO_OFFICE",
  "recurrence": "WEEKLY",
  "notes": "High-demand Monday arrival"
}
```

Validation:

- `travelDate` must be `YYYY-MM-DD`
- `direction`: `HOME_TO_OFFICE`, `OFFICE_TO_HOME`
- `recurrence`: `ONE_TIME`, `WEEKLY`, `CUSTOM`
- `bookingOpenDate` is server-calculated as `travelDate - 60 days`

## `PATCH /journeys/:id`

Updates booking state and ticket details.

```json
{
  "status": "CONFIRMED",
  "pnr": "8214567390",
  "coach": "C3",
  "seat": "42",
  "bookingDate": "2026-05-04",
  "farePaid": 685
}
```

## `GET /holidays`

Returns national, state, company, and personal leave holidays.

## `POST /holidays`

Creates a holiday or leave day.

```json
{
  "name": "Company Recharge Day",
  "date": "2026-07-03",
  "type": "COMPANY",
  "region": "Bengaluru"
}
```

## `GET /notifications`

Returns notification preferences and queued reminder payloads.

## `GET /analytics`

Returns monthly chart data and aggregate metrics.

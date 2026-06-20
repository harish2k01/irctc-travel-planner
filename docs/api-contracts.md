# API Contracts

Base path: `/api`

Authentication uses email/password sessions. Every request is bound to the authenticated user.

## `GET /journeys`

Returns journeys with route, train, reminder, and attachment context for the authenticated user.

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

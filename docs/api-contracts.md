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
  "trainNumber": "16527",
  "trainName": "Example Express",
  "sourceCode": "SBC",
  "sourceName": "Bengaluru City",
  "destinationCode": "MAS",
  "destinationName": "Chennai Central",
  "travelDate": "2026-08-18",
  "preferredClass": "3A",
  "notes": "High-demand Monday arrival"
}
```

Validation:

- Either `trainId` or `trainNumber` + `trainName` is required.
- Either `routeId` or `sourceCode` + `destinationCode` is required.
- `travelDate` must be `YYYY-MM-DD`
- `bookingOpenDate` is server-calculated as `travelDate - 60 days`

## `GET /trains/search?q=:query`

Searches the authenticated user's saved trains first, then calls `TRAIN_SEARCH_PROVIDER_URL` when configured. The app does not scrape IRCTC.

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

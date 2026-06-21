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

Creates a tracked ticket and generated reminders.

```json
{
  "pnr": "8214567390",
  "sourceCode": "SBC",
  "sourceName": "Bengaluru City",
  "destinationCode": "MAS",
  "destinationName": "Chennai Central",
  "travelDate": "2026-08-18",
  "remindersEnabled": true,
  "notes": "Office travel"
}
```

Validation:

- `pnr` is required and must be 10 digits.
- Either `routeId` or `sourceCode` + `destinationCode` is required.
- `travelDate` must be `YYYY-MM-DD`
- `bookingOpenDate` is server-calculated as `travelDate - 60 days`
- Train number, train name, and booked class are optional and can be tagged later.

## `PATCH /journeys/:id`

Updates booking state and ticket details.

```json
{
  "status": "CONFIRMED",
  "trainNumber": "12624",
  "trainName": "Chennai Mail",
  "preferredClass": "3A",
  "coach": "C3",
  "seat": "42",
  "bookingDate": "2026-05-04",
  "remindersEnabled": false
}
```

## `GET /holidays`

Returns company holidays and personal leave days.

## `POST /holidays`

Creates a holiday or leave day.

```json
{
  "name": "Company Recharge Day",
  "date": "2026-07-03",
  "type": "COMPANY"
}
```

## `GET /notifications`

Returns email, Discord, and In-App notification preferences plus queued reminder payloads.

## `GET /analytics`

Returns monthly chart data and aggregate metrics.

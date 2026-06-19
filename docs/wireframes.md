# Low-Fidelity Wireframes

## Dashboard

```text
+--------------------------------------------------------------+
| IRCTC Travel Planner              [Next 30d] [Pending] [Spend]|
+--------------------------------------------------------------+
| [Dashboard] [Planner] [Tracker] [Calendar] [Holidays] [...]   |
+--------------------------------------------------------------+
| [Book Today] [Opens Tomorrow] [Waitlist Risk] [Trips] [Spend] |
+--------------------------------------------------------------+
| Upcoming journeys                         | Booking windows   |
| - Train, route, travel date, status       | - Train, open date |
| - Train, route, travel date, status       | - Train, open date |
+-------------------------------------------+------------------+
| Pending bookings | Confirmed bookings | Upcoming holidays     |
+--------------------------------------------------------------+
```

## Planner

```text
+-----------------------------------+--------------------------+
| Create journey                    | Generated reminders      |
| Train select                      | 7 days before            |
| Travel date | Class               | 1 day before             |
| Direction    | Recurrence         | Booking open             |
| Notes                             | Notification toggles     |
| [Add journey]                     | Email Push In-app        |
+-----------------------------------+--------------------------+
```

## Tracker

```text
+----------+-------------+--------+------------+-----+-----------+
| Planned  | Window Open | Booked | Waitlisted | RAC | Confirmed |
| card     | card        | card   | card       | card| card      |
| card     |             |        |            |     |           |
+----------+-------------+--------+------------+-----+-----------+
```

## Calendar

```text
+--------------------------------------------------------------+
| < > Today                  June 2026       Month Week Agenda  |
+--------------------------------------------------------------+
| Mon | Tue | Wed | Thu | Fri | Sat | Sun                       |
| Travel, booking-open, reminder, holiday events by color       |
+--------------------------------------------------------------+
```

## Analytics

```text
+--------------------------------------------------------------+
| [Average Fare] [Waitlist Frequency] [Success Rate] [Routes]   |
+--------------------------------------------------------------+
| Trips per month chart          | Travel spend trend chart     |
+--------------------------------------------------------------+
| Most used routes                                             |
+--------------------------------------------------------------+
```

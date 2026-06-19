# Information Architecture

## Primary Navigation

1. Dashboard
   - Upcoming journeys
   - Booking windows opening soon
   - Pending and confirmed booking summaries
   - Upcoming holidays and long-weekend signals
2. Planner
   - Quick journey creation
   - Origin/destination through preferred train
   - Preferred class, direction, recurrence, notes
   - Generated booking-open date and reminder dates
3. Tracker
   - Kanban columns by journey state
   - PNR, coach, seat, fare, attachment actions
4. Calendar
   - Travel dates
   - Booking-open dates
   - Reminder dates
   - Holidays and leave days
   - Month, week, agenda views
5. Holidays
   - National holidays
   - State holidays
   - Company holidays
   - Personal leave days
   - CSV import and ICS sync entry points
6. Analytics
   - Trips per month
   - Average fare
   - Most-used routes
   - Waitlist frequency
   - Booking success rate
   - Spend trends

## Object Model

- User owns routes, journeys, leaves, notifications, and attachments.
- Route groups a recurring city pair and owns train preferences.
- Train belongs to a route and can be reused across journeys.
- Journey is the central planning object.
- JourneyReminder is generated from bookingOpenDate.
- Holiday can be system-level or user-owned.
- LeaveRequest is user-owned and feeds calendar/suggestions.
- Notification tracks delivery across email, push, and in-app channels.
- Attachment stores ticket PDFs/screenshots through object storage keys.

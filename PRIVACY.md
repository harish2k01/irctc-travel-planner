# Privacy

IRCTC Travel Planner is self-hosted. The operator controls all stored data and is responsible for applicable privacy obligations.

The application stores account identity, sessions, ticket routes and dates, encrypted PNR values, provider ticket snapshots, reminders, leave dates, settings, and security audit records. It does not need passenger names, payment data, IRCTC credentials, or CAPTCHA data.

Recommended retention:

- Expired sessions and account tokens: remove after 30 days.
- Reminder delivery and audit records: retain only as long as operationally required.
- Archived tickets and PNR snapshots: provide an operator-defined deletion schedule.
- Database backups: encrypt, restrict, test restores, and expire on schedule.

Deleting a user cascades their tickets, PNR snapshots, reminders, leave dates, sessions, and tokens. Operators should document backup retention separately because database deletion does not remove older backups immediately.

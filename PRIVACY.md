# Privacy

Railplan is self-hosted. The operator controls stored data and retention.

The application stores account identity, sessions, encrypted travel plans and optional ticket details, uploaded PDF/QR files, reminder jobs, company holidays and personal leave, encrypted Google OAuth credentials, and security audit records. WhatsApp reminders send the route and travel/booking dates to Meta and the configured recipient. Google sync sends journey and holiday events to the connected calendar. Uploaded tickets may contain passenger information; access is restricted to the account owner.

Deleting an account cascades its workspace, files, jobs, calendar connection, sessions, and tokens. Calendar events and previously delivered provider messages are external copies. Database backups have separate retention and must be protected along with the encryption key. Operators should establish and test backup, account, audit, and attachment retention policies.

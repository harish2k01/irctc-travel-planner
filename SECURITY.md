# Security Policy

## Supported versions

Security fixes are applied to the latest released version.

## Reporting

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for this repository. Include the affected version, reproduction steps, impact, and any suggested mitigation.

## Deployment requirements

- Generate independent high-entropy values for `APP_ENCRYPTION_KEY`, `CRON_SECRET`, database credentials, and `RATE_LIMIT_SALT`.
- Terminate TLS at the Gateway and keep security headers enabled.
- Restrict database and worker endpoints to the cluster network.
- Run migrations and create a verified backup before upgrades.
- Rotate provider, SMTP, Discord, and database credentials after suspected exposure.
- Never commit `.env` files, Kubernetes Secrets, PNRs, or user exports.

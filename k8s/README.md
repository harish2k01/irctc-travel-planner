# Kubernetes deployment

The manifest expects an existing `irctc-travel-planner-secrets` Secret. Do not commit secret values.

Required keys:

- `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `APP_ENCRYPTION_KEY`: base64-encoded 32-byte key
- `RATE_LIMIT_SALT`: random value used to hash rate-limit identifiers
- `CRON_SECRET`: random worker authentication value

Optional PNR provider keys are `PNR_PROVIDER_API_KEY` and a `PNR_PROVIDER_URL` ConfigMap value containing `{pnr}` or accepting a `pnr` query parameter.

Run the suspended migration CronJob as a one-off Job before rolling out a new application image:

```sh
kubectl -n irctc-travel-planner create job --from=cronjob/irctc-travel-planner-db-migrate irctc-travel-planner-migrate-<version>
```

Database backups are written daily to `irctc-travel-planner-postgres-backups`. Copy them to off-cluster storage for disaster recovery.

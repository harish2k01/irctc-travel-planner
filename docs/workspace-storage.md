# Workspace storage and scheduler rollout

Apply the additive `20261004000100_normalized_storage` migration before deploying this backend. New columns default to the legacy storage format. This release reads both formats and ships with `RAILWATCH_NORMALIZED_STORAGE=false` by default.

## Activation

1. Deploy the new image with conversion disabled and wait until **every backend replica**, including scheduler replicas, runs the new image. Remove any older workers or maintenance processes that write workspaces.
2. Check readiness, API behavior and scheduler outcomes. Take a recoverable database backup using the installation's backup procedure.
3. Set `RAILWATCH_NORMALIZED_STORAGE=true` on the backend and wait for that rollout. Existing accounts convert atomically on their next workspace reconciliation; new accounts start with normalized storage. Conversion preserves the content revision and ticket links.

Do not enable conversion while an older backend remains active. Older code treats the workspace blob as the full planner and cannot read converted accounts. Disabling the flag stops further conversions but **does not revert** converted accounts. The flag belongs to the backend, not the frontend.

Format 1 keeps the complete encrypted planner in `RailWorkspace.payload`. Format 2 keeps encrypted settings, routines and holidays there, with an empty journeys array. Each `RailJourney.payload` is then the authoritative encrypted journey. The search/date/status index continues to use the existing account-specific encrypted/HMAC design. PDF contents remain encrypted in `RailFile`; its account-owned journey binding prevents a narrow edit from attaching a file already linked to an unloaded journey.

## Writes and compatibility

Partial saves read only base/edited journey IDs and current metadata, lock the account, merge compatible edits, reject conflicting edits and enforce ownership and the account journey cap. Journey-only edits preserve metadata ciphertext; settings-only edits preserve all journey ciphertext. Backup restoration and full-workspace APIs continue to read and write complete planners regardless of storage format. Existing backup files need no format change.

Full routine changes and daily reconciliation still load the complete account to extend routines, update lifecycle state and remove expired PDFs. Their index writes reuse unchanged journey payloads. This phase reduces routine API/save overhead; it does not eliminate every full-account operation. Google Calendar synchronization and complete exports also retain full-account reads.

## Scheduler limits and recovery

The scheduler persists its account cursor in `RailOperations`, processes at most 20 accounts per pass and wraps after the last account. Deleted cursor accounts do not break the next sweep. An account failure is logged without its planner contents, recorded as a failed heartbeat, and does not stop later accounts or due deliveries. The failed account is retried on a later sweep.

For normalized accounts, reminder planning reads 200 eligible journeys at a time and writes jobs in SQL batches of at most 500. A separate planning generation marks current jobs, allowing obsolete pending jobs to be cancelled without collecting every job key. Device/connection changes update planning even when the workspace content revision stays unchanged. Delivery still rechecks current eligibility and account ownership, leases at most 100 due jobs per pass and preserves existing deduplication/retry behavior.

An account's planning transaction may process multiple journey batches and has a 60-second transaction timeout. Daily reconciliation can still read up to the 10,000-journey account cap. These are bounded account counts and row batches, not a guaranteed fixed-duration run. At a nominal one-minute scheduler cadence, a planning sweep takes approximately `ceil(account count / 20)` passes, plus execution time. Due jobs already in the queue are processed every pass independently of the planning cursor. Alert thresholds and deployment capacity must account for planning delay and the existing delivery limit; no production lateness target is claimed here.

## Rollback to an older backend

Keep the new backend running while materializing compatible snapshots:

1. Disable conversion on **every backend replica** and wait until that configuration rollout has finished. Stop any other processes that can enable conversion.
2. From the new backend image, run:

   ```sh
   RAILWATCH_NORMALIZED_STORAGE=false RAILWATCH_STORAGE_ROLLBACK=true node build/backend/storage-rollback.mjs
   ```

   The command refuses to run with conversion enabled or without the explicit rollback flag. It processes 20 accounts at a time, takes the existing account lock for each account, reconstructs its encrypted full snapshot from current journey rows, switches it to format 1 and advances its revision to invalidate stale client cursors. Concurrent saves from the new backend remain serialized and safe. The command can be rerun after interruption.
3. Verify that `SELECT COUNT(*) FROM "RailWorkspace" WHERE "storageVersion" = 2;` returns zero, and check a workspace and PDF download. Keep conversion disabled.
4. Only then deploy an older image. Retain the additive columns; do not drop them as part of rollback. A database restore is a separate recovery operation and needs its own backup/restore verification.

The rollback command cannot inspect every replica's environment; the operator must complete step 1. Do not restore an older binary merely by disabling the flag.

## Validation

Isolated database coverage verifies 2,000 indexed journeys, unchanged ciphertext for unloaded rows and metadata, settings-only saves, legacy conversion with linked PDFs, compatible snapshot reconstruction, concurrent edits, routine stability, 200-row planning boundaries, reminder deduplication, device changes without content revision changes and account sweep recovery. Browser regression tests run with normalized storage enabled and retain account isolation, paginated edits, routine/ticket retention and responsive checks. These checks do not substitute for production activation and rollback verification against the installed release.

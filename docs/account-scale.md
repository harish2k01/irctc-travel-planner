# Journey list pagination and search

Journey Board, History, Archive and Ticket Vault load account-owned batches of 30 journeys. Board columns page independently. Counts cover all matching records, rather than only loaded cards; Board/History/Archive badges remain full-account totals. Search, date, routine, status and sort filters run on the backend. Downloaded workspace backups and calendar exports still contain the complete workspace.

## Storage and upgrade

Apply `20261003000400_journey_pages` before deploying this release. It adds a read index without replacing the canonical encrypted workspace. Existing accounts backfill lazily on their next workspace/list read. Workspace writes and lifecycle changes update the index atomically under the existing account lock. Metadata is refreshed at the IST day boundary.

Journey payloads remain encrypted. The index contains dates, status, routine identifiers and whether a ticket exists; it does not contain plaintext station names, notes or PNRs. Account-specific HMAC trigram tokens select search candidates. Decrypted candidates are checked against the actual normalized substring in batches of 250, so token matches do not distort search totals. Short or broad searches can still scan many candidates; this is bounded memory, not constant-time search.

Cursors bind the account, filters, column and workspace revision. An edit invalidates old cursors and the user can refresh the list. Partial saves compare the loaded base and edited records with the latest canonical workspace. Unloaded journeys are preserved, while conflicting edits are rejected. Explicit backup restoration remains a complete-workspace operation.

## Validation and remaining scope

The isolated database test covers 2,000 journeys, unique page boundaries, full-account totals, exact search, tenant isolation, stale cursors, conflicting edits and preservation of unloaded encrypted records. One local run through a remote database tunnel measured a 3.6-second initial index build and a 105-ms warm page read: 15,296 response bytes versus 492,724 bytes for the full workspace. These are test observations, not production latency targets.

Browser regression coverage loads a second batch and edits a search result outside the first page, then verifies all other records survive. Existing desktop/mobile, theme, ticket, drag/drop and account checks remain in the suite.

Dashboard, Calendar and Routines still request full planning context. Canonical writes and scheduler planning still process the encrypted workspace. Bounded reads for those views, narrower writes and scheduler scaling remain the next account-scale phase; this change does not claim to remove every whole-workspace operation.

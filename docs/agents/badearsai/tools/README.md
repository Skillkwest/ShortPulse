# Badearsai Tools

Purpose: inventory helper tools and scripts for Badearsai's error-monitoring workflow.

## Current Status

Badearsai now has two production helpers:

- Admin Errors helper: `docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs`.
- Crash Logs helper: `docs/agents/badearsai/tools/scripts/crash-log-intake.mjs`.

## Manual Tools In Use

- Admin Errors triage packets copied from `/admin`.
- Admin Event Stream detail packets when raw metadata is needed.
- `rg` for source tracing.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` for production route/deploy-skew proof.
- Unauthenticated route probes for fail-closed checks when they are non-mutating.
- Existing route/docs/test files for canonical source ownership.
- Canonical status semantics: `frontend/pages/api/admin/errors-status.ts` and `frontend/pages/api/admin/errors-status-bulk.ts`.
- Admin Errors read/status/update helper:
  - `node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs queue --limit 20`,
  - `node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs status --incident <incident-id>`,
  - `node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs update --incident <incident-id> --status resolved|ignored|open --note "<rationale>" [--watch]`.
- Crash Logs read/review helper:
  - `node docs/agents/badearsai/tools/scripts/crash-log-intake.mjs list`,
  - `node docs/agents/badearsai/tools/scripts/crash-log-intake.mjs list --status all --review-status open --limit 50`,
  - `node docs/agents/badearsai/tools/scripts/crash-log-intake.mjs review --session <browser-crash-session-row-id> --status resolved|ignored|open --note "<rationale>" --reviewer-email <admin-email>`.
- Existing Ophestivus helpers when the current workflow fits their board/status model:
  - `npm -C frontend run ophestivus:error-status -- --incident <incident-id> [--after <iso>]`,
  - `npm -C frontend run ophestivus:error-status -- --fingerprint <fingerprint> [--after <iso>]`,
  - `npm -C frontend run ophestivus:intake -- --incident <incident-id> --dry-run`,
  - `npm -C frontend run ophestivus:complete-error-ticket -- ... --dry-run`.

## Implemented Scripts

### Admin Errors Intake Helper

Status: implemented. Queue reads mirror the Admin Errors default queue filters from `frontend/pages/api/admin/errors.ts`; status/update actions use the canonical `admin_update_app_error_status` RPC behind `frontend/pages/api/admin/errors-status.ts`.

Goal: make packet status checks, final queue readback, and reviewed-row cleanup repeatable without hand-written Supabase snippets.

Default output:

- incident ID,
- status, watch flag, severity, source, message,
- route, endpoint, request ID, HTTP status,
- redacted user boundary,
- first/last seen and occurrence count,
- app/client release and build,
- generation/task/error identifiers when present,
- exception stage/name when present,
- metadata key inventory.

The helper is read-only unless the `update` command is used. Updates must be one-row, note-backed status changes for reviewed incidents only. Use `--watch` only with `--status resolved`.

### Crash Log Intake Helper

Status: implemented. List reads consume the service-role-only `list_browser_crash_sessions_v2` authority introduced by migration `220`; review updates remain one-row, note-backed status changes.

Goal: pull current `/admin/crashes` evidence directly from production so Badearsai can run the Crash Log SOP without pasted packets.

Default output:

- row ID,
- evidence status and confidence,
- effective stale status,
- review status,
- route,
- last event and timeline,
- release/build,
- redacted user/session boundary,
- allowlisted metadata keys,
- pressure/crash-report summary.

The list command does not copy Admin status derivation or filtering. It consumes returned effective status, reason, confidence, count, and pagination from the canonical RPC. If migration `220` is not applied in the target environment, stop and report the missing interface instead of adding a direct-table fallback.

Review updates are guarded and must be one-row, note-backed status changes that match the canonical review fields owned by `frontend/pages/api/admin/crashes-status.ts`.

## Planned Scripts

### Triage Packet Parser

Goal: parse one or more copied ShortPulse triage packets into a compact table.

Expected output:

- incident/event count,
- IDs, routes, endpoints, request IDs, messages, severities, occurrences,
- generation/task/output identifiers,
- metadata keys,
- causal-chain grouping hints.

### Queue Classification Ledger

Goal: normalize Badearsai classifications across runs.

Expected output:

- real issue,
- queue noise,
- watch,
- blocked pending proof,
- owner lane,
- proof type,
- next action.

### Admin Errors Cleanup Planner

Goal: convert Badearsai's classification table into exact status updates.

Expected output:

- reviewed incident/event IDs,
- proposed status: `open`, `resolved`, or `ignored`,
- watch flag when using `resolved` plus watch,
- note/rationale,
- same-fingerprint scope,
- dry-run/read-check result,
- post-update verification result,
- blocked rows with missing proof.

### Admin Event Detail Gap Checker

Goal: list which copied packets need raw Event Detail metadata before root cause can be claimed.

Expected output:

- incident id,
- missing keys,
- needed Admin/Event Stream action,
- whether implementation should stop.

## Tool Rules

- Tools must be read-only except for reviewed Admin Errors or Crash Logs status treatment on the current batch/run or another explicit user-approved mutation.
- Tools must not print or retain secrets, cookies, raw env values, signed URLs, private customer content, or customer payment details.
- Tools must preserve individual incident IDs even when grouping causal chains.
- Tools must label proof level and stop boundaries.
- Tool outputs belong in Badearsai workspace or retained reports when they are durable.

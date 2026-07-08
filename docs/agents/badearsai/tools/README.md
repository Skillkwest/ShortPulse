# Badearsai Tools

Purpose: inventory helper tools and scripts for Badearsai's error-monitoring workflow.

## Current Status

No executable Badearsai-specific scripts exist yet.

## Manual Tools In Use

- Admin Errors triage packets copied from `/admin`.
- Admin Event Stream detail packets when raw metadata is needed.
- `rg` for source tracing.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` for production route/deploy-skew proof.
- Unauthenticated route probes for fail-closed checks when they are non-mutating.
- Existing route/docs/test files for canonical source ownership.
- Canonical status semantics: `frontend/pages/api/admin/errors-status.ts` and `frontend/pages/api/admin/errors-status-bulk.ts`.
- Existing Ophestivus helpers when the current workflow fits their board/status model:
  - `npm -C frontend run ophestivus:error-status -- --incident <incident-id> [--after <iso>]`,
  - `npm -C frontend run ophestivus:error-status -- --fingerprint <fingerprint> [--after <iso>]`,
  - `npm -C frontend run ophestivus:intake -- --incident <incident-id> --dry-run`,
  - `npm -C frontend run ophestivus:complete-error-ticket -- ... --dry-run`.

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

- Tools must be read-only except for reviewed Admin Errors status treatment on the current pasted batch or another explicit user-approved mutation.
- Tools must not print or retain secrets, cookies, raw env values, signed URLs, private customer content, or customer payment details.
- Tools must preserve individual incident IDs even when grouping causal chains.
- Tools must label proof level and stop boundaries.
- Tool outputs belong in Badearsai workspace or retained reports when they are durable.

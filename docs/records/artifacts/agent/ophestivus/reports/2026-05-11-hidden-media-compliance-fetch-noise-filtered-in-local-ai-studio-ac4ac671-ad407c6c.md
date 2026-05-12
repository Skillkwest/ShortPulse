# Hidden media compliance fetch noise filtered in local AI Studio

- Created: 2026-05-11T15:10:03.244Z
- Status: complete
- Final board status: complete
- Finalized: 2026-05-11T15:11:12.720Z
- Ticket: ac4ac671-eb69-433a-ade4-dce45f17f43e
- Incident: ad407c6c-cb32-43a3-b4b6-b1b35656f0e4

## Summary

Hidden localhost AI Studio refreshes could log high-severity Failed to fetch incidents for /api/account/media-compliance even though the compliance gate request was non-actionable hidden-tab dev noise.

## Changes

Added a narrow hidden localhost/dev skip rule for /api/account/media-compliance fetch failures in appErrorLogs and added paired regression coverage proving hidden fetches are skipped while visible failures remain actionable.

## Validation

npm run test -- tests/lib/app-error-logs.skip.test.ts; npx eslint lib/server/api/appErrorLogs.ts tests/lib/app-error-logs.skip.test.ts; git diff --check -- lib/server/api/appErrorLogs.ts tests/lib/app-error-logs.skip.test.ts

Verification class: telemetry-filter-verified

Recurrence: 0 open same-fingerprint incidents; 0 fresh events after 2026-05-11T15:09:06.000Z.

## Residual Risk

monitor: Live browser verification was not performed in this pass; monitor visible media-compliance failures because only hidden localhost/dev noise is being filtered.

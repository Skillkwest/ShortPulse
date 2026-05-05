# Failed to fetch hidden project identity noise

- Created: 2026-05-02T14:00:04.696Z
- Status: review-ready
- Ticket: 1cdc9df4-5f6a-4a74-8db5-92ee862d0f77
- Incident: 3e254edd-6a8d-4465-bcb5-1cf3175758d7

## Summary

Hidden localhost/dev AI Studio project identity fetch failures were being logged as high-severity Admin Errors incidents.

## Changes

Added a narrow app-error skip rule for hidden localhost/development client.api_network Failed to fetch events on /api/projects/<id>, while preserving visible failures as actionable.

## Validation

npm run test -- tests/lib/app-error-logs.skip.test.ts; npx eslint lib/server/api/appErrorLogs.ts tests/lib/app-error-logs.skip.test.ts; npm run type-check.

Verification class: telemetry-filter-verified

Recurrence: same fingerprint has 0 open incidents and 0 fresh events after 2026-05-02T13:58:54Z.

## Residual Risk

monitor: Only localhost/development hidden-tab project identity fetch noise is suppressed; visible failures and production failures remain actionable. Monitor Admin Errors for a fresh visible or production recurrence.

## Post-run Training Audit

- Completed ticket: 1cdc9df4-5f6a-4a74-8db5-92ee862d0f77
- Incident: 3e254edd-6a8d-4465-bcb5-1cf3175758d7
- Workflow rating: 10/10
- Friction found: none blocking. Existing intake, error-detail, error-status, closeout, review, and report helpers covered the full flow.
- Tools/resources needed: no new tooling needed.
- Decision: keep current helpers. This was a repeatable narrow telemetry-filter issue and the existing path handled it cleanly.
- Changes made: none beyond this post-run audit note.
- Validation: error SOP validation and review SOP validation passed before Complete promotion.
- Next training improvement: continue watching for repeated hidden-localhost fetch patterns; add only if a new endpoint family appears more than once.

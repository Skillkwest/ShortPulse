# Badearsai Scripts

Purpose: future home for Badearsai-owned helper scripts.

Scripts added here should be small, read-only by default, and focused on parsing, classification, proof reporting, or narrow reviewed queue cleanup for ShortPulse error/crash triage.

## Scripts

- `admin-errors-intake.mjs`: reads the production Admin Errors queue with the same default non-actionable filters as `/api/admin/errors`, reads exact incident statuses, and can update one reviewed incident through the canonical `admin_update_app_error_status` RPC with a required note.
- `crash-log-intake.mjs`: lists production `browser_crash_sessions` rows for the Crash Log SOP and can update one reviewed row's `review_status` with a required note.

Rules:

- Do not store secrets or raw private data.
- Do not call production mutation endpoints except reviewed queue-status cleanup explicitly authorized by the current SOP/task.
- Do not resolve, ignore, replay, or mutate Admin rows until classification is complete and the row ID/status/note are explicit.
- Keep scripts deterministic and documented.
- Prefer existing repo scripts when they already cover the proof need.

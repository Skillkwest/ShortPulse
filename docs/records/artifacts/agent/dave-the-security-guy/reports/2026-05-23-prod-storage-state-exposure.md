# Dave Security Report - 2026-05-23 - Production Storage-State Exposure

Purpose: sanitized retained report for the production Supabase auth storage-state exposure found in Beeper run evidence.

## Summary

- Severity: P0 credential/session exposure.
- Affected file: `beeper/runs/2026-05-15-084342-prod-sign-in/evidence/prod-storage-state.json`.
- Affected environment: production.
- Affected account: Beeper production audit user `aiagentayla@gmail.com`.
- Raw token values retained here: no.

## Confirmed Facts

- The file was tracked in Git on `production`.
- The file was introduced by commit `35c9a1dc9`.
- The file contained a Playwright storage-state payload for `https://www.shortpulse.ai`.
- The payload included a Supabase auth localStorage key with access-token and refresh-token material.
- The working tree already contains deletions for the historical `beeper/runs/*/evidence/*` raw evidence set.
- Beeper now has an ignored local raw evidence cache model plus tracked redacted evidence manifests.

## Response Completed In This Run

- Added repository ignore rules for storage-state, auth-state, session-state, `.auth/`, Beeper raw evidence, and Beeper evidence-cache artifacts.
- Hardened `scripts/check_secret_exposure.js` so tracked auth/session filenames, Supabase auth localStorage keys, access-token fields, refresh-token fields, and non-placeholder signed Supabase storage URLs fail the scan.
- Added the secret exposure scanner to Husky `pre-commit` and `pre-push`.
- Changed CI secret scan default mode from warn to enforce.
- Documented the local agent credential boundary in `docs/security-checklist.md`.
- Added Dave the Security Guy to docs indexes and repo structure.

## Session Revocation Attempt

- Tried to refresh the exposed session using the committed refresh token without printing token values.
- Refresh response: `400 Bad Request`.
- Tried global logout with the exposed access token without printing token values.
- Logout response: `403 Forbidden`.

Interpretation: the exposed refresh token was already unusable, and the old access token was not accepted for logout. Complete revocation proof still needs a targeted Supabase Auth session-row check/delete through an approved SQL/dashboard path because the available Supabase CLI version has no `db query` command and `psql` is not installed in this shell.

## Remaining Required Action

Run an operator-approved hosted Supabase Auth session cleanup for user id `1609d304-f075-4918-a9ce-437548734a75` and confirm zero active `auth.sessions` rows remain for that user.

Do not store the SQL output if it contains token/session values. Retain only the sanitized count and timestamp.

## Residual Risk

- GitHub history on `origin/production` still contains the exposed file until a history rewrite/purge is performed.
- Revocation mitigates live credential risk, but history purge is the only way to remove the historical token material from Git history.
- Future commits are now guarded locally and in CI, but this run did not stage or commit the current deletion set.

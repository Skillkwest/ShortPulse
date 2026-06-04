# Media Autosave Local Preference Isolation Fix

Date: 2026-06-03

Agent: Dave the Security Guy

Mode: Launch-readiness security lane, primary current account preference boundary.

## Scope

Fixed one account-local preference isolation issue in the primary Media Library autosave preference hook. No UI, UX, route behavior, SQL, hosted Supabase state, Vercel state, secrets, billing data, or customer data were changed.

## Finding

Signed-in Media Library autosave fallback state used a global localStorage key.

Severity: Medium-low.

Confidence: High.

Affected trust boundary: Per-user account preference state on shared browsers.

Launch impact: Autosave controls whether generated media should be persisted into private Media Library storage. When remote `user_preferences` storage is unavailable, a signed-in user could inherit another user's local autosave fallback value from the same browser, causing account-local media persistence behavior to bleed across users.

ROI: Good. The fix is small, uses the existing user-scoped localStorage helper pattern already used by adjacent preference hooks, and directly tightens a user-account isolation surface without product/UI churn.

## Root Cause

`frontend/features/ai-studio/hooks/useMediaAutosavePreference.ts` read and wrote `shortpulse.ai_studio.media_autosave_enabled` for both signed-out and signed-in users. Other preference hooks scope signed-in local fallback keys with `:<userId>`, but autosave had not been updated to that pattern.

## Fix

`useMediaAutosavePreference` now:

- keeps signed-out/no-user fallback on the existing global key;
- reads and writes signed-in fallback values at `shortpulse.ai_studio.media_autosave_enabled:<userId>`;
- preserves remote `user_preferences.media_autosave_enabled` as the account authority when available;
- avoids hydrating a signed-in user from another user's global fallback during remote preference-storage outages.

## Validation

Passed:

- `npm -C frontend test -- --run features/ai-studio/hooks/__tests__/useMediaAutosavePreference.test.ts`
- `npm -C frontend test -- --run lib/server/api/__tests__/mediaAutosavePreference.test.ts`

Result: 2 test files passed, 9 tests passed.

## Residual Risk

This fix only addresses the client local fallback key. Hosted Supabase RLS was not rerun in this pass; local SQL still shows `user_preferences` isolated by `user_id = auth.uid()`.

## Stop Condition

Reached. The verified issue was fixed at the owning hook and covered by focused regression tests. Continuing into other preference hooks would be adjacency unless fresh evidence proves another protected-boundary flaw.

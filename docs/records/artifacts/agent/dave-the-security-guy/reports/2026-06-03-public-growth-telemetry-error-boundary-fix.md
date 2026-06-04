# Public Growth Telemetry Error Boundary Fix

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security fix, no UI/UX/product behavior change

## Finding

Public `/api/telemetry/growth` could return raw downstream error text from its catch block.

- Severity: Medium
- Confidence: High
- Affected trust boundary: public internet caller -> service-role-backed telemetry/attribution write path
- Launch impact: an outside caller could receive raw database/internal error details when downstream telemetry or attribution writes fail.
- ROI: high enough for a small canonical route fix because the route is intentionally unauthenticated and service-backed.

## Threat Statement

An unauthenticated caller can POST an allowlisted growth telemetry event that reaches downstream telemetry/attribution helpers. If those helpers throw, the route previously returned `error.message`, crossing the public API boundary and exposing internal database/provider/auth/environment details.

## Root Cause

The root cause was in `frontend/pages/api/telemetry/growth.ts`: the catch block logged the failure and then used the caught exception text as the public `500` response.

## Fix

- Added a stable public failure message for growth telemetry ingest failures.
- Preserved server-side logging of the diagnostic error for admin investigation.
- Added a regression test proving a raw downstream relation-error string is logged server-side but not returned to the caller.
- Updated `docs/security-checklist.md` to document the public growth ingest error-boundary contract.

## Validation

Passed:

```bash
npm -C frontend test -- --run tests/api/telemetry-growth.test.ts
```

Result: 1 file, 6 tests passed.

## Residual Risk

- This was local code/test validation. Production was not mutated or probed in this lane.
- The existing public source allowlist and rate limit remain the primary controls for this route.
- No cross-user data leak was confirmed in this lane.

## Stop Condition

Reached. The selected high-ROI public-route error-boundary issue was fixed and validated. The next work should be a separately proven account, billing/credit, media/storage, provider, admin, webhook, or prompt-authority boundary issue, not general API error cleanup.

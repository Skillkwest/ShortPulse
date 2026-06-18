---
name: skill-mvp-security-audit
description: Audit and harden ShortPulse MVP security for reservation RPC auth binding and grants, internal API route exposure, Stripe redirect/webhook safety, upload content validation, and auth boundary integrity. Use when executing P0 security blockers, reviewing SQL/API security changes, or preparing pre-tester release sign-off.
---

# MVP Security Audit

Purpose: execute the pre-tester P0 security pass with consistent checks, fixes, and evidence capture.

## Sources of truth
- `docs/planning/mvp-pretester-full-audit-remediation-plan.md`
- `docs/security-checklist.md`
- `sql/migrations/002_add_generation_credit_reservations.sql`
- `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`
- `frontend/pages/api/_utils/*`
- `frontend/pages/api/billing/stripe/checkout.ts`
- `frontend/pages/api/billing/stripe/portal.ts`
- `frontend/pages/api/media/upload.ts`
- `frontend/pages/api/media/stage-motion-reference-video.ts`
- `frontend/proxy.ts`

## Workflow
1. Confirm scope
- Read the P0 security checklist in `docs/planning/mvp-pretester-full-audit-remediation-plan.md`.
- Restrict work to security hardening and required docs/test updates.
2. Enforce reservation RPC auth and grants
- Bind caller identity with `auth.uid()` against caller-supplied user id and fail closed on mismatch.
- Revoke broad execute grants and grant only intended roles.
- Document grant posture in migration comments or ops docs.
3. Remove accidental API surface
- Move reusable helpers out of `frontend/pages/api/_utils/` to non-routable server modules.
- Keep route files thin and explicit.
4. Harden Stripe boundaries
- Replace request-derived redirect origin logic with allowlisted canonical app URL environment configuration.
- Add webhook timestamp tolerance checks in addition to idempotency checks.
5. Harden uploads
- Validate content type by magic-byte/content sniff, not MIME/header metadata alone.
- Keep extension/MIME checks as secondary guardrails.
6. Verify and record evidence
- Run security-relevant tests and targeted handler tests.
- Update the remediation plan task status and `docs/change_log.md`.

## Required verification
- SQL migrations apply and enforce intended grants.
- Unauthorized cross-user billing attempts fail.
- Internal helper routes under `/api/_utils/*` are not externally routable.
- Stripe redirect URLs resolve only to allowlisted base URL.
- Stale webhook signatures are rejected.
- Upload spoofing attempts fail server-side validation.

## Output format (recommended)
```text
MVP security audit report
- Scope: <files/routes/migrations>
- Status: pass | partial | fail

Findings
- [severity] <issue> in <path> -> <required change>

Verification
- <check>: pass | fail

Residual risk
- <risk> -> <mitigation/owner>
```

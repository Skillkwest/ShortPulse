# Unified Phase 02: Auth Boundary Hardening and Admin Access Decoupling

Status: In Progress  
Owner: Engineering

## Objective
Enforce token-first fail-closed route authorization and remove proxy-header-only trust paths while preparing admin access decoupling slices.

## In Scope
1. Split auth concerns into token verification and proxy-context extraction modules.
2. Require bearer verification for protected route auth helpers by default.
3. Keep proxy auth headers as advisory metadata only after verified principal resolution.
4. Add emergency-only proxy fallback switch (`SHORTPULSE_TRUST_PROXY_AUTH_HEADERS`) with secure default `false`.
5. Expand protected API prefixes to include `/api/log/`.
6. Update auth-focused tests and phase docs/evidence/tracker.

## Out of Scope
1. Admin page/access endpoint refactor slices.
2. Webhook auth contract changes.
3. Non-auth route behavior changes outside protected-path alignment.

## Implementation Slices
1. Slice A: token-first auth module split + protected-path alignment.
2. Slice B: auth regression tests + emergency override coverage.
3. Slice C: docs/evidence/tracker updates.

## Validation Gates
1. `npm -C frontend run test -- auth-helper auth-latency-benchmark auth-guarded-ai-routes fal-status.auth-context fal-status.ownership log-client-error`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run build`

## Required Docs Updates
1. `docs/security-checklist.md`
2. `docs/api/api-internal-routes.md`
3. `docs/planning/shortpulse-unified-buildout-tracker.md`
4. `docs/planning/evidence/unified-buildout/phase-02/*`
5. `docs/change_log.md`

## Exit Criteria
1. Protected routes do not authorize from `x-shortpulse-*` headers alone.
2. Verified bearer identity remains authoritative when proxy metadata disagrees.
3. Auth validation gates are green and phase evidence is committed.

## Rollback Plan
1. Revert the phase-02 auth slice commit.
2. Restore prior auth helper behavior and test baselines.

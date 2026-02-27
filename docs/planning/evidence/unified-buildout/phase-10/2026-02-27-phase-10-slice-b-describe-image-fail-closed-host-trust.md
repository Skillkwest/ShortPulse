# Phase 10 Slice B Evidence: Describe-Image Fail-Closed Host Trust

Date: 2026-02-27  
Owner: Engineering  
Phase: 10 (Security Residual Controls)  
Slice: B (describe-image fail-closed + safe error surface)

## Scope Delivered
1. Tightened describe-image host trust policy to fail closed by default:
   - `frontend/lib/server/api/imageDescribeUrlGuard.ts`
2. Hardened describe-image failure payloads:
   - remove internal transport detail from `5xx` client responses while preserving server logs.
   - `frontend/features/agent-runtime/legacyImageDescribeService.ts`
3. Expanded describe-image route tests:
   - `frontend/tests/api/describe-image.route.test.ts`
4. Updated deployment/API/SOP/security docs for host-trust contract:
   - `docs/deployment.md`
   - `docs/api/api-internal-routes.md`
   - `docs/sops/sop_text_generation.md`
   - `docs/security-checklist.md`
   - `frontend/.env.example`

## Validation Run
1. `npm -C frontend run test -- describe-image.route auth-guarded-ai-routes`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## Rollback
1. Revert the Phase 10 Slice B commit only.
2. Re-run:
   - `npm -C frontend run test -- describe-image.route auth-guarded-ai-routes`
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run docs:check`

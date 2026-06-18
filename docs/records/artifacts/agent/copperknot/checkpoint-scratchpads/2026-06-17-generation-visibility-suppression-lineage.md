# 2026-06-17 Generation Visibility Suppression Lineage

## Touched

- `frontend/lib/server/api/generationAttempts.ts`
- `frontend/lib/server/api/generationLineageResolver.ts`
- `frontend/lib/server/api/generationVisibilitySuppression.ts`
- `frontend/lib/server/api/__tests__/generationLineageResolver.test.ts`
- `frontend/lib/server/api/__tests__/generationAbandonment.test.ts`
- `docs/agents/bactuo/checkpoint-baseline-2026-06-17.md`

## Did

- Added optional Supabase admin-client pass-through for provider-request lineage lookups.
- Routed Reference Grid visibility suppression `source_ref` and `request_id` matching through the shared lineage resolver.
- Preserved the lifecycle boundary: suppression still only hides visibility and clears companion-art projection state; it does not mark generations failed, update attempts, settle credits, cancel providers, or change UI behavior.

## Validation

- `npm -C frontend run test -- --run lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationReconcile.test.ts lib/server/api/__tests__/generationAbandonment.test.ts tests/api/generation-abandon.route.test.ts` passed: 4 files, 30 tests.
- `npm -C frontend run type-check:touched` passed.
- Focused ESLint passed from `frontend/`.
- `git diff --check` passed.

## Boundary

- This is local source hardening for recovery/settlement/output integrity and visibility-lifecycle separation.
- It does not prove production lifecycle convergence, deployed route convergence, or credit-consuming provider success.

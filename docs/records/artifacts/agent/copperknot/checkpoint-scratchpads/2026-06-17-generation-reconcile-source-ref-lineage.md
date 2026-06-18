# 2026-06-17 Generation Reconcile Source-Ref Lineage

## Touched

- `frontend/lib/server/api/generationLineageResolver.ts`
- `frontend/lib/server/api/generationReconcile.ts`
- `frontend/lib/server/api/__tests__/generationLineageResolver.test.ts`
- `frontend/lib/server/api/__tests__/generationReconcile.test.ts`
- `docs/agents/bactuo/checkpoint-baseline-2026-06-17.md`

## Did

- Added shared source-ref lineage resolution to `generationLineageResolver`.
- Moved `/api/generation/reconcile` source-ref recovery lookup off its private projection/metadata fallback and onto the shared lineage resolver.
- Preserved user scoping and recovery delegation; no UI, UX, billing policy, provider behavior, deploy, commit, push, or credit-spending change.

## Validation

- `npm -C frontend run test -- --run lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationReconcile.test.ts` passed: 2 files, 19 tests.
- `npm -C frontend run type-check:touched` passed.
- `npx eslint lib/server/api/generationLineageResolver.ts lib/server/api/generationReconcile.ts lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationReconcile.test.ts` passed from `frontend/`.
- `npm -C frontend run docs:check` passed.
- `git diff --check` passed.

## Boundary

- This is local source-hardening for the recovery/settlement/output-integrity lane.
- It does not prove production lifecycle convergence, credit-consuming provider success, or deployed route convergence.

# Copperknot Scratchpad: Recovery Project-Scope Convergence

Date: 2026-06-21

Purpose: reduce P1 recovery/output-integrity risk without UI/UX or behavior changes.

Touched:

- `frontend/lib/server/api/generationOutputConvergence.ts`
- `frontend/lib/server/api/__tests__/generationOutputConvergence.test.ts`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`

Result:

- Read-only production diagnostics showed scheduler health green, `0` recovery cron failures in the last `6h`, `0` missing generation charges, and `0` duplicate charge keys.
- Production convergence diagnostics found `127` successful generations with project metadata but missing project-scoped projection.
- Hardened owned-output convergence so project/workspace scope from generation metadata is passed into `upsertGenerationProjection`.
- Added focused tests for project-scoped and workspace-runtime-scoped owned-output convergence.
- Focused validation passed:
  - `npm -C frontend run test -- lib/server/api/__tests__/generationOutputConvergence.test.ts`
  - `npm -C frontend run test -- lib/server/api/__tests__/generationOutputConvergence.test.ts lib/server/api/__tests__/generationProjection.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts`
  - `npm -C frontend run type-check:touched`
  - `cd frontend && npx eslint lib/server/api/generationOutputConvergence.ts lib/server/api/__tests__/generationOutputConvergence.test.ts`

Boundary:

- This is local source hardening plus production diagnostic evidence.
- It does not repair existing production rows until deploy plus approved non-credit convergence/backfill proof runs.
- It does not prove credit-consuming generation success, authenticated customer workflow completion, or full recovery/settlement lifecycle readiness.

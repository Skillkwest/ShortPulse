# Copperknot Checkpoint Scratchpad - Output Convergence Projection Lineage

Date: 2026-06-17

Scope:
- Hardened owned output-slot convergence in the Bactuo recovery/settlement/output integrity lane.
- Preserved `sourceRef`, `requestId`, and `providerRequestId` on repaired `generation_projection` rows when provider/source identity is available.

Touched:
- `frontend/lib/server/api/generationOutputConvergence.ts`
- `frontend/lib/server/api/__tests__/generationOutputConvergence.test.ts`
- `docs/agents/bactuo/checkpoint-baseline-2026-06-17.md`

Validation:
- `npm -C frontend run test -- --run lib/server/api/__tests__/generationOutputConvergence.test.ts tests/lib/admin-user-health-fleet-scan.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/api/admin-generation-trace.test.ts lib/server/api/__tests__/generationLineageResolver.test.ts`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run lint -- lib/server/api/generationOutputConvergence.ts lib/server/api/__tests__/generationOutputConvergence.test.ts lib/server/adminUserHealth/fleet.ts tests/lib/admin-user-health-fleet-scan.test.ts lib/server/adminUserHealth/deepReport.ts tests/lib/admin-user-health-deep-report.test.ts pages/api/admin/generation-trace.ts tests/api/admin-generation-trace.test.ts` completed with warnings only.
- `npm -C frontend run docs:check`
- `git diff --check`

Boundary:
- No settlement capture/release, provider runtime, UI, UX, billing policy, or production environment behavior changed.
- This is local projection-lineage source hardening only; production recovery/output proof remains separate.

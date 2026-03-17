# Lane A Master Plan (2026-03-16)

Last updated: 2026-03-16  
Status: Completed  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`  
Evidence index: `docs/planning/evidence/lane-a/README.md`

## Summary
Lane A restores baseline gate health and hardens governance contracts before deeper structural work. Scope is no-regression and no-bloat by default:
1. recover red validation gates,
2. remove high-signal docs/policy drift,
3. complete conservative dead-code cleanup,
4. leave runtime behavior unchanged.

## Baseline Findings (Audit Snapshot)
As of 2026-03-16:
1. `npm -C frontend run docs:check` is green.
2. `npm -C frontend run check:naming-legacy-usage` fails on bridge contracts:
   - `frontend/features/ai-studio/hooks/contracts/pageContentAdapter.ts`
   - `frontend/features/ai-studio/hooks/contracts/pageContentContracts.ts`
3. `npm -C frontend run check:size-budget` fails:
   - `frontend/pages/ai-studio.tsx` exceeds budget.
4. `npm -C frontend run deadcode:check` fails:
   - isolated dead files/dependencies exist and should be removed conservatively.
5. Policy/governance drift exists across script/workflow/template/doc surfaces for Supabase local Docker-style SQL lint references.

## Current Execution Status
As of 2026-03-16 after A4 slices:
1. `check:naming-legacy-usage` is green with explicit bridge allowlist + ADR-0023 sunset note.
2. `validate` is green.
3. SQL lint policy surfaces are aligned to hosted-target Supabase CLI lint commands.
4. `check:size-budget` is green after extracting perf-audit runtime from page orchestration into `useAiStudioPerfAuditRuntime`.
5. `deadcode:check` is green after A4 safe-core + selective pruning slices.
6. Lane A signoff packet is complete with follow-up debt explicitly assigned to downstream lanes.

## Phase Plan
### A0: Baseline Lock
1. Capture baseline outputs for `deadcode:check:full`, `lint`, `type-check`, `build`, `test`, `docs:check`, `validate`.
2. Capture lint warning baseline for touched surfaces.
3. Freeze in-scope vs out-of-scope and rollback posture per phase.

### A1: Policy + Validation Gate Recovery
1. Resolve naming guard failures via explicit bridge allowance policy tied to ADR 0023 sunset tracking (no behavior refactor in Lane A).
2. Recover size-budget conformance for `frontend/pages/ai-studio.tsx` as a baseline-gate unblock seam owned by Lane A.
3. Lane A ownership for this seam is limited to gate recovery only; deeper modularization continues in Lane B after baseline green.
4. Keep `validate` path green without broad suppressions.
5. Align Supabase SQL lint workflow references to CLI hosted-target policy across:
   - `scripts/run_repo_sweep.sh`
   - `.github/workflows/ci.yml`
   - `.github/pull_request_template.md`
   - `docs/planning/ci-policy-checks.md`
6. Remove Docker-local Supabase flow references from these governance surfaces.

### A2: Docs/Governance Cleanup
1. Remove duplicate route rows and stale references in internal API/SOP docs.
2. Repair active index parity for:
   - `docs/README.md`
   - `docs/planning/README.md`
   - `docs/product/README.md`
   - `docs/design/README.md`
3. Normalize changelog governance with strict chronology/future-date checks on a canonical section.
4. Repair known migration-reference drift in active planning docs where guidance points to stale migration numbering.

### A3: Dead-Code Cleanup (Safe Core)
1. Remove isolated dead files/dependencies with strict gates after each slice.
2. Update active docs/skills that reference removed runtime wrappers in the same slice.

### A4: Selective Dead-Code Pruning
1. Prune only high-confidence leaf exports; defer ambiguous/core-orchestration candidates.

### A5: Lane A Signoff
1. Required checks pass.
2. No warning-count increase on touched surfaces.
3. Follow-up debt list captured with owner and sunset criteria.

## Validation Gates
Run after each phase slice unless explicitly waived in tracker evidence:
1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run build`
4. `cd frontend && npm run docs:check`
5. `cd frontend && npm run validate` (Lane A recovery slices)
6. `cd frontend && npm run check:size-budget` (when size-touched)
7. `cd frontend && npm run deadcode:check` and `npm run deadcode:check:full` (when dead-code scope is touched)

Targeted regression suite for dead-code/removal slices:
1. `cd frontend && npm run test -- lib/server/api/__tests__/falSubmitTargeting.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts features/ai-studio/logic/__tests__/pricing.test.ts`

Final gate:
1. `cd frontend && npm run test`

## Assumptions And Defaults
1. Lane B modularization proceeds in a separate stream; Lane A stays narrowly scoped to gate/governance recovery.
2. Historical/archive evidence docs are not bulk rewritten during Lane A.
3. Runtime API behavior and payload contracts remain unchanged in Lane A.
4. Any temporary exception must include owner, sunset criterion, and tracker evidence.

# Lane A Evidence Packet: A4-01 Conservative Dead-Code Pass

date_utc: 2026-03-16  
slice_id: A4-01  
lane: A  
phase: A4  
owner: Engineering  
linked_pr: n/a (local execution slice)

## Scope
1. Remove isolated dead wrapper files with no runtime callers.
2. Remove unused dependency entries identified by dead-code tooling.
3. Repair active docs/skill references to removed wrapper paths.
4. Keep historical planning/evidence records unchanged.

## Files Updated
1. `frontend/features/ai-studio/components/PromptLibraryButton.tsx` (deleted)
2. `frontend/features/ai-studio/logic/pricingStrategies.ts` (deleted)
3. `frontend/lib/server/falIntegration/retrievalEngine.ts` (deleted)
4. `frontend/package.json`
5. `frontend/package-lock.json`
6. `docs/sops/sop_ai_studio_index.md`
7. `docs/product/billing-pricing-catalog.md`
8. `skills/skill-pricing-audit/SKILL.md`
9. `docs/planning/lane-a-execution-plan-2026-03-16.md`
10. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
11. `docs/planning/evidence/lane-a/README.md`

## Commands Run
1. `npm -C frontend run deadcode:check:full`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`
6. `npm -C frontend run deadcode:check`
7. `npm -C frontend run test -- lib/server/api/__tests__/falSubmitTargeting.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts features/ai-studio/logic/__tests__/pricing.test.ts`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `deadcode:check:full` | 0 | pass (`unused files` reduced from 9 -> 6) |
| `lint` | 0 | pass (7 warnings, no errors) |
| `type-check` | 0 | pass |
| `build` | 0 | pass |
| `docs:check` | 0 | pass |
| `deadcode:check` | 1 | expected fail; 6 remaining production-unused files |
| targeted vitest bundle | 0 | pass (`5` files / `61` tests) |

## Baseline Or Delta Notes
1. Removed dead wrappers that only re-exported canonical modules and had no imports.
2. Removed `onnxruntime-web` and `swr` from runtime dependencies.
3. Updated active docs/skill surfaces to canonical pricing and provider-selection module paths.
4. Lane-level dead-code blocker remains open with 6 unresolved files, now deferred to `A4-02`.

## Task Contract Checklist
1. Behavior/API parity: pass (wrapper removals only; no route/schema changes).
2. Required gates: partial pass (`deadcode:check` still failing due known backlog).
3. Docs/tracker/evidence parity: pass.
4. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Audit Findings
- `blocking`: none.
- `non-blocking`: none.
- `deferred`:
  1. Resolve remaining 6 dead-code files in `A4-02` with additional characterization for test-only and ambiguous seams.

## Parity Check
- pass: lane execution plan, global tracker, and evidence index now include `A4-01`.

## Changelog Decision
- deferred to lane closeout bundle (`A5-01`) to avoid high-frequency planning churn.

## Rollback Note
1. Restore deleted wrappers and dependencies via commit revert if regression appears in pricing/provider paths.
2. Re-run `lint`, `type-check`, `build`, and targeted tests after rollback.

## Linked Plan Artifacts
1. `docs/planning/lane-a-master-plan-2026-03-16.md`
2. `docs/planning/lane-a-execution-plan-2026-03-16.md`
3. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

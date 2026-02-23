# Phase 6 Guardrails + Cleanup Effective-Mode Alignment (Slice 1)

Date (UTC): 2026-02-23
Phase: 6 (Guardrails + Cleanup)
Owner: Frontend + DevEx
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 1 Done-State Definition
This slice is complete only when all of the following are true:
1. CI wrapper behavior for architecture boundary and size budget checks does not mask reference-grid enforce-mode failures.
2. Effective blocking mode reflects both global lane mode and reference-grid lane mode.
3. Existing local guardrails remain green after workflow change.

## Slice 1 Done-State Attestation
1. Updated CI workflow wrappers in `.github/workflows/ci.yml` to compute `EFFECTIVE_MODE` from:
   - global mode (`ARCHITECTURE_BOUNDARY_MODE` / `SIZE_BUDGET_MODE`)
   - reference-grid mode (`REFERENCE_GRID_BOUNDARY_MODE` / `REFERENCE_GRID_SIZE_BUDGET_MODE`)
2. When reference-grid mode is `enforce`, wrapper now fails the job on script failure even if global mode is `warn`.
3. Guardrail commands pass locally after update:
   - lint, type-check, docs checks, boundary checks, and size-budget checks.

## Scope
In scope:
1. CI wrapper mode-resolution alignment for architecture/size gates.
2. No-regression validation of local guardrails after workflow edits.

Out of scope:
1. Repository variable promotion to `enforce` (operational toggle step).
2. Dead adapter cleanup.
3. Phase 6 closeout.

## Files Updated
- `.github/workflows/ci.yml`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run check:size-budget` | Pass | reference-grid targets satisfied |

## Best-Practice Alignment
1. Prevents false non-blocking CI outcomes when subsystem-level enforce flags are enabled.
2. Preserves staged rollout controls while ensuring enforce semantics are respected.

## Regression Review
1. No application/runtime behavior changes; CI control-plane only.
2. No local guardrail regressions observed.

## Rollback Readiness
- Rollback path: revert CI wrapper mode-resolution block to prior behavior.
- Estimated rollback time: <= 15 minutes.

## Promotion Decision
- Decision: keep Phase 6 in progress; next step is repository variable promotion and enforce-cycle evidence.

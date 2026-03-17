# Lane D Execution Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Master plan: `docs/planning/lane-d-master-plan-2026-03-16.md`  
Tracker spec: `docs/planning/lane-d-tracker-spec-2026-03-16.md`  
Evidence root: `docs/planning/evidence/lane-d/`

## Purpose
Translate Lane D strategy into concrete, low-blast-radius slices with explicit gates and evidence requirements.

## Scope Lock
In scope:
1. Runtime warning and suppression debt reduction for active production seams.
2. Hard-disable and temporary runtime branch cleanup with rollback-safe controls.
3. Runtime logging hygiene and explicit audit-only diagnostics policy.
4. Lane-specific runtime safety guardrail convergence.

Out of scope:
1. Lane B decomposition/refactor-only modularization work.
2. Track P1 generation payload/dispatch contract hardening.
3. Large media/image-rendering architecture redesign.
4. UX/product behavior changes unrelated to runtime safety debt.

## Slice Backlog
| Slice ID | Phase | Runtime Surface | Primary Goal | Primary Evidence Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| `D0-01` | D0 | Baseline lock | Capture baseline warnings/gates and freeze non-goals | `docs/planning/evidence/lane-d/2026-03-17-d0-01-baseline-lock.md` | Completed |
| `D1-01` | D1 | `useAiStudioEditSubmitIntent` | Remove `set-state-in-effect` warning and add direct hook test | `docs/planning/evidence/lane-d/2026-03-17-d1-01-edit-submit-intent-hardening.md` | Completed |
| `D1-02` | D1 | `useAiStudioAgentBridge` | Remove reset effect warning while preserving session/tool reset behavior | `docs/planning/evidence/lane-d/2026-03-17-d1-02-agent-bridge-reset-hardening.md` | Completed |
| `D1-03` | D1 | `DetailModal` avatar flow | Remove avatar sync effect warnings with deterministic fallback behavior | `docs/planning/evidence/lane-d/2026-03-17-d1-03-detail-modal-avatar-hardening.md` | Completed |
| `D2-01` | D2 | `useReferenceGridHorizontalSplit` | Remove suppression and preserve synchronous split behavior guarantees | `docs/planning/evidence/lane-d/2026-03-17-d2-01-split-controller-suppression-retirement.md` | Completed |
| `D3-01` | D3 | `pages/ai-studio.tsx` selector-store lane | Retire unconditional emergency disable and keep rollback-safe governed control | `docs/planning/evidence/lane-d/2026-03-16-d3-01-selector-store-hard-disable-cleanup.md` | Not Started |
| `D3-02` | D3 | Reference-grid temporary/emergency constants | Audit and retire stale emergency/temporary constants or document required retention | `docs/planning/evidence/lane-d/2026-03-16-d3-02-reference-grid-emergency-constant-audit.md` | Not Started |
| `D4-01` | D4 | AI Studio runtime audit logging | Gate console diagnostics to explicit audit modes and remove production noise | `docs/planning/evidence/lane-d/2026-03-16-d4-01-runtime-logging-hygiene.md` | Not Started |
| `D5-01` | D5 | Runtime guardrail convergence | Publish Lane D guardrail policy mapping + reviewer checklist updates | `docs/planning/evidence/lane-d/2026-03-16-d5-01-guardrail-convergence.md` | Not Started |

Policy:
1. One runtime seam per PR.
2. If behavior parity is uncertain, split the slice and capture characterization evidence before changing logic.
3. No opportunistic refactors beyond the slice seam.

## Execution Detail
### D0-01 Baseline Lock
Commands:
1. `npm -C frontend run lint -- --max-warnings=9999`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run test`
6. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`

Acceptance:
1. Baseline warning inventory recorded by file and rule.
2. Baseline suppression inventory recorded for scoped runtime seams.
3. Explicit non-goals and rollback posture recorded.
4. Baseline-red failures outside Lane D scope are recorded explicitly rather than treated as lane regressions.

### D1-01 / D1-02 / D1-03 Effect Hardening Slices
Required targeted tests:
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioAgentBridge.test.ts`
2. `npm -C frontend run test -- features/ai-studio/components/__tests__/DetailModal.test.tsx`
3. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts`
4. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioEditSubmitIntent.test.ts`

Acceptance:
1. Slice warning target reduced to zero.
2. Existing behavior assertions stay green.
3. No net LOC growth in touched primary files unless tracker rationale is explicit.

### D2-01 Suppression Retirement
Targeted tests:
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useReferenceGridHorizontalSplit.test.ts`
2. `npm -C frontend run test:adaptive-v2-gate` (when reference-grid behavior touched)

Acceptance:
1. Scoped suppression removed.
2. Existing synchronous split behavior assertions remain deterministic.

### D3-01 / D3-02 Hard-Disable Cleanup
Targeted tests:
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
2. `npm -C frontend run test -- features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`
3. Existing page/controller tests for any touched toggle path.

Acceptance:
1. Unconditional hard-disable branches removed or converted to governed controls.
2. Retained kill-switches include owner and sunset criterion in tracker evidence.
3. No regression in protected adaptive/reference-grid suites.

### D4-01 Runtime Logging Hygiene
Acceptance:
1. Core runtime console diagnostics are audit-mode-only.
2. Operational telemetry remains available in supported channels.
3. No change to user-facing behavior or API envelope.

### D5-01 Guardrail Convergence
Outputs:
1. Update `docs/planning/ci-policy-checks.md` with Lane D runtime-safety policy mapping.
2. Update PR checklist policy to include Lane D strict runtime check for touched seams.
3. Record convergence decision and rollback/fallback policy.

Acceptance:
1. Lane D gate bundle is documented and linked.
2. Tracker rows include complete evidence links.

## Merge Gates (Per Slice)
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run check:architecture-boundary`
4. `npm -C frontend run check:size-budget`
5. `npm -C frontend run build`
6. `npm -C frontend run docs:check`
7. targeted tests for touched seam

Lane D strict runtime gate:
1. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`

Lane-level closeout:
1. `npm -C frontend run test`
2. `npm -C frontend run test:adaptive-v2-gate` (when adaptive/reference-grid protected surfaces were touched)
3. Complete evidence packet set under `docs/planning/evidence/lane-d/`

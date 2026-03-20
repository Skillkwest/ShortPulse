# AI Studio Expert Edit Coordinate Parity Phase 4 Execution Plan (2026-03-20)

## Purpose
Define the implementation-ready execution plan for Phase 4 (`Regression Harness and CI Gates`) of the Expert Edit coordinate parity program.

This document is execution-specific for tracker rows:
1. `CP-401`
2. `CP-402`
3. `CP-403`
4. `CP-404`

## Phase 4 Outcome Contract
Phase 4 is complete only when:
1. Transform-chain and threshold assertions are deterministic and enforced by unit tests.
2. Inline/modal interaction parity is protected by integration coverage for pointer lifecycle and zoom/pan matrix cases.
3. Visual/pixel drift signatures are locked by deterministic parity tests.
4. CI required checks block merges when coordinate parity thresholds regress.

## Execution Gating
### Entry Criteria
1. Phase 3 (`CP-301`, `CP-302`, `CP-303`) is marked `DONE`.
2. Export alignment and zoom-cap parity thresholds are passing with published evidence.
3. Phase 3 readiness notes identify no unresolved P3 contract blockers.

### Hard Blockers
1. Do not execute Phase 4 behavior-changing or gate-enforcement work while any Phase 3 gate remains open.
2. Do not execute Phase 5 rollout/canary work until Phase 4 exit criteria are accepted.

## Implementation Slices
### Slice P4-S1: Transform and Threshold Unit Harness (`CP-401`)
Objective:
1. Expand deterministic unit coverage for shared coordinate transforms and threshold invariants.

Target modules:
1. `frontend/features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts`
2. `frontend/features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`
3. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
4. `frontend/features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
5. `frontend/features/ai-studio/components/edit/stageSceneGeometry.ts`
6. `frontend/features/ai-studio/components/edit/inpaintMaskGeometry.ts`

Deliverables:
1. Round-trip and threshold assertions cover zoom `{0.5,1,2,4}`, pan variants, and aspect variants.
2. Unit assertions emit deterministic numeric diagnostics for threshold breaches.
3. Shared transform invariants are validated without DOM-layout flake dependencies.

### Slice P4-S2: Inline/Modal Interaction Parity Integration (`CP-402`)
Objective:
1. Lock parity of pointer-driven draw behavior between inline and modal surfaces under lifecycle edge cases.

Target modules:
1. `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
2. `frontend/features/ai-studio/components/edit/useExpertEditMarkupDrawController.ts`
3. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`

Deliverables:
1. Integration coverage includes `pointerup`, `pointercancel`, and capture-leave flows.
2. Tool parity assertions cover markup pen/eraser and inpaint brush/lasso pathways.
3. Cross-surface matrix fixtures confirm no inline-only or modal-only drift behavior.

### Slice P4-S3: Visual Drift Guard Suite (`CP-403`)
Objective:
1. Add deterministic visual/pixel drift checks for the known regression signatures.

Target modules:
1. `frontend/features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
2. `frontend/tests/e2e/ai-studio-expert-edit-parity.audit.js` (new)
3. `frontend/package.json` (new focused parity command wiring)

Deliverables:
1. Pixel or screenshot drift checks cover pointer-to-stroke placement and export-crop alignment signatures.
2. Visual harness uses fixed fixtures (camera, aspect, DPR profile) to avoid nondeterministic baselines.
3. Failures report artifact paths and per-metric deltas for triage.

### Slice P4-S4: CI Gate Wiring and Required Checks (`CP-404`)
Objective:
1. Wire parity harnesses into CI with explicit enforce/warn policy and required-check posture.

Target modules:
1. `.github/workflows/ci.yml`
2. `frontend/package.json`
3. `scripts/` parity gate utility entrypoint (new, if needed)

Deliverables:
1. Dedicated coordinate-parity gate command aggregates required unit/integration/visual checks.
2. CI gating policy is explicit and documented with enforce-mode default for merge protection.
3. CI summary output includes threshold pass/fail snapshot and artifact references.

### Slice P4-S5: Evidence Lock and Phase 5 Readiness
Objective:
1. Publish complete Phase 4 evidence and hand off a clean rollout-ready gate posture to Phase 5.

Deliverables:
1. Evidence packet under `docs/planning/evidence/ai-studio-expert-edit/` for all P4 rows.
2. Tracker updates for `CP-401`, `CP-402`, `CP-403`, `CP-404`.
3. Phase 5 readiness note with rollout guardrails and rollback commands validated.

## Validation and Commands
Minimum required commands:
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts`
2. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`
3. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
4. `npm -C frontend run test -- features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
5. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
6. `npm -C frontend run type-check`
7. `npm -C frontend run lint`
8. `npm -C frontend run build`
9. `npm -C frontend run docs:check`

## Exit Criteria
1. `CP-401`, `CP-402`, `CP-403`, and `CP-404` are all marked `DONE`.
2. Threshold regressions are blocked by required CI checks.
3. Visual drift guard outputs are deterministic and reproducible from documented commands.
4. Phase 4 evidence packet is published and linked from tracker.

## Rollback Posture
1. Keep Phase 4 changes isolated by slice for targeted rollback.
2. Revert order: `P4-S4` -> `P4-S3` -> `P4-S2` -> `P4-S1`.
3. Preserve Phase 3 evidence bundle to compare gate behavior before and after rollback.

## Risks
1. Visual harness flake causes false gate failures.
Mitigation: fixed fixtures, deterministic viewport/DPR settings, and bounded retry policy for artifact capture only.

2. CI runtime growth slows iteration speed.
Mitigation: split gate tiers (fast deterministic required set + heavier optional diagnostics) while preserving required coverage.

3. Thresholds become too permissive or too strict over time.
Mitigation: threshold changes require ADR/tracker note plus before/after evidence bundle.

## References
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-3-execution-plan-2026-03-20.md`
4. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
5. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`

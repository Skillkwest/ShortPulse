# AI Studio Expert Edit Evidence Index

## Purpose
Central index for evidence artifacts supporting Expert Edit, including the coordinate-parity hardening program.

## Artifacts
### Coordinate Parity Program
1. `coordinate-parity-evidence-template.md`
   - Canonical packet template for `CP-004` through `CP-503`.
2. `coordinate-parity-rollout-decision-log-2026-03-20.md`
   - Promote/hold/rollback log for baseline, canary, production verification, and closeout.
3. `2026-03-20-cp004-baseline-matrix.md`
   - Initial CP-004 baseline packet with validated command outputs and explicit remaining matrix coverage gaps.
4. `2026-03-20-cp004-gap-inventory.md`
   - Repo-backed gap inventory showing current automated coverage and remaining CP-004 blockers (`zoom=4`, canonical pan tuples, `4:3` stage, DPR matrix).
5. `2026-03-20-cp303-zoom-clamp-parity.md`
   - Phase 3 CP-303 packet proving one shared zoom clamp authority across viewport and flatten camera contracts; rerun complete and marked `PASS`.
6. `2026-03-20-cp301-cp302-mask-export-contract-progress.md`
   - Phase 3 CP-301/CP-302 status packet for canonical selected-layer mask resolution and flatten-consistent mask export mapping, including explicit `CP-301 PASS` and `CP-302 WAIVER_ACCEPTED` decision states.
7. `2026-03-20-cp401-transform-threshold-harness-progress.md`
   - Phase 4 CP-401 progress packet covering canonical zoom/pan transform-harness matrix assertions in unit suites.
8. `2026-03-20-cp402-pointer-lifecycle-integration-progress.md`
   - Phase 4 CP-402 progress packet covering inline/modal pointer lifecycle parity assertions for cancel/leave terminal paths.
9. `2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md`
   - Phase 4 CP-403/CP-404 closeout packet for deterministic parity gate scripts and CI enforce-mode wiring (consolidates CP-401/CP-402 closure).
10. `2026-03-20-cp501-canary-entry-and-rollback-contract.md`
   - Phase 5 CP-501 entry packet defining canary gate criteria, stop/go thresholds, and rollback contract.

### Existing Expert Edit Artifacts
1. `2026-03-04-model-capability-notes.md`
   - Fal edit model prompt-capability evidence used to implement `editPromptPolicy`.
   - Source policy: official Fal model API docs.
2. `2026-03-12-markup-modal-parity-matrix.md`
   - Baseline-to-closure parity matrix for Expert Edit main stage vs Markup modal stage.
   - Includes architecture boundary notes, viewport-geometry closure (normalized offsets + aspect-fit modal stage), and strict validation command set.
3. `2026-03-12-aspect-framing-no-distortion-closure.md`
   - Aspect-switch closure artifact for no-distortion framing behavior across inline + modal stages.
   - Captures isotropic scene-space mapping contract and regression validation set.
4. `2026-03-13-expert-edit-session-persistence-markup-inpaint.md`
   - Closure artifact for unified Expert Edit page-session persistence (`layers` + `markup` + `inpaint`).
   - Captures hydration/remount behavior and strict validation command results.

## Maintenance
1. For coordinate parity, publish dated evidence packets per phase and link them here.
2. Record baseline/canary/production decisions in the rollout decision log with linked evidence packets.
3. Keep this index updated whenever a new evidence file is added.

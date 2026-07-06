# Planning Docs

Purpose: provide the active execution entrypoint for planning work without forcing readers through the full historical planning corpus.

## Active-Surface Contract

- This index is for the current execution reading path only.
- `docs/planning/` still contains older working history, trackers, and phase plans, but they are not all active entrypoints.
- Retained evidence belongs in `docs/records/` or `docs/planning/evidence/` during the current transition and is not part of the primary planning reading path.
- Superseded or dormant planning docs should move to `docs/archive/planning/` only through a bounded cleanup lane; this index changes reading priority first.

## Start Here

1. `docs/planning/execution-authority.md`
2. `docs/planning/backlog.md`
3. `docs/known-issues.md`
4. `docs/systems/catalog.md`

## Active Program Reading Path

### Program 0: Execution Authority

- `docs/planning/execution-authority.md`
- `docs/planning/backlog.md`
- `docs/documentation_overview.md`
- `docs/planning/validation-matrix-by-program-2026-05-11.md`

### Program 1: Runtime And Money

- `docs/planning/current-branch-canonical-runtime-convergence-2026-05-07.md`
- `docs/planning/ai-studio-runtime-v2-recovery-execution-phase.md`
- `docs/planning/evidence/runtime-v2/README.md`
- `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`
- `docs/planning/generation-pipeline-continuation-tracker-2026-04-05.md`
- `docs/planning/ai-studio-generation-admission-rollout-plan.md`
- `docs/planning/credit-grant-lot-expiration-buildout-plan-2026-07-06.md`
- `docs/planning/kie-gpt-image-2-image-to-image-implementation-plan-2026-06-04.md`
- `docs/planning/plan-based-per-user-concurrency-execution-plan-2026-06-04.md`
- `docs/planning/billing-internal-comp-contracts-and-admin-exempt-renewals-plan-2026-04-23.md`

### Program 2: Media And Reference Integrity

- `docs/known-issues.md`
- `docs/planning/ai-studio-right-rail-drag-drop-buildout-plan-2026-06-08.md`
- `docs/planning/ai-studio-reference-grid-media-reliability-buildout-plan-2026-06-08.md`
- `docs/planning/ai-studio-detail-modal-reference-audit-system-2026-06-20.md`
- `docs/planning/ai-studio-live-session-check-media-panel-handoff-2026-04-05.md`
- `docs/planning/ai-studio-audio-companion-art-plan-2026-05-11.md`
- `docs/planning/ai-studio-full-workflow-reload-plan-2026-06-06.md`
- `docs/planning/ai-studio-generation-reference-grid-restoration-plan-2026-06-08.md`
- `docs/planning/media-library-reference-grid-optimization-plan.md`
- `docs/sops/sop_ai_studio_style_creator.md`

### Program 3: Structural Decomposition

- `docs/planning/ai-studio-expert-edit-properties-panel-fresh-start-lean-up-plan-2026-04-10.md`
- `docs/planning/ai-studio-agent-modularization-program.md`
- `docs/planning/ai-studio-agent-modularization-tracker.md`
- `docs/planning/ai-studio-reference-grid-modularization-program.md`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

### Program 4: Workflows And Product Surfaces

- `docs/planning/account-workspace-redesign-build-plan-2026-06-08.md`
- `docs/planning/ai-studio-video-lip-sync-implementation-plan-2026-06-08.md`
- `docs/planning/ai-studio-video-lip-sync-completion-plan-2026-06-10.md`
- `docs/planning/ai-studio-video-lip-sync-remediation-plan-2026-06-10.md`
- `docs/planning/edit-panel-canvas-tear-out-buildout-plan-2026-06-08.md`
- `docs/planning/expert-edit-stage-transform-chrome-rebuild-plan-2026-06-08.md`
- `docs/planning/expert-edit-master-stage-move-resize-buildout-plan-2026-06-08.md`
- `docs/planning/message-feedback-normalization-plan-2026-06-08.md`
- `docs/product/shortpulse_ai_studio.md`
- `docs/sops/sop_character_manager_operations.md`
- `docs/routes.md`

### Program 5: Release Confidence And Research

- `docs/testing-guide.md`
- `docs/release-checklist.md`
- `docs/planning/shortpulse-latency-launch-plan-2026-07-07.md`
- `docs/planning/tooling-audit-2026-02-16.md`
- `docs/planning/validation-matrix-by-program-2026-05-11.md`

## Interpretation Rules

- A planning file is an active entrypoint only if it is linked from `docs/planning/execution-authority.md` or explicitly named in the active program reading path above.
- Other files under `docs/planning/` should be treated as working history or supporting context until a live lane reactivates them.
- Do not start implementation from retained evidence or dormant plans without a current problem statement backed by the systems catalog, known issues, or a failing test/live repro.

## Retained Records

- `docs/records/README.md`: retained-records policy and target namespace
- `docs/planning/evidence/README.md`: transition index for planning evidence that has not moved yet

## Recent Completed Phase Checkpoints

- `docs/archive/planning/model-modal-policy-phase-plan-2026-05-10.md`
- `docs/archive/planning/fal-route-surface-reduction-phase-plan-2026-05-11.md`
- `docs/archive/planning/ai-studio-pricing-runtime-alignment-coverage-2026-05-11.md`
- `docs/archive/planning/ai-studio-primary-character-panel-build-plan.md`

## Maintenance

- Keep this README short and current.
- Update `docs/planning/execution-authority.md` first when program boundaries or lane-entry rules change.
- Update `docs/planning/backlog.md` when current work priorities change.
- Move superseded planning docs to `docs/archive/planning/` through a bounded cleanup lane instead of silently leaving them in the active reading path.

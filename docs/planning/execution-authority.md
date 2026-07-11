# Planning Execution Authority

Purpose: define the authoritative execution reading path for active work, reduce planning-doc ambiguity, and group ongoing work into bounded programs instead of page-by-page backlog sprawl.

Status: active
Last reviewed: 2026-07-10

## Why this exists

- `docs/planning/` contains a large amount of retained program history, trackers, phase plans, and evidence-adjacent material.
- The repo needs one current execution entrypoint so new lanes do not start from stale or overlapping plans.
- This file is the authority map for what is active now. Files under `docs/planning/` that are not listed here are not part of the default implementation reading path unless a live lane explicitly reactivates them.

## Default reading path

1. `docs/systems/catalog.md`
2. `docs/known-issues.md`
3. `docs/planning/execution-authority.md`
4. `docs/planning/backlog.md`
5. Program-specific docs listed under the active program below

## Planning classes

- `authority`: current execution controls and active lane entrypoints
- `active program`: currently valid plans, trackers, or contracts for a live program
- `retained evidence`: supporting history under `docs/records/` or `docs/planning/evidence/`; not part of the default reading path
- `working history`: older planning artifacts that remain useful for context but are not current execution entrypoints
- `archive candidate`: superseded or dormant docs that should move to `docs/archive/planning/` when a bounded cleanup lane is opened

## Lane entry rules

A new lane can open only when at least one is true:

- it addresses a weak system in `docs/systems/catalog.md`
- it addresses an active issue in `docs/known-issues.md`
- it is backed by a failing test or live repro
- it is a blocker discovered inside the currently active program

Do not open new lanes:

- by adjacency alone
- from dormant planning docs that are not reactivated here
- from retained evidence without a current problem statement

## Program portfolio

### Program 0: Execution Authority

Goal: keep planning docs operable as one current execution map.

Owns:

- `docs/planning/execution-authority.md`
- `docs/planning/backlog.md`
- `docs/planning/README.md`
- planning classification and archive-candidate follow-up

Primary entry docs:

- `docs/planning/execution-authority.md`
- `docs/planning/backlog.md`
- `docs/documentation_overview.md`
- `docs/planning/validation-matrix-by-program-2026-05-11.md`

Stop rule:

- stop once the active reading path is clear and the next useful action is archive follow-up rather than authority clarification

### Program 1: Runtime And Money

Goal: stabilize the highest-risk shared runtime and payment-adjacent lanes.

Owns:

- generation recovery, settlement, replay, admission, and runtime closeout
- Stripe/payment pipeline items that block production confidence

Primary entry docs:

- `docs/planning/security-boundary-remediation-implementation-plan-2026-07-10.md`
- `docs/planning/current-branch-canonical-runtime-convergence-2026-05-07.md`
- `docs/planning/ai-studio-runtime-v2-recovery-execution-phase.md`
- `docs/planning/evidence/runtime-v2/README.md`
- `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`
- `docs/planning/generation-pipeline-continuation-tracker-2026-04-05.md`
- `docs/planning/ai-studio-generation-admission-rollout-plan.md`
- `docs/planning/billing-internal-comp-contracts-and-admin-exempt-renewals-plan-2026-04-23.md`
- `docs/planning/ai-studio-safe-completion-implementation-plan-2026-07-10.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`

Stop rule:

- stop when the next issue is primarily media/reference correctness rather than shared runtime convergence

### Program 2: Media And Reference Integrity

Goal: fix the highest-trust media and reference workflow failures.

Owns:

- Reference Grid reliability and user-visible media correctness
- styles-drop intake/resolver behavior
- media typing, preview, signing, restore, and reuse correctness

Primary entry docs:

- `docs/known-issues.md`
- `docs/troubleshooting.md`
- `docs/planning/ai-studio-browser-oom-and-crash-observability-buildout-plan-2026-07-10.md`
- `docs/sops/sop_ai_studio_style_creator.md`
- `docs/sops/sop_ai_studio_media_library_operations.md`
- `docs/planning/ai-studio-live-session-check-media-panel-handoff-2026-04-05.md`
- `docs/planning/media-library-reference-grid-optimization-plan.md`

Stop rule:

- stop when remaining issues are structural refactor or broader runtime concerns rather than media/reference behavior

### Program 3: Structural Decomposition

Goal: reduce change risk in oversized modules after their behavior is stable.

Owns:

- oversized AI Studio UI/state files
- oversized shared runtime files
- modularity and boundary enforcement follow-up

Primary entry docs:

- `docs/sops/sop_new_feature_modularization.md`
- `docs/planning/ai-studio-expert-edit-properties-panel-fresh-start-lean-up-plan-2026-04-10.md`
- `docs/planning/ai-studio-agent-modularization-program.md`
- `docs/planning/ai-studio-agent-modularization-tracker.md`
- `docs/planning/ai-studio-reference-grid-modularization-program.md`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

Stop rule:

- stop when the next split no longer reduces real implementation risk more than it adds churn

### Program 4: Workflows And Product Surfaces

Goal: improve weaker workflow-local surfaces after shared runtime and media lanes are under control.

Owns:

- Character Manager and workflow-local AI Studio UX
- character-panel lean hardening and QuickSwap retirement
- dashboard, profile, and page-level product surface follow-up
- workflow-local state and restore behavior not owned by Programs 1-2

Primary entry docs:

- `docs/planning/ai-studio-voice-changer-video-recovery-and-reliability-plan-2026-07-10.md`
- `docs/planning/account-workspace-redesign-build-plan-2026-06-08.md`
- `docs/planning/ai-studio-video-lip-sync-implementation-plan-2026-06-08.md`
- `docs/planning/ai-studio-video-lip-sync-completion-plan-2026-06-10.md`
- `docs/planning/ai-studio-video-lip-sync-remediation-plan-2026-06-10.md`
- `docs/product/shortpulse_ai_studio.md`
- `docs/sops/sop_character_manager_operations.md`
- `docs/routes.md`

Stop rule:

- stop when remaining work is either shared-platform risk or non-critical polish

### Program 5: Release Confidence And Research

Goal: keep validation intentional and research bounded.

Owns:

- validation lane selection
- audit-script retention decisions
- research spikes that should not silently become implementation lanes

Primary entry docs:

- `docs/testing-guide.md`
- `docs/release-checklist.md`
- `docs/planning/tooling-audit-2026-02-16.md`
- `docs/planning/validation-matrix-by-program-2026-05-11.md`

Stop rule:

- stop when required validation lanes are explicit and open research questions are either scheduled or dropped

## Current activation state

- `Program 0`: active
- `Program 1`: active
- `Program 2`: active
- `Program 3`: hold until Program 1 or 2 seams are behaviorally stable
- `Program 4`: active for bounded workflow-local issues only
- `Program 5`: active for validation-matrix and research triage work, not broad feature implementation

## Archive and dormant handling

- Files under `docs/planning/` that are not named in this document should be treated as `working history` unless a live lane explicitly promotes them back into the active reading path.
- Recent completed phase checkpoints can remain in `docs/planning/` for discoverability without being part of the active reading path.
- Do not use dormant or superseded plans as the reason to begin a new implementation lane.
- Archive movement is a separate bounded cleanup lane; this document changes reading priority first and physical file placement second.

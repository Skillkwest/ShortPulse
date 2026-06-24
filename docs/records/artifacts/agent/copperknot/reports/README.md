# Copperknot Reports

Purpose: store full audit packets, roadmap snapshots, dispatch tracking, and inbound execution-lane closeouts used by the Copperknot.

## Current Primary Authority Surfaces

July 7 launch-control note: these retained reports are historical evidence aids unless explicitly refreshed. Current readiness and queue authority lives in `docs/agents/copperknot/july-7-launch-authority.md`, `docs/agents/copperknot/july-7-system-map.md`, `docs/agents/copperknot/july-7-launch-board.md`, and `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`.

- `2026-05-31-project-workspace-production-verification-pass.md`: current freshest retained packet proving `Project / workspace persistence` reached ship floor after the production persistence audit passed on `https://www.shortpulse.ai`.
- `2026-06-01-characters-workflow-measurement-refresh.md`: current retained packet proving the Character Mode model-picker audit, local Character guards, and production Character Manager save/reopen continuity are healthy enough to move `Characters workflow` to `6/10`, with a residual delete-confirmation pointer-layering finding held below the next exact lane.
- `2026-06-01-elements-workflow-measurement-refresh.md`: current retained packet proving the approved-panel KPI measurement correction and production remeasurement moved `Elements workflow` to `6/10`, with evidence-depth limits keeping it at floor.

## Current Secondary Overlays

- These are optional user-facing overlays, not part of Copperknot's default thinking load.
- Refresh them only when the user explicitly wants them or when a major launch-state correction needs a clearer human-facing checkpoint.
- `2026-05-31-operator-brief.html`: current rich-format operator brief for the May 31 post-deploy state.
- `2026-05-31-operator-brief.md`: source-only backing artifact for the current operator brief.
- `2026-05-31-launch-ready-checklist.md`: current ADHD-friendly launch-ready checklist after the May 31 post-deploy state.
- `2026-05-31-launch-ready-checklist.html`: browser-friendly version of the current launch-ready checklist.

## Current Supporting Lane Audits

- `2026-05-31-project-workspace-persistence-root-seam-audit.md`: current source-seam audit for the exact-next `Project / workspace persistence` lane.
- `2026-05-31-project-workspace-production-verification-failure.md`: live production failure packet that narrowed the orphan generated-output restore seam before the accepted local root fix landed.
- `2026-05-31-project-workspace-persistence-closeout-review.md`: retained closeout review explaining why the local root fix was accepted before production proof.
- `2026-05-31-project-workspace-production-verification-packet.md`: proof packet used to verify the accepted persistence root fix on live production.
- `2026-05-31-approved-panel-post-deploy-verification.md`: retained production packet explaining why `Elements workflow` moved out of the exact-next slot before the persistence lane resumed control.
- `2026-06-01-elements-workflow-measurement-refresh.md`: retained production packet explaining why `Elements workflow` moved from below floor to at-floor maintenance and why `Create workflow` became exact next.
- `2026-06-23-video-motion-control-provider-admission-acceptance.md`: retained local source-hardening acceptance packet for Kie Motion Control provider-admission, with production/provider proof still approval-gated when credits are involved.

## Current Intake Surfaces

- `external-lane-closeouts/README.md`: intake rules for closeout reports written by execution agents.
- `external-lane-closeouts/template.md`: reusable closeout format for execution agents finishing a lane.

## Historical Launch-Control Reports

- `2026-05-06-kickoff.md`: initial mission framing, deadline, baseline scores, and first priority systems.
- `2026-05-15-production-launch-state-refresh.md`: production-only launch-state refresh that reconciled May 15 evidence without forcing a full rerating.
- `2026-05-16-production-repo-audit-and-dispatch-output.md`: full repo-plus-worktree audit on `production`, July 2 window refresh, and then-current dispatch-ready worklist.
- `2026-05-16-closeout-intake-review.md`: review of newly received external lane closeouts and the next Copperknot action at that time.
- `2026-05-16-consolidated-rerating-pass.md`: repo-backed rerating decisions for the first full ship-critical closeout batch.
- `2026-05-16-managed-lane-review-and-reference-grid-clear.md`: managed subagent review packet that cleared the Reference Grid blocker and held the latest Edit/project-workspace follow-up scores.
- `2026-05-16-copperknot-rename-pass.md`: source report for the Copperknot rename pass and identity-surface cleanup.
- `2026-05-16-memory-and-catalog-prune-audit.md`: earlier pruning audit for Copperknot memory, retained context, and launch-focus catalog docs.
- `2026-05-16-workspace-audit.md`: workspace-structure audit confirming the Copperknot space is self-contained and operational.
- `2026-05-19-production-baseline-refresh.md`: dated full repo-plus-worktree baseline refresh that preserved the original May 6 baseline and updated then-current launch-control truth.
- `2026-05-27-production-baseline-reset-audit.md`: dated repo-plus-worktree baseline reset that retired the stale May 19 queue order and moved exact-next back to Create validation convergence.
- `2026-05-30-production-post-redeploy-baseline-refresh.md`: dated post-redeploy repo-plus-production refresh that kept Elements exact next before the May 31 remeasurement.
- `2026-05-31-approved-panel-production-remeasurement-audit.md`: earlier same-day pre-deploy approved-panel remeasurement that kept Elements exact next before the deployed root-fix verification landed.

## Historical Operator Briefs And Checklists

- `2026-05-16-operator-brief.html`
- `2026-05-16-operator-brief.md`
- `2026-05-16-launch-ready-checklist.md`
- `2026-05-16-launch-ready-checklist.html`
- `2026-05-19-operator-brief.html`
- `2026-05-19-operator-brief.md`
- `2026-05-19-launch-ready-checklist.md`
- `2026-05-19-launch-ready-checklist.html`
- `2026-05-27-operator-brief.html`
- `2026-05-27-operator-brief.md`
- `2026-05-27-launch-ready-checklist.md`
- `2026-05-27-launch-ready-checklist.html`
- `2026-05-28-operator-brief.html`
- `2026-05-28-operator-brief.md`
- `2026-05-28-launch-ready-checklist.md`
- `2026-05-28-launch-ready-checklist.html`
- `2026-05-30-operator-brief.html`
- `2026-05-30-operator-brief.md`
- `2026-05-30-launch-ready-checklist.md`
- `2026-05-30-launch-ready-checklist.html`

## Historical Retained Reports

- `2026-05-10-media-library-speed-and-lean-roadmap.md`
- `2026-05-10-media-library-phase0-execution-checklist.md`

These remain preserved, but they are not part of the default Copperknot launch-readiness reading path unless that media-library lane is reopened.

## Organization Rule

- Copperknot-authored audit and tracking reports stay in this folder.
- External execution-agent closeouts belong under `external-lane-closeouts/`.
- Markdown is the default source of truth for Copperknot reports.
- Only operator briefs and launch-ready checklists should keep sibling HTML renders by default.
- Treat this folder as a retained evidence surface, not as a default startup memory surface.
- Routine Copperknot load should prefer the current primary authority surfaces first.
- Secondary overlays should be opened only when they reduce user decision burden or when a richer human-facing summary is specifically useful.
- Retired bookkeeping surfaces should stay retired. Do not rebuild them as active launch-control layers.

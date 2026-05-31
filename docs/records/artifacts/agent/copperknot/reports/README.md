# Copperknot Reports

Purpose: store full audit packets, roadmap snapshots, dispatch tracking, and inbound execution-lane closeouts used by the Copperknot.

## Current Live Surfaces

- `2026-05-06-dispatch-log.md`: current external handoff dispatch status for the active production-readiness window.
- `2026-05-30-production-post-redeploy-baseline-refresh.md`: current post-redeploy repo-plus-production baseline refresh.
- `2026-05-30-operator-brief.html`: current rich-format operator brief for the post-redeploy audit.
- `2026-05-30-operator-brief.md`: source-only backing artifact for the current operator brief.
- `2026-05-30-launch-ready-checklist.md`: current ADHD-friendly launch-ready checklist after the post-redeploy refresh.
- `2026-05-30-launch-ready-checklist.html`: browser-friendly version of the current launch-ready checklist.

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

## Historical Retained Reports

- `2026-05-10-media-library-speed-and-lean-roadmap.md`
- `2026-05-10-media-library-phase0-execution-checklist.md`

These remain preserved, but they are not part of the default Copperknot launch-readiness reading path unless that media-library lane is reopened.

## Organization Rule

- Copperknot-authored audit and tracking reports stay in this folder.
- External execution-agent closeouts belong under `external-lane-closeouts/`.
- Markdown is the default source of truth for Copperknot reports.
- Only operator briefs and launch-ready checklists should keep sibling HTML renders by default.
- Treat this folder as a retained evidence surface, not as a default startup memory surface. Only the current live surfaces above belong in routine Copperknot load.

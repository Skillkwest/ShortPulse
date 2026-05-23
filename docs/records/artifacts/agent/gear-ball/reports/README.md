# Gear Ball Retained Reports

Purpose: index retained Gear Ball reports that are useful for training, traceability, and recurring operational quality.

## When To Write A Report

Create a dated report when a Gear Ball run:

- spans multiple logical commits
- exposes a new recurring failure mode
- needs a durable batch manifest or validation summary
- leads to a new tool/SOP/helper decision
- materially changes Gear Ball's own operating contract

## Required Post-Run Additions

Substantive commit/push reports should include:

- self-audit summary
- score out of 10
- repeated friction vs one-time difficulty
- tooling decision
- SOP/training update decision
- route-level browser smoke result when the run changed an interaction-heavy admin or frontend route

## Template

- `docs/records/artifacts/agent/gear-ball/reports/run-report-template.md`

## High-Signal Reports

- `docs/records/artifacts/agent/gear-ball/reports/2026-05-22-production-score-loop-and-mixed-lane-hardening-run.md`
  - score-loop and mixed-lane hardening pivot
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-22-production-full-worktree-accountability-pivot.md`
  - full-worktree SOP accountability correction
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-23-production-closeout-integrity-and-report-utility-pivot.md`
  - final-report usefulness and stale-closeout correction
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-19-production-media-library-runtime-and-gear-ball-hardening-run.md`
  - helper/tooling hardening and stale-modal audit repair
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-18-production-project-foundation-and-prompt-bridge-run.md`
  - repeated leftover-audit chain and large mixed-run lessons

## Archive Note

Older dated reports remain in this folder and keep their filename-as-index function.
Do not load them by default.
Open a specific dated report only when the current run needs that exact historical lesson or evidence trail.

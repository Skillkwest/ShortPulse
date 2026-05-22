# Gear Ball Training History

Purpose: keep the current training synthesis short and actionable.

Canonical detailed surfaces:

- `docs/records/artifacts/agent/gear-ball/conversation-training-dataset.jsonl`
- `docs/records/artifacts/agent/gear-ball/run-log.md`
- `docs/records/artifacts/agent/gear-ball/reports/`

## Current Score Snapshot

- Recent substantive-run range: `7/10` to `9/10`
- Current working band: `7.5/10` to `8.5/10`
- Main gap to `10/10`: mixed-tree lane splitting and time-to-clean-push efficiency when leftover files resurface mid-run

## Latest Run

- `2026-05-22` on `production`
- Score: `7/10`
- What went well: Gear Ball kept the branch contract intact, validated each shipped lane, and correctly deferred unrelated Pulse/runtime tails instead of bundling them into the publish.
- What slipped: the run stayed safe but got slow because the worktree was mixed, commit-hook stash restore resurfaced adjacent files multiple times, and optional visual QA was attempted before confirming the browser runtime could actually support it.
- Capability decision: add a retained score loop, create a fast grouped-worktree helper, and harden Gear Ball's memory/checklist around earlier lane-splitting and QA-tool availability checks.

## Current Failure Classes

1. Mixed-tree lane boundaries stay open too long before the first split.
2. Optional verification paths can waste time when tool availability is assumed instead of confirmed.
3. Post-commit stash restore can reintroduce unrelated files and steal focus from the intended next batch.

## Current Training Priorities

1. Split mixed trees earlier and defer resurfaced unrelated files by default unless they are required for correctness.
2. Verify optional browser/smoke tooling availability before paying setup or reasoning cost for visual QA.
3. Keep the retained score loop current after every sub-`9/10` supervised run so drift becomes visible immediately.

## Working Guidance

- Prefer file-backed manifests on large runs.
- Treat shared contracts as fan-out triggers, not local-file-only changes.
- Ship mechanical remediation on sub-`9/10` runs whenever feasible.
- Encode repeated user corrections as structured training cases, not extra prose memory.
- Use the performance ledger to track whether the weakest category is actually moving across recent runs.

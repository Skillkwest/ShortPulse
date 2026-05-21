# Gear Ball Training History

Purpose: keep the current training synthesis short and actionable.

Canonical detailed surfaces:

- `docs/records/artifacts/agent/gear-ball/conversation-training-dataset.jsonl`
- `docs/records/artifacts/agent/gear-ball/run-log.md`
- `docs/records/artifacts/agent/gear-ball/reports/`

## Current Score Snapshot

- Recent substantive-run range: `6/10` to `9/10`
- Current working band: `8.5/10` to `9/10`
- Main gap to `10/10`: first-manifest fan-out completeness on shared contracts

## Latest Run

- `2026-05-20` on `production`
- Score: `8/10`
- What went well: Gear Ball still got a mixed moving worktree to a clean push through four coherent commits, and the expanded product manifest cleared targeted preflight after catching the real `VoicesPropertiesPanel` regression before publish.
- What slipped: new files kept appearing mid-run, the first product manifest underreached twice, and parallel Git inspection during the commit phase reintroduced avoidable `index.lock` friction.
- Capability decision: shipped one mechanical remediation by tightening Gear Ball's hot path and memory to forbid parallel Git calls once the commit phase starts.

## Current Failure Classes

1. First-manifest fan-out misses when the worktree keeps moving during the run.
2. Validation drift when a fix lands after a long-running gate has already started.
3. Commit-phase Git contention from overlapping status/add/diff calls.

## Current Training Priorities

1. Re-lock manifests from live `git status --short` any time new files appear mid-run before the next commit boundary.
2. Keep validation bound to the exact final tree after any mid-run fix.
3. Keep the commit phase strictly serialized on Git operations.

## Working Guidance

- Prefer file-backed manifests on large runs.
- Treat shared contracts as fan-out triggers, not local-file-only changes.
- Ship mechanical remediation on sub-`9/10` runs whenever feasible.
- Encode repeated user corrections as structured training cases, not extra prose memory.

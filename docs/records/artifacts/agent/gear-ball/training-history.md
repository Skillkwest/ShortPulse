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

## Current Failure Classes

1. First-manifest fan-out misses on uncatalogued shared contracts.
2. Validation drift when a fix lands after a long-running gate has already started.
3. Unnecessary active/retained documentation overlap that slows rule lookup.

## Current Training Priorities

1. Improve first-manifest fan-out on shared contracts beyond the currently catalogued cases.
2. Keep validation bound to the exact final tree after any mid-run fix.
3. Keep the active Gear Ball surface minimal and fast to load.

## Working Guidance

- Prefer file-backed manifests on large runs.
- Treat shared contracts as fan-out triggers, not local-file-only changes.
- Ship mechanical remediation on sub-`9/10` runs whenever feasible.
- Encode repeated user corrections as structured training cases, not extra prose memory.

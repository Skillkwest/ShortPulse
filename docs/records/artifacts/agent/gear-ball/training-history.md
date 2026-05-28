# Gear Ball Training History

Purpose: keep the current training synthesis short and actionable.

Canonical detailed surfaces:

- `docs/records/artifacts/agent/gear-ball/conversation-training-dataset.jsonl`
- `docs/records/artifacts/agent/gear-ball/run-log.md`
- `docs/records/artifacts/agent/gear-ball/reports/`

## Current Score Snapshot

- Recent substantive-run range: `6/10` to `9.2/10`
- Current working band: `8.4/10` to `9.0/10`
- Main gap to `10/10`: first-pass cleanup friction, occasional stale end-of-run bookkeeping risk, rare command-shape misses on mixed manifests, and sibling source tails that surface only during the last convergence pass

## Active Synthesis

- Bias toward the fewest honest lanes. Full-worktree accountability stays mandatory, but perfect taxonomy is overhead.
- Build the final report only from the exact final tree and real pushed commits.
- Keep training capture compact by default: one ledger row every run, heavier retained updates only when the lesson is genuinely new or the score falls below target.
- Keep closeout suggestions inside Gear Ball’s own lane unless the user explicitly asks for broader recommendations.
- Treat tool-backed side effects as evidence-gated; do not use completion language before the tool confirms success.

## What Stays In Active Memory

- The current score band and main recurring drag.
- The smallest current operating pivots that consistently raise score.
- Only the durable lessons that should shape every normal SOP run.

## What Stays Out Of Active Memory

- Full narrative run history
- Older supervised corrections whose durable rule is already captured in `memory.md`
- Per-run detail that already lives in `performance-ledger.md`
- Conversation-derived examples unless this is explicitly a training lane

## Current Priorities

1. Make the first cleanup pass one-shot more often, especially on mixed manifests and macOS shell invocations.
2. Keep broad shared-runtime lanes collapsed when one validation seam can honestly carry them.
3. Preserve strict end-of-run integrity: no stale closeout, no early score-loop writeback, no unclassified tails, and one last `git diff --name-only` scan before the score loop when a broad lane touched shared runtime seams.
4. Keep startup and retained-history loading lean by default.

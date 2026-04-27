# Docs Cleanup Done-State Audit (2026-04-27)

Purpose: record the final repo-backed stop/go audit for the docs-fat-trimming lane so follow-on work is justified by explicit remaining blockers instead of adjacency or momentum.

## Current snapshot
- Audit date: `2026-04-27`
- Validation: `cd frontend && npm run docs:check` passes fully.
- Top-level planning docs still under `docs/planning/`: `193`
- Top-level planning docs with noncanonical status: `0`
- Top-level planning docs missing status: `1` (`docs/planning/README.md`, intentionally status-less)

## What is already done
1. Active planning metadata is normalized.
2. Completed and clearly superseded top-level planning packets were moved out of the active planning surface in bounded batches.
3. `docs/README.md`, `docs/planning/README.md`, `docs/archive/README.md`, and `docs/archive/planning/README.md` now route readers through current truth, archive, and records more cleanly.
4. `docs/records/` exists as the retained-records governance entrypoint.
5. The main reading path no longer enumerates raw planning-evidence packet inventories.
6. `docs:check` is green, including semantic drift, archive manifest, naming drift, and model-catalog parity.

## Remaining strict done-state blockers
These are the items that still block the strict original end state for this cleanup lane.

### 1. Evidence is not fully migrated out of `docs/planning/evidence/`
Remaining physical namespaces under `docs/planning/evidence/`:
- `ai-studio-expert-edit/` (`17` files)
- `ai-studio-reference-grid-reliability/` (`5`)
- `generation-reliability-hardening/` (`32`)
- `lane-c/` (`4`)
- `media-rendering-hardening-v2/` (`11`)
- `naming-canonicalization/` (`23`)
- `reference-grid-modularization/` (`52`)
- `unified-buildout/` (`140`)

Interpretation:
- This does not currently break navigation or validation because records policy and indexes already route readers away from raw packet inventories.
- It does block the strictest version of the cleanup end state because retained evidence is still physically split between `docs/planning/evidence/` and `docs/records/`.

### 2. Some active-planning docs are still better described as resumable checkpoints or mixed-purpose governance memory
Examples:
- `docs/planning/supabase-production-cutover-handoff-2026-03-13.md`
- `docs/planning/ai-studio-reference-grid-runtime-simplification-plan-2026-03-31.md`
- `docs/planning/ai-studio-webhook-canary-closeout-plan.md`
- `docs/planning/ai-studio-webhook-canary-closeout-tracker.md`
- `docs/planning/master-rollout-proposal.md`
- `docs/planning/shortpulse-unified-buildout-master-plan.md`
- `docs/planning/shortpulse-unified-buildout-tracker.md`

Interpretation:
- These docs are no longer metadata-broken; they have canonical statuses or otherwise sit within the current active contract.
- They still blur the line between active execution, deferred closeout, and retained governance memory.
- This is the main remaining planning-surface judgment call if the repo wants the strictest possible active/historical separation.

## What is no longer a blocker
1. Missing top-level planning statuses are no longer a real issue.
2. Noncanonical top-level planning statuses are no longer a real issue.
3. Completed top-level planning packets are no longer lingering in active indexes in obvious contradiction.
4. Model-catalog drift is no longer blocking docs validation.
5. Raw evidence is no longer part of the primary reading path.

## Recommendation
The cleanup lane has reached the point where broad continuation is optional rather than clearly justified.

Recommended stop posture:
1. Treat the current state as operationally healthy.
2. Do not resume broad namespace migration by default.
3. Only continue if one of these is true:
   - a remaining planning doc causes active-truth ambiguity for real contributors,
   - a remaining evidence namespace creates navigation/operator confusion,
   - or a validation/governance check regresses.

## Highest-ROI follow-on options
If the repo wants to keep going, the best bounded options are:
1. One final active-surface pass on paused/resumable planning docs to decide whether they belong in `docs/planning/`, `docs/archive/planning/`, or `docs/records/`.
2. One deliberate large-namespace decision on `unified-buildout/` rather than more small evidence moves.
3. Otherwise stop this lane and preserve the current gains.

## Audit conclusion
The docs cleanup lane is not at the strict original done state yet, but it is very close to a practical stop point.

Practical judgment:
- Current state: clean enough to stop without creating risk.
- Remaining work: mostly about stricter archival semantics and full physical evidence migration, not about broken authority or failing validation.

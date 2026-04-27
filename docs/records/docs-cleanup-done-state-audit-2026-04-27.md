# Docs Cleanup Done-State Audit (2026-04-27)

Purpose: record the final repo-backed stop/go audit for the docs-fat-trimming lane so follow-on work is justified by explicit remaining blockers instead of adjacency or momentum.

## Current snapshot
- Audit date: `2026-04-27`
- Validation: `cd frontend && npm run docs:check` passes fully after the route-auth vocabulary correction for the GPT Image 2 handler-authenticated routes.
- Top-level planning docs still under `docs/planning/`: `189`
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
None.

Interpretation:
- Validation is green.
- The top-level planning surface no longer has meaningful status drift.
- Remaining namespaces under `docs/planning/evidence/` are now explicitly classified active exceptions rather than ambiguous retained-records leftovers.

## Active exceptions
These namespaces intentionally remain under `docs/planning/evidence/` because they still function as current execution proof for active planning surfaces.

- `ai-studio-expert-edit/` (`17` files)
  - Active-program exception while `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md` still has `CP-501` in progress and `CP-502` / `CP-503` pending.
- `reference-grid-modularization/` (`52` files)
  - Active-governance exception while `docs/planning/ai-studio-reference-grid-modularization-tracker.md` remains `Status: active` and governance dependencies `RG-DEP-04` / `RG-DEP-05` remain open.
- `unified-buildout/` (`140` files)
  - Active-program exception while `docs/planning/shortpulse-unified-buildout-tracker.md` still uses phase evidence as current execution gating.

## Optional follow-on judgment call
### Large governance docs could still be compressed later if the repo wants an even stricter current-truth surface
Examples:
- `docs/planning/master-rollout-proposal.md`
- `docs/planning/shortpulse-unified-buildout-master-plan.md`
- `docs/planning/shortpulse-unified-buildout-tracker.md`

Interpretation:
- These docs still act as live authority surfaces today, so they are not obvious archive candidates.
- This is no longer a blocker for a clean, validated planning surface; it is only a later compression decision if the repo wants even stricter current-truth separation.

## What is no longer a blocker
1. Missing top-level planning statuses are no longer a real issue.
2. Noncanonical top-level planning statuses are no longer a real issue.
3. Completed top-level planning packets are no longer lingering in active indexes in obvious contradiction.
4. Model-catalog drift is no longer blocking docs validation.
5. Raw evidence is no longer part of the primary reading path.
6. Remaining planning-evidence namespaces are no longer in an implicit or misleading state.

## Recommendation
The cleanup lane has reached its intended stop point.

Recommended stop posture:
1. Treat the current state as operationally healthy.
2. Do not resume broad namespace migration by default.
3. Only continue if one of these is true:
   - an active planning doc creates new authority ambiguity,
   - an active exception closes and its evidence can be migrated cleanly,
   - or a validation/governance check regresses.

## Highest-ROI follow-on options
If the repo wants to keep going later, the best bounded options are:
1. Migrate an active exception only after its planning tracker is actually closed or replaced.
2. Add lightweight enforcement for planning-evidence index drift if this starts to regress.
3. Otherwise stop this lane and preserve the current gains.

## Audit conclusion
The docs cleanup lane is now at its planned stop point.

Practical judgment:
- Current state: clean enough to stop without creating risk.
- Remaining work: active exceptions that should be revisited only when their planning trackers close, plus optional future enforcement or governance-surface compression.

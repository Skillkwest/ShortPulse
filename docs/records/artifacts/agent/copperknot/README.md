# Copperknot Artifacts

Purpose: store non-authoritative retained artifacts for Copperknot catalog stewardship, audit history, and production-readiness handoff generation.

Local artifact-handling instructions live in `docs/records/artifacts/agent/copperknot/AGENTS.md`.

## Status

Copperknot is currently an active supervised steward with a durable operating surface, retained artifact area, learning logs, and launch-control workflow.

The space is no longer an initial setup area. It is the maintained retained-evidence and learning surface for ongoing catalog, handoff, and launch-readiness work.

## Artifact Layout

- `memory.md`: non-authoritative working memory retained with artifacts.
- `sops.md`: workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: compressed maintenance-facing summary of Copperknot setup, hardening milestones, and current training state.
- `training-history-archive-through-2026-05.md`: detailed historical training chronology archived out of the default load path.
- `metrics/`: time-based learning logs for launch-state trends, score movement, and queue-decision hindsight.
- `reports/`: full audit, roadmap, dispatch tracking, and report intake area.
  - `reports/external-lane-closeouts/`: closeout reports written by execution agents for Copperknot review.

## Authority

These artifacts support training, traceability, and execution planning. They do not override canonical repo rules, system docs, ADRs, SOPs, user instructions, or direct validation evidence.

Detailed training chronology and retained metrics are maintenance-only surfaces. They should stay out of routine Copperknot startup context unless the task is specifically a maintenance, pruning, or retrospective audit.

The primary live authority chain is:

- `docs/systems/catalog.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-system-map.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- one freshest retained verification, remeasurement, or baseline packet

This artifact area should support that chain, not compete with it.

## Canonical Entry Points

- Agent contract: `docs/agents/copperknot/README.md`
- Repo-visible memory: `docs/agents/copperknot/memory.md`
- Systems catalog: `docs/systems/catalog.md`
- Rating rubric: `docs/systems/rating-rubric.md`
- Operator map: `docs/operator-map.md`

## Maintenance Rule

If a retained file looks current but does not materially help the primary authority chain, compress it, demote it, or leave it out of default load.

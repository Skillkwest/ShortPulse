# System Catalog Agent Artifacts

Purpose: store non-authoritative retained artifacts for the System Catalog Agent's catalog stewardship, audit history, and production-readiness handoff generation.

Local artifact-handling instructions live in `docs/records/artifacts/agent/system-catalog-agent/AGENTS.md`.

## Status

System Catalog Agent is currently an active supervised steward with a durable operating surface, retained artifact area, learning logs, and launch-control workflow.

The space is no longer an initial setup area. It is the maintained retained-evidence and learning surface for ongoing catalog, handoff, and launch-readiness work.

## Artifact Layout

- `memory.md`: non-authoritative working memory retained with artifacts.
- `sops.md`: workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised setup and future training runs.
- `metrics/`: time-based learning logs for launch-state trends, score movement, and queue-decision hindsight.
- `reports/`: full audit, roadmap, dispatch tracking, and report intake area.
  - `reports/external-lane-closeouts/`: closeout reports written by execution agents for Catalog Agent review.

## Authority

These artifacts support training, traceability, and execution planning. They do not override canonical repo rules, system docs, ADRs, SOPs, user instructions, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/system-catalog-agent/README.md`
- Repo-visible memory: `docs/agents/system-catalog-agent/memory.md`
- Systems catalog: `docs/systems/catalog.md`
- Rating rubric: `docs/systems/rating-rubric.md`
- Operator map: `docs/operator-map.md`

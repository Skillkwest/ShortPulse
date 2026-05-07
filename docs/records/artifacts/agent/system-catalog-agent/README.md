# System Catalog Agent Artifacts

Purpose: store non-authoritative retained artifacts for the System Catalog Agent's catalog stewardship, audit history, and production-readiness handoff generation.

## Status

System Catalog Agent is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, and an initial artifact area. It is ready to begin recurring catalog audit and handoff work.

## Artifact Layout

- `memory.md`: non-authoritative working memory retained with artifacts.
- `sops.md`: workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised setup and future training runs.
- `reports/`: full audit, roadmap, and handoff packets.

## Authority

These artifacts support training, traceability, and execution planning. They do not override canonical repo rules, system docs, ADRs, SOPs, user instructions, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/system-catalog-agent/README.md`
- Repo-visible memory: `docs/agents/system-catalog-agent/memory.md`
- Systems catalog: `docs/systems/catalog.md`
- Rating rubric: `docs/systems/rating-rubric.md`
- Operator map: `docs/operator-map.md`

# Abismia Agent Artifacts

Purpose: store non-authoritative retained artifacts for Abismia's UI/UX stewardship, intended runtime behavior reviews, training continuity, and helper tooling.

## Status

Abismia is currently at `Level 0: Initialized`.

The agent now has a durable contract, local instruction overlay, repo-visible memory, standing SOP, temporary workspace, retained artifact area, training-history ledger, run log, training-data namespace, and tools inventory.

## Artifact Layout

- `training-history.md`: supervised setup history and future training runs.
- `run-log.md`: append-only ledger of substantive Abismia runs.
- `tools.md`: helper inventory and future tooling needs.
- `reports/`: dated UI/UX audit reports, runtime-behavior reviews, and retained summaries when a run needs durable detail.
- `training-data/`: sanitized examples, labeled lessons, and future training packets that improve Abismia's work over time.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, user instructions, current code, current docs, ADRs, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/abismia/README.md`
- Agent instructions: `docs/agents/abismia/AGENTS.md`
- Repo-visible memory: `docs/agents/abismia/memory.md`
- Standing SOP: `docs/agents/abismia/standard-operating-procedure.md`
- Temporary workspace: `docs/agents/abismia/workspace/`

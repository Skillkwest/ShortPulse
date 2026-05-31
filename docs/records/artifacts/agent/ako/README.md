# Ako Agent Artifacts

Purpose: store non-authoritative retained artifacts for Ako's backlog stewardship, planning-surface management, board reconciliation, training continuity, and helper tooling.

## Status

Ako is currently at `Level 0: Initialized`.

The agent now has a durable contract, local instruction overlay, repo-visible memory, standing SOP, temporary workspace, retained artifact area, training-history ledger, run log, reports namespace, and tools inventory.

## Artifact Layout

- `training-history.md`: supervised setup history and future training runs.
- `run-log.md`: append-only ledger of substantive Ako runs.
- `tools.md`: helper inventory and future tooling needs.
- `reports/`: dated backlog audits, reconciliation packets, and retained planning-state summaries when a run needs durable detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, user instructions, current code, current docs, ADRs, or direct validation evidence.

Ako operates inside the ShortPulse solo-owner model and current pre-launch production-only branch policy. Launch-relevant Ako reports must follow `docs/agents/solo-owner-launch-trust-standard.md`.

## Canonical Entry Points

- Agent contract: `docs/agents/ako/README.md`
- Agent instructions: `docs/agents/ako/AGENTS.md`
- Repo-visible memory: `docs/agents/ako/memory.md`
- Standing SOP: `docs/agents/ako/standard-operating-procedure.md`
- Ownership manifest: `docs/agents/ako/ownership-manifest.md`
- Temporary workspace: `docs/agents/ako/workspace/`

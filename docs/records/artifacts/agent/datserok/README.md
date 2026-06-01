# Datserok Agent Artifacts

Purpose: store non-authoritative retained artifacts for Datserok's project persistence stewardship, training continuity, reports, and helper tooling.

## Artifact Layout

- `training-history.md`: supervised setup history and future training runs.
- `run-log.md`: append-only ledger of substantive Datserok runs.
- `tools.md`: helper inventory and future tooling needs.
- `reports/`: dated project-persistence audits, source-of-truth packets, and retained investigation summaries when a run needs durable detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, user instructions, current code, current docs, ADRs, or direct validation evidence.

Datserok operates inside the ShortPulse solo-owner model and current pre-launch production-only branch policy. Launch-relevant Datserok reports must follow `docs/agents/solo-owner-launch-trust-standard.md`.

## Canonical Entry Points

- Agent contract: `docs/agents/datserok/README.md`
- Agent instructions: `docs/agents/datserok/AGENTS.md`
- Repo-visible memory: `docs/agents/datserok/memory.md`
- Standing SOP: `docs/agents/datserok/standard-operating-procedure.md`
- Ownership manifest: `docs/agents/datserok/ownership-manifest.md`
- Source map: `docs/agents/datserok/project-persistence-source-map.md`
- Temporary workspace: `docs/agents/datserok/workspace/`

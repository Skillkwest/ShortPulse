# Bactuo Agent Artifacts

Purpose: store non-authoritative retained artifacts for Bactuo's generation, recovery, and settlement stewardship, training continuity, reports, and helper tooling.

## Artifact Layout

- `training-history.md`: supervised setup history and future training runs.
- `run-log.md`: append-only ledger of substantive Bactuo runs.
- `tools.md`: helper inventory and future tooling needs.
- `reports/`: dated generation audits, architecture packets, and retained investigation summaries when a run needs durable detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, user instructions, current code, current docs, ADRs, or direct validation evidence.

These artifacts are retained history, not active scratch space. Temporary notes, throwaway checklists, and live investigation drafts belong in `docs/agents/bactuo/workspace/` instead.

Bactuo operates inside the ShortPulse solo-owner model and current pre-launch production-only branch policy. Launch-relevant Bactuo reports must follow `docs/agents/solo-owner-launch-trust-standard.md`.

## Default Entry Points

- Agent contract: `docs/agents/bactuo/README.md`
- Agent instructions: `docs/agents/bactuo/AGENTS.md`
- Repo-visible memory: `docs/agents/bactuo/memory.md`
- Standing SOP: `docs/agents/bactuo/standard-operating-procedure.md`
- Source map: `docs/agents/bactuo/generation-recovery-settlement-source-map.md`

## Conditional Entry Points

- Ownership manifest: `docs/agents/bactuo/ownership-manifest.md`
- Architecture plan: `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md`
- Temporary workspace: `docs/agents/bactuo/workspace/`

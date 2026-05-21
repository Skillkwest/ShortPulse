# Codex Local Instructions

Scope: `ShortPulse/docs/agents/codex/`.

Inherit the root [AGENTS.md](../../../AGENTS.md) first, then apply these local rules.

## Purpose

This folder is the durable local operating space for the current Codex assistant in this repo.

Use it for:

- assistant-specific instruction deltas
- lean repo-visible memory
- retained self-training history and artifact governance

## Rules

- Keep this folder intentionally small.
- Prefer updating root `AGENTS.md` when a rule is truly repo-global.
- Do not duplicate other agents' contracts, SOPs, or prompt libraries here.
- Do not add self-SOPs, KPI files, report indexes, or extra helper docs unless repeated real use proves they are necessary.
- Treat [README.md](./README.md) as the local contract and [memory.md](./memory.md) as the only default-load memory surface in this folder.
- Treat [docs/records/artifacts/agent/codex/](../../records/artifacts/agent/codex/) as the retained artifact area for self-training continuity.

## Default Load

For Codex-local self-governance work, load:

- [README.md](./README.md)
- [memory.md](./memory.md)

Load retained artifacts only when the task is specifically about self-audit, self-correction, or training continuity.

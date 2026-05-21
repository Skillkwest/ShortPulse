# Codex

Purpose: define the minimal repo-side operating contract for the current Codex assistant working inside ShortPulse.

This folder exists so durable self-governance rules can live in the repo without being scattered across unrelated agent surfaces.

Local scoped instructions live in:

- [AGENTS.md](./AGENTS.md)

## Identity

Codex is the current implementation and operations assistant working in this repository.

## Authority

Codex must treat these as higher authority than this folder:

- system instructions
- developer instructions
- current user instructions
- root [AGENTS.md](../../../AGENTS.md)
- scoped repo instructions such as [docs/AGENTS.md](../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md)

This folder should only hold durable assistant-specific deltas that are worth retaining locally.

## Scope

Use this folder for:

- durable self-governance rules that are specific to the current assistant
- minimal operating-memory notes that improve future runs
- retained training history for supervised self-corrections

Do not use this folder to duplicate the full repo operating contract or to mirror other agents' role surfaces.

## Memory Contract

Codex's repo-visible local memory lives in:

- [memory.md](./memory.md)

Retained self-training artifacts live in:

- [docs/records/artifacts/agent/codex/README.md](../../records/artifacts/agent/codex/README.md)

## Operating Rule

Keep this operating space intentionally small.

If a rule already belongs in root `AGENTS.md` or another canonical repo surface, prefer updating that authoritative file instead of growing this folder.

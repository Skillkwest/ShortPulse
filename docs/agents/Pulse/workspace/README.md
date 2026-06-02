# Pulse Workspace

Purpose: owned workspace folder for Pulse's temporary Standard-mode and Pulse-mode agent behavior materials.

## Scope

Use this folder for Pulse-owned temporary drafts, handoff packets, notes, and working materials that support the owned agent lanes without turning scratch work into source of truth.

## Guardrails

- This folder is not the source of truth for Standard-mode behavior, Pulse-mode behavior, route contracts, persistence rules, or runtime isolation policy.
- Durable contract and memory live under `docs/agents/Pulse/`.
- Pulse's scoped startup overlay, SOP, and ownership manifest live under `docs/agents/Pulse/`.
- Durable retained artifacts live under `docs/records/artifacts/agent/Pulse/`.
- Do not place secrets, provider keys, service-role keys, raw user-private data, or production credentials in this folder.
- Review temporary material here, extract only reusable lessons into the documented memory or retained artifact surfaces, then remove temporary inputs when they are no longer needed.

## Layout

- `dropbox/`: controlled handoff area for files the user explicitly wants Pulse to review or process.
- `drafts/`: temporary working notes, packets, and implementation prep material for Standard/Pulse agent behavior work.

## Canonical Entry Points

- Agent contract: `docs/agents/Pulse/README.md`
- Local instructions: `docs/agents/Pulse/AGENTS.md`
- Standing SOP: `docs/agents/Pulse/standard-operating-procedure.md`
- Ownership manifest: `docs/agents/Pulse/ownership-manifest.md`
- Repo-visible memory: `docs/agents/Pulse/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/Pulse/`

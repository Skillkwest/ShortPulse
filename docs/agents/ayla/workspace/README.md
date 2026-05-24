# Ayla Workspace

Purpose: owned workspace folder for Ayla, Kirk's primary AI personal assistant for ShortPulse.

## Scope

Use this folder for Ayla-owned working drafts, intake packets, and temporary support materials that should stay separate from the main product code and docs.

## Guardrails

- This folder is not the source of truth for product behavior, auth policy, billing policy, or support decisions.
- Durable agent identity, memory, and contract details live under `docs/agents/ayla/`.
- Durable retained artifacts live under `docs/records/artifacts/agent/ayla/`.
- Do not place secrets, exported customer data, or production credentials in this folder.
- This workspace is not Ayla's durable memory home.
- Review files here, extract only sanitized durable lessons into the documented memory or retained artifact surfaces, then remove temporary inputs when they are no longer needed.

## Layout

- `dropbox/`: controlled handoff area for files the user explicitly wants Ayla to review or process.
- `drafts/`: temporary working drafts for messages, support notes, and operational copy before anything durable is retained elsewhere.

## Canonical Entry Points

- Agent contract: `docs/agents/ayla/README.md`
- Repo-visible memory: `docs/agents/ayla/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/ayla/`

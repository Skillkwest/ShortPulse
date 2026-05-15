# Ayal Workspace

Purpose: owned workspace folder for Ayal, the ShortPulse user account manager and customer service steward.

## Scope

Use this folder for Ayal-owned working drafts, intake packets, and customer-service support materials that should stay separate from the main product code and docs.

## Guardrails

- This folder is not the source of truth for product behavior, auth policy, billing policy, or support decisions.
- Durable agent identity, memory, and contract details live under `docs/agents/ayal/`.
- Durable retained artifacts live under `docs/records/artifacts/agent/ayal/`.
- Do not place secrets, exported customer data, or production credentials in this folder.

## Layout

- `dropbox/`: controlled handoff area for files the user explicitly wants Ayal to review or process.

## Canonical Entry Points

- Agent contract: `docs/agents/ayal/README.md`
- Repo-visible memory: `docs/agents/ayal/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/ayal/`

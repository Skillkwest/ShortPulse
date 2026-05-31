# Ako Workspace

Purpose: owned workspace folder for Ako's temporary backlog packets, board intake, and working drafts.

## Scope

Use this folder for Ako-owned temporary materials that should stay separate from canonical planning docs and retained training artifacts.

## Guardrails

- This folder is not the source of truth for backlog state or planning policy.
- Durable contract, instructions, SOP, and memory live under `docs/agents/ako/`.
- Durable retained artifacts live under `docs/records/artifacts/agent/ako/`.
- Do not place secrets, production credentials, or raw user-private data in this folder.
- Review temporary material here, extract only the reusable lesson into documented memory or retained artifacts, then clear stale inputs when they are no longer needed.

## Layout

- `dropbox/`: controlled handoff area for files or packets the user explicitly wants Ako to review.
- `drafts/`: temporary reconciliation notes, backlog rewrite drafts, and board cleanup working copy.

## Canonical Entry Points

- Agent contract: `docs/agents/ako/README.md`
- Agent instructions: `docs/agents/ako/AGENTS.md`
- Repo-visible memory: `docs/agents/ako/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/ako/`

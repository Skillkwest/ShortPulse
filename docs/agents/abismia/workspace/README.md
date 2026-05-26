# Abismia Workspace

Purpose: owned workspace folder for Abismia's temporary UI/UX drafts, intake files, and working notes.

## Scope

Use this folder for Abismia-owned temporary materials that should stay separate from canonical product code, docs, and retained training artifacts.

## Guardrails

- This folder is not the source of truth for product behavior or UI policy.
- Durable contract, instructions, SOP, and memory live under `docs/agents/abismia/`.
- Durable retained artifacts live under `docs/records/artifacts/agent/abismia/`.
- Do not place secrets, production credentials, or raw user-private data in this folder.
- Review temporary material here, extract only the reusable lesson into the documented memory or artifact surfaces, then clear the temporary input when it is no longer needed.

## Layout

- `dropbox/`: controlled handoff area for files the user explicitly wants Abismia to review.
- `drafts/`: temporary UX notes, interaction sketches, and working copy before anything durable is retained elsewhere.

## Canonical Entry Points

- Agent contract: `docs/agents/abismia/README.md`
- Agent instructions: `docs/agents/abismia/AGENTS.md`
- Repo-visible memory: `docs/agents/abismia/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/abismia/`

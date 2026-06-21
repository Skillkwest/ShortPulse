# Austerity Workspace

Purpose: owned workspace folder for Austerity legal-policy intake, drafts, review notes, and handoff material that should stay separate from product code and canonical docs.

## Scope

Use this folder for:

- active legal-policy drafts;
- user-provided policy inputs;
- counsel-review question lists before they are retained as reports;
- temporary source ledgers;
- and handoff material for Terms, Privacy Policy, Refund Policy, cancellation, media rights, AI content terms, and related customer-policy work.

## Guardrails

- This folder is not final public policy.
- Durable agent identity, memory, and SOPs live under `docs/agents/austerity/`.
- Durable retained artifacts live under `docs/agents/austerity/artifacts/`.
- Do not store raw secrets, payment details, customer-private exports, unredacted legal correspondence, privileged material, or confidential counsel advice unless the user explicitly directs safe retention.
- Label draft material as draft.
- Promote durable, sanitized lessons to Austerity memory or retained reports instead of letting scratch notes become source of truth.

## Layout

- `dropbox/`: controlled handoff area for files the user explicitly wants Austerity to review or process.
- `drafts/`: temporary working drafts before approval, implementation, or retained report creation.

## Canonical Entry Points

- Agent contract: `docs/agents/austerity/README.md`
- Local instructions: `docs/agents/austerity/AGENTS.md`
- Repo-visible memory: `docs/agents/austerity/memory.md`
- Standing SOP: `docs/agents/austerity/standard-operating-procedure.md`
- Surface map: `docs/agents/austerity/legal-policy-surface-map.md`
- Tool inventory: `docs/agents/austerity/tools/README.md`
- Retained artifacts: `docs/agents/austerity/artifacts/`

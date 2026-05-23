# Dave The Security Guy Workspace

Purpose: owned workspace folder for Dave the Security Guy, the ShortPulse security steward for app, account, Supabase, Vercel, secret, and environment-security work.

## Scope

Use this folder for Dave-owned intake packets, sanitized security review drafts, temporary notes, and handoff materials that should stay separate from product code and canonical docs.

## Guardrails

- This folder is not the source of truth for product behavior, auth policy, deployment policy, RLS, or incident response.
- Durable agent identity, memory, and contract details live under `docs/agents/dave-the-security-guy/`.
- Durable retained artifacts live under `docs/records/artifacts/agent/dave-the-security-guy/`.
- Do not place secrets, tokens, exported customer data, raw production logs, `.env` values, screenshots containing credentials, or service-role keys in this folder.
- Review files here, extract only sanitized durable lessons into Dave's documented memory or retained artifacts, then remove temporary inputs when they are no longer needed.

## Layout

- `dropbox/`: controlled handoff area for files the user explicitly wants Dave to review or process.
- `drafts/`: temporary working drafts for sanitized security notes before anything durable is retained elsewhere.

## Canonical Entry Points

- Agent contract: `docs/agents/dave-the-security-guy/README.md`
- Local instructions: `docs/agents/dave-the-security-guy/AGENTS.md`
- Repo-visible memory: `docs/agents/dave-the-security-guy/memory.md`
- Standing SOP: `docs/agents/dave-the-security-guy/standard-operating-procedure.md`
- Security ownership map: `docs/agents/dave-the-security-guy/security-ownership-map.md`
- Retained artifacts: `docs/records/artifacts/agent/dave-the-security-guy/`

# Dave The Security Guy Workspace Instructions

Scope: `dave-the-security-guy/`

This is Dave's local working area for security intake, sanitized drafts, and handoff material. It is not canonical product, security, deployment, Supabase, Vercel, or incident-response policy.

## Authority

Inherit the root `AGENTS.md` first, then the canonical Dave contract at `docs/agents/dave-the-security-guy/AGENTS.md`.

Canonical Dave references live under:

- `docs/agents/dave-the-security-guy/`
- `docs/records/artifacts/agent/dave-the-security-guy/`
- `docs/security-checklist.md`
- `docs/deployment.md`
- `docs/supabase_auth_setup.md`

## Workspace Rules

- Do not store raw secrets, bearer tokens, Supabase storage-state files, `.env` values, service-role keys, customer-private exports, or unredacted production logs here.
- Use `dropbox/` only for user-provided security material that Dave is explicitly asked to inspect.
- Use `drafts/` only for temporary sanitized working notes.
- Promote durable, sanitized lessons to Dave memory or retained reports instead of letting scratch notes become source of truth.
- Delete temporary scratch material when it is no longer needed.
- If any file here contains secret-like material, stop and run the secret-exposure response workflow before continuing.

## Validation

Before retaining or staging Dave workspace files, run a targeted secret check over:

- `dave-the-security-guy/`
- `docs/agents/dave-the-security-guy/`
- `docs/records/artifacts/agent/dave-the-security-guy/`

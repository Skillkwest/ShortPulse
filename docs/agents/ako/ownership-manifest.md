# Ako Ownership Manifest

Purpose: define exactly which repo surfaces Ako owns directly, which shared surfaces Ako may reconcile when authorized, and which adjacent lanes stay outside Ako ownership.

## Directly Owned By Ako

Ako owns these local operating surfaces:

- `docs/agents/ako/README.md`
- `docs/agents/ako/AGENTS.md`
- `docs/agents/ako/memory.md`
- `docs/agents/ako/standard-operating-procedure.md`
- `docs/agents/ako/ownership-manifest.md`
- `docs/agents/ako/workspace/`
- `docs/records/artifacts/agent/ako/README.md`
- `docs/records/artifacts/agent/ako/training-history.md`
- `docs/records/artifacts/agent/ako/run-log.md`
- `docs/records/artifacts/agent/ako/tools.md`
- `docs/records/artifacts/agent/ako/reports/`

## Product And Planning Surfaces Ako May Modify When Asked

Ako may modify these shared surfaces only for backlog stewardship, planning truth, or user-authorized board reconciliation:

- `docs/planning/backlog.md`
- `docs/planning/execution-authority.md`
- `docs/planning/README.md`
- explicitly authorized external board cards or lists
- focused docs indexes when Ako adds or relocates Ako-owned surfaces
- planning references that the user explicitly asks Ako to reconcile

## Shared But Not Ako-Owned

These surfaces may inform Ako's conclusions but are not Ako-owned:

- implementation code, tests, and runtime behavior;
- Copperknot readiness scores, launch prioritization, and handoff queue authority;
- Gear Ball branch, commit, push, release, and GitHub execution authority;
- Nuclo environment, Vercel, Supabase topology, and production URL authority;
- Dave security, privacy, auth, secrets, and RLS/storage security authority;
- Money Stuff billing, credits, entitlement, Stripe, and payment-readiness authority;
- specialist product lanes such as media ingestion, media display, Create/Pulse runtime, UI/UX, and debugging.

## Handoff Owners

- Copperknot: readiness scoring, priority queue changes, and ship-floor interpretation.
- Gear Ball: branch posture, staging, commits, pushes, and release execution.
- Nuclo: environment topology, Vercel, Supabase project mapping, and production URL posture.
- Dave the Security Guy: security, privacy, auth, secrets, and RLS/storage risks.
- Relevant product-lane owner: implementation work behind a backlog item.

## Move Rule

Move a file into Ako space only when all of the following are true:

1. it defines Ako behavior, memory, retained training, tools, reports, or temporary board/backlog working drafts;
2. it is not shared product/runtime code;
3. it is not owned by another agent contract;
4. keeping it outside Ako would create ambiguity about the backlog-management operating package.

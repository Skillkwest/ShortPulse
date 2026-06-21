# Nuclo Current Handoff

Status: none

Nuclo has no active handoff packet at this time.

## Intake Rule

New Nuclo work should enter through a fresh user request or a new handoff explicitly addressed to Nuclo.

## Default Startup

Load:

- `docs/agents/nuclo/README.md`
- `docs/agents/nuclo/memory.md`

Then load only task-specific environment, Vercel, Supabase, SQL, or deployment docs required by the current request.

Do not load previous handoffs, retained reports, training history, or workspace scratch unless the current request names them or the report index points to a single matching artifact.

For the active Supabase egress optimization lane, preserve the current goal in working context but load only:

- `docs/records/artifacts/agent/nuclo/reports/README.md`
- the relevant section of `docs/records/artifacts/agent/nuclo/reports/2026-06-20-supabase-egress-optimization-production-audit.md`

The current egress direction is PostgREST payload/cadence optimization, not default media/storage cleanup, unless refreshed dashboard proof changes that.

## Recently Archived

- `docs/agents/nuclo/previous-handoffs/2026-06-14-production-supabase-db-url-reliability-diagnostics.md`

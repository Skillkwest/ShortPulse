# Phase 4 Evidence: SQL Lint CI Bootstrap

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 4 (Guardrails + Governance)

## Scope
Remediate `sql_lint` enforce-trial failure by bootstrapping a local Supabase runtime in CI before running `supabase db lint --local`.

## Trigger
Run `22251008051` failed in job `sql_lint` with:
- `failed to connect to postgres ... 127.0.0.1:54322: connect: connection refused`

## Change
Updated `.github/workflows/ci.yml` `sql_lint` job:
1. Start local Supabase before lint:
   - `npx supabase start -x "<exclude-list>"`
2. Run lint after successful startup:
   - `npx supabase db lint --local --schema public --fail-on warning`
3. Always cleanup local containers:
   - `npx supabase stop --all --no-backup` (via trap on exit)
4. Keep existing warn/enforce policy behavior unchanged.

## Notes
1. Exclude list intentionally keeps only postgres running to reduce CI startup overhead.
2. `SQL_LINT_MODE` remains `warn` pending re-promotion and two post-promotion green cycles.

## Next Verification
1. `SQL_LINT_MODE` was re-promoted to `enforce` on 2026-02-21.
2. First post-repromotion validation run succeeded: `22258656706`.
3. Record one additional consecutive green `ci.yml` run after re-promotion.

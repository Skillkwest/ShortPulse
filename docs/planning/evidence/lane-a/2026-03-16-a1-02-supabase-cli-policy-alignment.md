# Lane A Evidence Packet: A1-02 Supabase CLI Policy Alignment

date_utc: 2026-03-16  
slice_id: A1-02  
lane: A  
phase: A1  
owner: Engineering

## Scope
1. Remove Docker-local Supabase SQL lint instructions from governed workflow/template/script/docs surfaces.
2. Align SQL lint instructions to hosted-target Supabase CLI patterns (`--db-url` / `--linked`).
3. Preserve warn/enforce mode behavior and no runtime product behavior changes.

## Files Updated
1. `.github/workflows/ci.yml`
2. `.github/pull_request_template.md`
3. `scripts/run_repo_sweep.sh`
4. `docs/planning/ci-policy-checks.md`

## Commands Run
1. `bash -n scripts/run_repo_sweep.sh`
2. `npm -C frontend run docs:check`
3. `rg -n "supabase (start|stop|db reset --local|db lint --local)|docker" scripts/run_repo_sweep.sh .github/workflows/ci.yml .github/pull_request_template.md docs/planning/ci-policy-checks.md`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `bash -n scripts/run_repo_sweep.sh` | 0 | pass |
| `docs:check` | 0 | pass |
| `rg ...` scoped drift scan | 1 | no matches (expected) |

## Baseline Or Delta Notes
1. SQL lint in CI now uses hosted-target pinning via `SUPABASE_DB_URL` (secret/var fallback).
2. Warn/enforce behavior is retained: missing DB URL warns/skips in warn mode and fails in enforce mode.
3. Local sweep SQL lint step now requires `SUPABASE_DB_URL` when `RUN_SQL_LINT=1`.
4. PR template and CI policy doc now reference hosted-target commands; Docker-local instructions removed from scoped governance surfaces.

## Rollback Note
1. Revert this slice commit to restore prior local-Docker SQL lint wording/behavior if policy direction changes.
2. Keep rollback scoped to governance tooling; no runtime app contracts are involved.

## Linked Plan Artifacts
1. `docs/planning/lane-a-master-plan-2026-03-16.md`
2. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

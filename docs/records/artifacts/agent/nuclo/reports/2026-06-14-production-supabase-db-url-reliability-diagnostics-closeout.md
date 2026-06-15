# 2026-06-14 Production Supabase DB URL Reliability Diagnostics Closeout

Status: partial / blocked on convergence defects
Owner: Nuclo
Environment: production only
Production URL: `https://www.shortpulse.ai`
Production Supabase project: `ftgrqgjrchpimronuhop`
GitHub workflow: Reliability Control-Plane Diagnostics
GitHub run: `27522410789`
GitHub run URL: `https://github.com/sleepyseamonster/ShortPulse/actions/runs/27522410789`
Git branch/ref: `production`
Commit SHA: `fe3b56d414b380d93f14913f15580885e2f2b20d`
Evidence time: 2026-06-15T03:35Z UTC

## Claim

Nuclo resolved the GitHub Actions database-connectivity blocker for production hosted SQL diagnostics.

The async generation convergence proof boundary is not launch-safe yet. The hosted production SQL bundle now executes, but `sql/check_generation_convergence_defect_classes.sql` returned nonzero convergence defect classes that require a runtime/data repair owner before this handoff can close as pass.

## Environment Secret Work

Before repair:

- `gh secret list --env production --repo sleepyseamonster/ShortPulse` showed `SUPABASE_DB_URL` existed with `updatedAt=2026-05-09T19:01:22Z`.
- The handoff artifacts and prior run output showed the secret pointed at a Supabase `db.ftgrqgjrchpimronuhop.supabase.co` target that GitHub Actions could not reach because it resolved IPv6-only from the hosted runner.

Source used for the replacement target:

- Supabase Dashboard production project `ftgrqgjrchpimronuhop`
- `Connect` -> `Direct Connection string` -> `Session pooler`
- Dashboard-confirmed non-secret shape:
  - host: `aws-1-us-west-2.pooler.supabase.com`
  - port: `5432`
  - user: `postgres.ftgrqgjrchpimronuhop`
  - database: `postgres`

Validation before mutation:

- Local non-secret URL-shape check confirmed the target was a Supavisor session pooler shape, not the direct `db.*` host.
- Local read-only `psql` connectivity check to the session pooler succeeded using the existing production DB password without printing the password.
- DNS for `aws-1-us-west-2.pooler.supabase.com` returned IPv4 A records.

Mutation performed:

- Updated GitHub Environment `production` secret `SUPABASE_DB_URL` through `gh secret set` via stdin.
- No raw DB URL or password was printed, committed, or written to tracked files.
- Post-update `gh secret list --env production --repo sleepyseamonster/ShortPulse` showed `SUPABASE_DB_URL` with `updatedAt=2026-06-15T03:35:03Z`.

Important local hygiene note:

- Local `.env.agent.local` contained `SHORTPULSE_PRODUCTION_POOLER_URL`, but that value was stale/misleading: its non-secret shape still pointed at `db.ftgrqgjrchpimronuhop.supabase.co:6543` with user `postgres`.
- That local convenience variable was not used as the source of truth for the GitHub secret update.

## Hosted Workflow Evidence

Dispatched:

```bash
gh workflow run reliability-control-plane-diagnostics.yml \
  --repo sleepyseamonster/ShortPulse \
  --ref production \
  -f target_environment=production \
  -f mode=warn
```

Run result:

- Run ID: `27522410789`
- Status: completed
- Conclusion: success
- Created: `2026-06-15T03:35:12Z`
- Updated: `2026-06-15T03:35:51Z`
- Workflow log reported: `[reliability-diagnostics] Using IPv4 hostaddr for hosted DB connectivity.`

Artifacts inspected from:

```text
/tmp/reliability-diagnostics-prod-27522410789/reliability-control-plane-diagnostics-27522410789/
```

Artifact files present:

- `reliability_control_plane_diagnostics.log`
- `reliability_control_plane_diagnostics/combined.log`
- `reliability_control_plane_diagnostics/check_control_plane_scheduler_health.log`
- `reliability_control_plane_diagnostics/check_pg_net_failure_taxonomy.log`
- `reliability_control_plane_diagnostics/check_generation_queue_dispatch_latency.log`
- `reliability_control_plane_diagnostics/check_generation_recovery_media_visible_latency.log`
- `reliability_control_plane_diagnostics/check_generation_convergence_defect_classes.log`
- `reliability_control_plane_diagnostics/check_runtime_sql_security_audit.log`
- `reliability_control_plane_diagnostics/check_generation_settlement_integrity.log`
- `reliability_control_plane_diagnostics/check_control_plane_enforce_gate.log`

SQL files confirmed executed:

- `sql/check_control_plane_scheduler_health.sql`
- `sql/check_pg_net_failure_taxonomy.sql`
- `sql/check_generation_queue_dispatch_latency.sql`
- `sql/check_generation_recovery_media_visible_latency.sql`
- `sql/check_generation_convergence_defect_classes.sql`
- `sql/check_runtime_sql_security_audit.sql`
- `sql/check_generation_settlement_integrity.sql`
- `sql/check_control_plane_enforce_gate.sql`

## SQL Results

### Scheduler And Pg Net

`check_control_plane_scheduler_health.sql`:

- `scheduler_alive = true`
- `shortpulse_generation_recovery_every_minute`: active, schedule `* * * * *`, 360/360 succeeded in 6h, 0 failed
- `shortpulse_media_derivatives_every_minute`: active, schedule `* * * * *`, 360/360 succeeded in 6h, 0 failed
- `shortpulse_admin_user_health_fleet_hourly`: active, schedule `0 * * * *`, 6/6 succeeded in 6h, 0 failed
- Scheduler function contract parity: all checked functions returned `contract_status = ok`

`check_pg_net_failure_taxonomy.sql`:

- `pending_http_request_count = 0`
- failure taxonomy rows: 0
- retained response span: `2026-06-14 21:36:00Z` to `2026-06-15 03:35:00Z`
- retained response rows: 732

### Latency Diagnostics

`check_generation_queue_dispatch_latency.sql`:

- 0 rows in the checked dispatch-latency windows.

`check_generation_recovery_media_visible_latency.sql`:

- 0 rows in the checked recovery/media-visible latency windows.

Interpretation:

- The workflow cannot prove recent async recovery latency because there were no rows in those windows.
- This is not a failure by itself, but it means latency proof remains sparse for this run.

### Convergence Defect Classes

`check_generation_convergence_defect_classes.sql` metric rows:

```text
success_with_outputs_total                            2076
outputs_without_publications                          0
partial_publication_coverage                          0
published_without_projection                          4
terminal_success_outputs_missing_projection           4
published_with_nonterminal_projection                 0
terminal_observation_with_nonterminal_projection      0
project_metadata_missing_projection_project_scope     124
project_projection_missing_generation_association     0
project_owned_media_missing_project_media_association 1
ignored_missing_generation_observations               0
ignored_other_observations                            0
failed_observations                                   0
```

Detail output returned 125 rows.

Interpretation:

- Core publication coverage is good for `outputs_without_publications = 0` and `partial_publication_coverage = 0`.
- There are no failed or ignored observation backlog rows in this check.
- The proof boundary is blocked by nonzero project/projection/media association defects:
  - 124 successful outputs carry project metadata but lack projection project scope.
  - 1 project-owned media row is missing the project-media association.
  - 4 terminal successful outputs are missing projection rows and also appear as `published_without_projection`.
- These defects are not a GitHub/Supabase environment wiring issue. They belong to the runtime convergence/data-repair lane, likely Gear Ball/Codex or the generation recovery owner.

### Runtime SQL Security

`check_runtime_sql_security_audit.sql`:

```text
total_checks   353
passing_checks 353
failing_checks 0
```

Interpretation:

- Production runtime SQL security posture passed for the checked RPC/grant/canary set.

### Settlement Integrity

`check_generation_settlement_integrity.sql`:

```text
released_success_total             0
non_waived_released_success_total  0
missing_charge_count               0
duplicate_charge_key_count         0
```

Interpretation:

- No released-success settlement leakage was found by this diagnostic.

### Control-Plane Enforce Gate

`check_control_plane_enforce_gate.sql`:

- 8 checks inserted.
- All 8 checks passed.
- `failing_check_count = 0`.

Passed checks:

- `no_recent_unauthorized_pg_net_401`
- `no_stalled_scheduler_runs`
- `required_jobs_registered_active_schedule`
- `runtime_sql_security_audit`
- `scheduler_alive`
- `scheduler_failure_thresholds_6h`
- `scheduler_function_contract_parity`
- `settlement_integrity`

## Decision

Environment decision:

- Pass. The GitHub Environment `production` `SUPABASE_DB_URL` blocker is resolved and the hosted reliability diagnostics workflow can execute production SQL through an IPv4-compatible session pooler.

Async generation convergence decision:

- Blocked / not launch-safe yet. Production SQL found nonzero convergence defect classes that prevent this run from proving completed async generations always converge into durable account/project media surfaces after user return.

## Remaining Unknowns And Owners

- Nuclo: no remaining DB-connectivity blocker for this workflow after the secret update.
- Gear Ball/Codex or the generation recovery owner: investigate and repair the nonzero convergence defect classes, especially `project_metadata_missing_projection_project_scope`, `terminal_success_outputs_missing_projection`, and `project_owned_media_missing_project_media_association`.
- After repair: rerun `reliability-control-plane-diagnostics.yml` on `production` in `warn` mode and require the full SQL bundle to execute again.

## Next Proof

The smallest useful next proof is:

1. Repair or explain the 125 detailed convergence rows without exposing private prompts/media.
2. Rerun production reliability diagnostics.
3. Treat the async convergence proof boundary as pass only if terminal/project/media convergence defects are zero, or if every nonzero row has a bounded explanation and owner accepted by the correct lane.

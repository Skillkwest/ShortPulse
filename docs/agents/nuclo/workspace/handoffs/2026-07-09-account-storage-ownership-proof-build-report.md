# Nuclo Build Report: Account Storage Ownership Proof System

Date: 2026-07-09
Repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Branch: `production`
Lane: proof-only inactive-account media/storage ownership diagnostics
Prepared for: Nuclo

## Executive Summary

A proof-only system was built to classify account/storage ownership status before any future inactive-user media review.

The system is intentionally non-destructive:

- No deletion method.
- No Storage API remove path.
- No cleanup queue.
- No scheduler.
- No UI exposure.
- No deletion recommendation.
- No production apply, deploy, commit, or push was performed.

The system can report:

- active/protected accounts,
- inactive-looking accounts,
- deleted Auth rows,
- storage prefixes with no matching Auth row.

It cannot authorize deletion.

Final inactive-user data deletion remains fully manual and outside this system.

## Why This Was Needed

The prior media storage lifecycle lane identified that cleanup candidates can still belong to active users. That makes any storage deletion unsafe unless account ownership and activity are proven first.

The user set a hard boundary:

- Plan and build only the proof system for inactive users.
- Do not plan or build the method for deleting inactive-user data.
- Final inactive-user data deletion will be manual and human-controlled.
- The system must never accidentally delete active user data.

This build creates the missing proof/status layer so Nuclo can run aggregate checks and produce safer review evidence without touching data.

## Implementation Files

New files:

- `sql/migrations/219_add_account_storage_ownership_proof.sql`
- `sql/migrations/rollback/219_add_account_storage_ownership_proof_rollback.sql`
- `sql/check_account_storage_ownership_proof.sql`
- `frontend/scripts/account_storage_ownership_proof.mjs`
- `frontend/tests/sql/account-storage-ownership-proof.test.ts`
- `frontend/tests/scripts/account-storage-ownership-proof.test.ts`
- `docs/agents/nuclo/workspace/handoffs/2026-07-09-account-storage-ownership-proof-operations-manual.md`
- `docs/agents/nuclo/workspace/handoffs/2026-07-09-account-storage-ownership-proof-build-report.md`

Updated files:

- `frontend/package.json`
- `sql/check_runtime_sql_security_audit.sql`
- `frontend/tests/lib/runtime-sql-security-audit-script.test.ts`
- `docs/adr/0098-media-storage-lifecycle-stewardship.md`
- `docs/security-checklist.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/database-migrations.md`
- `docs/data-dictionary.md`

## Database Migration

Migration:

- `sql/migrations/219_add_account_storage_ownership_proof.sql`

Rollback:

- `sql/migrations/rollback/219_add_account_storage_ownership_proof_rollback.sql`

### New RPC: Summary

Function:

```sql
public.get_account_storage_ownership_proof_summary(p_inactive_days integer default 180)
```

Returns aggregate rows:

- `owner_state`
- `activity_status`
- `proof_status`
- `proof_reason`
- `user_count`
- `storage_prefix_count`
- `storage_object_count`
- `storage_total_mb`
- `users_with_open_or_grace_contracts`
- `users_with_active_credit_reservations`
- `users_with_recent_activity`
- `oldest_last_activity_at`
- `newest_last_activity_at`
- `inactive_days`

Security:

- `SECURITY DEFINER`
- `search_path = public, storage, auth, pg_temp`
- execute revoked from `public`, `anon`, and `authenticated`
- execute granted only to `service_role`

Intended use:

- Default aggregate report.
- Safe to summarize in retained operator artifacts if redacted and aggregate-only.

### New RPC: Details

Function:

```sql
public.get_account_storage_ownership_proof_details(
    p_inactive_days integer default 180,
    p_user_id uuid default null,
    p_limit integer default 500
)
```

Returns row-level proof:

- user id and email,
- owner/activity/proof statuses,
- proof reason,
- Auth timestamps,
- last activity timestamps,
- billing/reservation blockers,
- media/project/custom-voice/storage counts,
- aggregate storage MB.

Security:

- `SECURITY DEFINER`
- `search_path = public, storage, auth, pg_temp`
- execute revoked from `public`, `anon`, and `authenticated`
- execute granted only to `service_role`

Intended use:

- Local service-role manual review.
- Specific-user investigation.
- Bounded operator proof queue when explicitly approved.

Not intended for:

- browser payloads,
- admin UI exposure,
- customer support exports,
- tracked raw reports,
- deletion decisions by itself.

## Classification Model

### Owner State

`auth_user_present`

- Matching `auth.users` row exists.
- `deleted_at` is null.

`auth_user_deleted`

- Matching `auth.users` row exists.
- `deleted_at` is set.

`no_auth_user_row`

- Storage prefix exists under a valid UUID first path segment.
- No matching `auth.users` row exists.

### Activity Status

`recent_activity`

- At least one tracked activity timestamp is inside the inactivity window.

`no_recent_activity`

- Tracked activity exists but is older than the inactivity window.

`no_activity_recorded`

- No tracked activity timestamp exists.

`deleted_auth_user`

- Auth user is marked deleted.

`owner_unknown`

- Storage prefix has no matching Auth row.

### Proof Status

`active_user_report_only`

- User exists and is not deleted.
- Recent activity exists, or billing/reservation blockers exist.
- This is protected/report-only.

`inactive_user_report_only`

- User exists and is not deleted.
- No tracked recent activity inside the inactivity window.
- No active/trialing/past_due current contract.
- No active reserved credit hold.
- This is inactive-looking/report-only.

`deleted_auth_report_only`

- Auth user is marked deleted.
- Still report-only.

`owner_missing_manual_review`

- Storage prefix has no matching Auth row.
- Manual review required.

## Proof Signals Used

The proof function reads:

- `auth.users`
- `storage.objects`
- `public.ai_generations`
- `public.ai_credit_ledger`
- `public.ai_credit_reservations`
- `public.media_files`
- `public.projects`
- `public.project_workspace_states`
- `public.user_owned_custom_voices`
- `public.voice_source_lifecycle`
- `public.billing_subscription_contracts`

Important protective blockers:

- Current billing contract with `ended_at is null` and status in:
  - `active`
  - `trialing`
  - `past_due`
- Active credit reservation where status is:
  - `reserved`
- Any tracked recent activity inside the configured inactivity window.

## Operator Runner

Script:

- `frontend/scripts/account_storage_ownership_proof.mjs`

Package command:

```bash
npm -C frontend run media:account-storage-proof -- --inactive-days 180
```

Supported options:

- `--inactive-days <n>`
- `--psql-path <path>`
- `--help`

Refused options:

- `--apply`
- `--delete`
- `--cleanup`
- `--remove`

The script:

- loads ignored local env files,
- finds a DB URL from `SUPABASE_DB_URL`, `DATABASE_URL`, or `SHORTPULSE_PRODUCTION_DB_URL`,
- infers the Supabase project id from the DB URL,
- optionally compares it to `NEXT_PUBLIC_SUPABASE_URL`,
- runs `sql/check_account_storage_ownership_proof.sql` through `psql`,
- passes the DB URL through `PGDATABASE` rather than as a positional command argument,
- prints a JSON wrapper with aggregate report output.

## Aggregate SQL Report

File:

- `sql/check_account_storage_ownership_proof.sql`

Behavior:

- Calls `get_account_storage_ownership_proof_summary(:inactive_days::integer)`.
- Prints aggregate group rows.
- Prints proof-status totals.
- Does not call the detail RPC.
- Does not print user ids.
- Does not print emails.
- Does not print storage paths.
- Does not print signed URLs.

## Runtime Security Audit Integration

Updated:

- `sql/check_runtime_sql_security_audit.sql`
- `frontend/tests/lib/runtime-sql-security-audit-script.test.ts`

Added expected signatures:

- `public.get_account_storage_ownership_proof_details(integer,uuid,integer)`
- `public.get_account_storage_ownership_proof_summary(integer)`

Also aligned the test with the already-present expected function:

- `public.get_admin_growth_cohorts_v1()`

Reason:

- The SQL audit already tracked `get_admin_growth_cohorts_v1()`, but the test list was stale. Focused validation exposed the drift and the test was updated to match the current audit source.

## Documentation Updates

Updated:

- `docs/adr/0098-media-storage-lifecycle-stewardship.md`
  - Adds the principle that inactive-account proof is separate from deletion.
- `docs/security-checklist.md`
  - Adds the inactive-account storage proof boundary.
- `docs/sops/sop_sql_migration_operations.md`
  - Adds migration and operator report entries.
- `docs/database-migrations.md`
  - Adds migration `219` to the required set and narrative notes.
- `docs/data-dictionary.md`
  - Adds the proof RPC contract, signals, statuses, and boundary.

## Validation Completed

Focused tests:

```bash
npm run test -- tests/sql/account-storage-ownership-proof.test.ts tests/scripts/account-storage-ownership-proof.test.ts tests/lib/runtime-sql-security-audit-script.test.ts
```

Result:

- Passed.
- 3 test files.
- 9 tests.

Docs:

```bash
npm run docs:check
```

Result:

- Passed.
- Documentation checks passed.
- Semantic drift checks passed.
- Migration/doc parity checks passed.
- Archive manifest checks passed.
- Model catalog parity checks passed.
- Naming canonical drift checks passed.
- Operator map drift check passed.

Script syntax:

```bash
node --check frontend/scripts/account_storage_ownership_proof.mjs
```

Result:

- Passed.

Runner help:

```bash
node frontend/scripts/account_storage_ownership_proof.mjs --help
```

Result:

- Passed.
- Help output confirms report-only boundary.

Diff check:

```bash
git diff --check -- <touched proof-lane files>
```

Result:

- Passed.

Destructive-token scan:

- No destructive implementation tokens found in the migration, report SQL, or runner.
- Test files contain destructive tokens only as negative assertions.

## Validation Blocked Or Not Run

`npm run type-check:touched` was run and failed because of unrelated dirty admin-storage work in:

- `frontend/pages/api/admin/storage-economics.ts`

Errors included missing names:

- `buildAccountHealth`
- `loadLifecycleHealth`
- `buildTrend`
- `buildEvidenceRows`

These failures are outside this proof lane. This build did not edit that file.

Hosted validation was not run:

- Migration `219` was not applied to production.
- Runtime SQL audit was not executed against production after migration.
- Aggregate proof report was not run against production after migration.

Those are Nuclo follow-up steps only after explicit environment/apply approval.

## How Nuclo Should Use This

Read first:

- `docs/agents/nuclo/workspace/handoffs/2026-07-09-account-storage-ownership-proof-operations-manual.md`

Then:

1. Confirm branch and environment.
2. Confirm whether migration `219` is applied in the target DB.
3. If not applied, stop unless the user explicitly approves hosted SQL apply.
4. After apply, run `sql/check_runtime_sql_security_audit.sql`.
5. Run:

   ```bash
   npm -C frontend run media:account-storage-proof -- --inactive-days 180
   ```

6. Review aggregate statuses only.
7. Investigate large `owner_missing_manual_review` or surprising `inactive_user_report_only` groups.
8. Do not proceed into deletion planning.

## Production Apply Boundary

This build did not apply production SQL.

Nuclo may apply migration `219` only when the current thread explicitly approves production SQL apply.

Before production apply, Nuclo must name:

- target Supabase project ref,
- target environment,
- SQL file,
- rollback file,
- validation commands,
- proof output policy,
- stop condition.

After production apply, Nuclo must run:

- runtime SQL security audit,
- aggregate proof report,
- docs/proof summary with no secrets and no row-level identity data unless explicitly approved.

## Deletion Boundary

This system must not be extended by momentum into deletion.

Do not add:

- `storage.from(...).remove(...)`,
- direct SQL deletion from `storage.objects`,
- `delete from` user-owned tables,
- cleanup queues,
- automatic account retirement,
- cron jobs,
- UI buttons that imply delete approval,
- deletion recommendations in the report.

If a future human asks what to do with `inactive_user_report_only` rows, the correct answer is:

> This proof system can identify inactive-looking accounts for human review. It does not decide or perform deletion. A separate manual policy and human-reviewed runbook is required before any user data removal.

## Known Risks

1. False inactive classification is possible if real activity happens outside the current proof signals.
   - Mitigation: treat output as report-only; add canonical proof signals if a gap is discovered.

2. Missing Auth row does not prove safe orphaned storage.
   - Mitigation: `owner_missing_manual_review` stays manual-review only.

3. Row-level detail contains sensitive identity evidence.
   - Mitigation: default runner uses aggregate summary only.

4. Hosted schema may lag repo migration.
   - Mitigation: verify migration apply and runtime SQL audit before relying on output.

5. Dirty unrelated admin-storage work currently blocks `type-check:touched`.
   - Mitigation: separate that lane before claiming full repo validation.

## Definition Of Done For This Build

Completed:

- proof-only SQL/RPC layer,
- rollback,
- aggregate report SQL,
- local report runner,
- package command,
- runtime SQL security audit integration,
- focused guardrail tests,
- canonical docs updates,
- Nuclo operations manual and build report.

Not completed by design:

- production SQL apply,
- hosted proof run,
- scheduler,
- UI,
- deletion flow,
- cleanup queue,
- manual deletion policy.

## Exact Safe Next Step

If the user wants Nuclo to operate this system in production, the next safe prompt should authorize only:

> Apply migration `sql/migrations/219_add_account_storage_ownership_proof.sql` to production Supabase, run the runtime SQL security audit, run the aggregate account storage ownership proof report for 180 days, and return a redacted aggregate summary only. Do not run row-level detail and do not delete anything.

Nuclo should stop after the redacted aggregate summary unless the user gives a new explicit instruction.

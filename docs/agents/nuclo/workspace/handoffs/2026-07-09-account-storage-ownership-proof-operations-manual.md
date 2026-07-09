# Nuclo Operations Manual: Account Storage Ownership Proof

Date: 2026-07-09
Repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Branch policy: pre-launch `production` only
Primary lane: Nuclo / Supabase hosted SQL and storage proof
Boundary: proof/status diagnostics only; no deletion authority

## Purpose

This manual explains how to operate the inactive-account media/storage ownership proof system added by migration `219_add_account_storage_ownership_proof.sql`.

The system answers one narrow question:

> Which accounts or storage prefixes have evidence of active ownership, inactive-looking ownership, deleted Auth state, or missing owner proof?

It does not answer:

> Which user data should be deleted?

Final inactive-user data deletion remains a separate manual human decision outside this system.

## Source Of Truth

Canonical repo sources:

- `sql/migrations/219_add_account_storage_ownership_proof.sql`
- `sql/migrations/rollback/219_add_account_storage_ownership_proof_rollback.sql`
- `sql/check_account_storage_ownership_proof.sql`
- `frontend/scripts/account_storage_ownership_proof.mjs`
- `frontend/package.json` script `media:account-storage-proof`
- `sql/check_runtime_sql_security_audit.sql`
- `docs/adr/0098-media-storage-lifecycle-stewardship.md`
- `docs/security-checklist.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/database-migrations.md`
- `docs/data-dictionary.md`

This Nuclo workspace manual is an operating handoff. It is not higher authority than the canonical files above.

## What Was Built

Migration `219` adds two `SECURITY DEFINER` RPCs:

1. `public.get_account_storage_ownership_proof_summary(p_inactive_days integer default 180)`
   - Aggregate-only report.
   - Returns counts and storage totals grouped by owner/activity/proof status.
   - Does not return user ids, emails, object paths, signed URLs, or deletion instructions.
   - This is the default operator reporting surface.

2. `public.get_account_storage_ownership_proof_details(p_inactive_days integer default 180, p_user_id uuid default null, p_limit integer default 500)`
   - Row-level local operator proof.
   - May return user ids, emails, timestamps, counts, and storage totals.
   - Must stay service-role-only and local/operator-only.
   - Must not be exposed to browser/customer payloads or pasted into public reports.

Both RPCs:

- are `SECURITY DEFINER`,
- use explicit `search_path = public, storage, auth, pg_temp`,
- revoke execute from `public`, `anon`, and `authenticated`,
- grant execute only to `service_role`,
- do not write rows,
- do not delete rows,
- do not call Supabase Storage deletion,
- do not create a cleanup queue,
- do not create a scheduler.

## Proof Signals

The detail RPC builds a per-subject proof row from these sources:

- `auth.users`
  - Auth row existence.
  - Deleted state via `deleted_at`.
  - Sign-in/account timestamps.
- `storage.objects`
  - Private `media_library` objects grouped by valid UUID first path segment.
  - Used to find storage prefixes even when no matching Auth row exists.
  - Object paths are not returned by the summary report.
- `public.ai_generations`
  - Recent generation activity.
- `public.ai_credit_ledger`
  - Recent credit activity.
- `public.ai_credit_reservations`
  - Active `reserved` holds block inactive classification.
- `public.media_files`
  - Durable media activity and media row count.
- `public.projects`
  - Project activity and project count.
- `public.project_workspace_states`
  - AI Studio workspace activity.
- `public.user_owned_custom_voices`
  - Custom voice ownership/activity and count.
- `public.voice_source_lifecycle`
  - Voice-source lifecycle activity.
- `public.billing_subscription_contracts`
  - Current/open/grace billing blocker evidence.
  - Statuses `active`, `trialing`, and `past_due` with `ended_at is null` are treated as active/protected blockers.

The system intentionally errs toward protection. Any recent activity, open/grace billing contract, or active credit reservation returns an active/report-only status.

## Proof Statuses

### `active_user_report_only`

Meaning:

- The auth user exists and is not deleted, and at least one active/protective signal exists.

Common reasons:

- Recent activity inside the inactivity window.
- Current `active`, `trialing`, or `past_due` billing contract.
- Active `reserved` credit reservation.

Operator posture:

- Treat as active/protected.
- Do not include in inactive-user review.
- Do not delete user media.

### `inactive_user_report_only`

Meaning:

- Auth user exists and is not deleted.
- No tracked activity appears inside the inactivity window.
- No current active/trialing/past_due billing contract.
- No active reserved credit hold.

Operator posture:

- This is an inactive-looking proof classification only.
- It is not deletion approval.
- It can be used to prepare a human review queue after additional policy approval.

### `deleted_auth_report_only`

Meaning:

- An `auth.users` row exists and has `deleted_at` set.

Operator posture:

- Still report-only.
- Deleted Auth state alone is not cleanup authorization.
- Manual reconciliation is required before any user-data action.

### `owner_missing_manual_review`

Meaning:

- A valid UUID storage prefix exists in `storage.objects`.
- No matching `auth.users` row exists.

Operator posture:

- Manual review required.
- Do not assume orphaned equals safe.
- Storage can still relate to historical migration state, deleted-account remnants, imported data, or repair drift.

## Inactivity Window

The operator passes an inactivity window in days.

Default:

- `180`

Database clamp:

- minimum `30`
- maximum `3650`

Recommended starting posture:

- Use `180` days for normal review.
- Re-run with a longer window, such as `365`, only to compare sensitivity.
- Never use a short window as deletion justification.

Example:

```bash
npm -C frontend run media:account-storage-proof -- --inactive-days 180
```

## Prerequisites

Before running against any hosted database, Nuclo must confirm:

1. Current branch is `production`.

   ```bash
   git branch --show-current
   git config --local --get shortpulse.allowedBranch
   ```

2. Target environment is explicit.

   Required notes:
   - environment name: local, staging, or production
   - Supabase project ref
   - database URL source
   - whether migration `219` has already been applied

3. `psql` is available.

   Check:

   ```bash
   psql --version
   ```

   If the default `psql` is unavailable on macOS and Homebrew is available, install or use libpq:

   ```bash
   brew install libpq
   npm -C frontend run media:account-storage-proof -- --psql-path /opt/homebrew/opt/libpq/bin/psql
   ```

4. Database credentials are available through an ignored local environment file or current shell environment.

   Supported variable names:
   - `SUPABASE_DB_URL`
   - `DATABASE_URL`
   - `SHORTPULSE_PRODUCTION_DB_URL`

   Do not paste secrets into tracked docs, shell history examples, chat, or reports.

5. Migration `219` is present in the repo checkout.

   ```bash
   test -f sql/migrations/219_add_account_storage_ownership_proof.sql
   test -f sql/check_account_storage_ownership_proof.sql
   test -f frontend/scripts/account_storage_ownership_proof.mjs
   ```

## Applying The Migration

Applying migration `219` to a hosted environment is a separate action from running the report.

Nuclo must not apply it to production without explicit user approval for production SQL apply in the current thread.

When apply is approved, use the repo SQL migration SOP:

- `docs/sops/sop_sql_migration_operations.md`
- `docs/sops/sop_nuclo_supabase_migration_apply_and_validation.md` if hosted Nuclo apply is in scope

Preferred hosted apply shape:

- explicitly target the environment,
- apply `sql/migrations/219_add_account_storage_ownership_proof.sql`,
- do not rely on implicit linked project targeting,
- run runtime SQL security audit after apply,
- run the aggregate proof report after apply.

Do not:

- use Docker Supabase workflows,
- run `supabase db reset`,
- run direct destructive SQL,
- modify storage objects,
- enable a scheduler,
- wire a browser/admin UI payload unless a separate plan approves it.

## Verifying The Migration Exists

After apply, verify the functions exist and are locked to `service_role`.

Recommended SQL audit:

```bash
PGDATABASE="$SUPABASE_DB_URL" PGSSLMODE=require psql -v ON_ERROR_STOP=1 -f sql/check_runtime_sql_security_audit.sql
```

If using the local runner env file rather than shell variables, run the report script first and then use the same target credentials with a safe environment-based `psql` invocation.

Expected posture:

- `public.get_account_storage_ownership_proof_details(integer,uuid,integer)` exists.
- `public.get_account_storage_ownership_proof_summary(integer)` exists.
- Both are `SECURITY DEFINER`.
- Both are executable by `service_role`.
- Neither is executable by `public`, `anon`, or `authenticated`.

If any of those checks fail, stop. Do not run account review based on a partially applied proof system.

## Running The Aggregate Report

From repo root:

```bash
npm -C frontend run media:account-storage-proof -- --inactive-days 180
```

With explicit `psql` path:

```bash
npm -C frontend run media:account-storage-proof -- --inactive-days 180 --psql-path /opt/homebrew/opt/libpq/bin/psql
```

The runner:

1. Loads ignored local env files:
   - `.env.agent.local`
   - `frontend/.env.local`
   - `.env.local`
2. Reads one of:
   - `SUPABASE_DB_URL`
   - `DATABASE_URL`
   - `SHORTPULSE_PRODUCTION_DB_URL`
3. Infers the Supabase project id from the DB URL.
4. Compares it to `NEXT_PUBLIC_SUPABASE_URL` when available.
5. Runs `psql` with:
   - `PGDATABASE=<database-url>`
   - `PGSSLMODE=require`
   - SQL file `sql/check_account_storage_ownership_proof.sql`
6. Prints a JSON wrapper with:
   - mode,
   - report boundary,
   - inactivity days,
   - inferred project ids,
   - SQL file path,
   - raw aggregate table output from `psql`.

The database URL is passed through the child-process environment instead of as a positional `psql` command argument.

## What The Report Prints

The default SQL report prints two aggregate sections.

### Section 1: Owner/Activity/Proof Summary

Columns:

- `owner_state`
- `activity_status`
- `proof_status`
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

Use this section to understand the shape of the storage footprint.

### Section 2: Proof Status Totals

Columns:

- `proof_status`
- `proof_group_count`
- `user_count`
- `storage_prefix_count`
- `storage_object_count`
- `storage_total_mb`

Use this section for executive/operator summary.

Example interpretation:

- Many `active_user_report_only` rows means most storage belongs to currently protected accounts.
- Any `owner_missing_manual_review` storage requires owner reconciliation before even considering lifecycle cleanup.
- `inactive_user_report_only` means inactive-looking by current proof signals, not safe-to-delete.
- `deleted_auth_report_only` means Auth deletion state exists, but data cleanup remains manual and separate.

## Row-Level Detail Usage

The default runner does not print row-level detail.

If Nuclo needs row-level proof for a specific manual review and has explicit approval to inspect local service-role evidence, run a direct SQL query in a controlled terminal.

Example for one known user id:

```sql
select *
from public.get_account_storage_ownership_proof_details(180, '<user-id>'::uuid, 1);
```

Example for a bounded local review queue:

```sql
select
    user_id,
    user_email,
    owner_state,
    activity_status,
    proof_status,
    proof_reason,
    last_activity_at,
    open_or_grace_contract_count,
    active_credit_reservation_count,
    media_file_count,
    project_count,
    custom_voice_count,
    storage_object_count,
    storage_total_mb
from public.get_account_storage_ownership_proof_details(180, null, 100)
where proof_status in ('inactive_user_report_only', 'owner_missing_manual_review', 'deleted_auth_report_only')
order by storage_total_mb desc;
```

Do not paste row-level user ids, emails, storage-derived evidence, or raw outputs into chat or tracked docs unless the user explicitly asks for a redacted retained artifact.

## Safety Guardrails

The runner refuses these flags:

- `--apply`
- `--delete`
- `--cleanup`
- `--remove`

The SQL report:

- does not call `get_account_storage_ownership_proof_details(...)`,
- does not return user ids,
- does not return emails,
- does not return object paths,
- does not return signed URLs.

The migration:

- does not contain `delete from`,
- does not contain `truncate`,
- does not create a queue,
- does not modify `storage.objects`,
- does not use Supabase image transformations,
- does not change customer quota semantics.

## Failure Modes And What To Do

### `psql` Not Found

Symptom:

- runner fails with command-not-found or spawn error.

Action:

- Install or locate `psql`.
- On macOS Homebrew systems, use:

```bash
brew install libpq
npm -C frontend run media:account-storage-proof -- --psql-path /opt/homebrew/opt/libpq/bin/psql
```

### Missing Database URL

Symptom:

- runner says it cannot find `SUPABASE_DB_URL`, `DATABASE_URL`, or `SHORTPULSE_PRODUCTION_DB_URL`.

Action:

- Put the target DB URL in an ignored local env file or export it in the shell.
- Do not create tracked temp env files.
- Do not paste the value into docs or chat.

### Function Missing

Symptom:

- SQL error says `get_account_storage_ownership_proof_summary` does not exist.

Action:

- Confirm migration `219` has been applied to the target database.
- Do not assume the repo file means hosted schema is current.
- If hosted apply is needed, stop until user approval exists for that environment.

### Permission Denied

Symptom:

- `permission denied for function ...`

Action:

- Confirm the DB URL is using a service-role-capable database identity.
- Run `sql/check_runtime_sql_security_audit.sql`.
- If grants drifted, repair from migration `219` only after environment and apply approval are clear.

### Unexpected Active Users In Inactive Bucket

Symptom:

- A known active customer appears as `inactive_user_report_only`.

Action:

- Stop and audit the missing signal.
- Check whether the activity source is outside the current proof list.
- Do not work around by manually overriding the report.
- Consider adding a new canonical proof signal in a future migration if the activity source is legitimate.

### Large `owner_missing_manual_review`

Symptom:

- Significant storage under valid UUID prefixes has no matching Auth row.

Action:

- Treat as owner reconciliation work, not cleanup.
- Compare migration/import history, account deletion history, and storage object provenance.
- Do not delete based on missing Auth row alone.

## Recommended Operating Cadence

This is currently manual.

Recommended cadence before launch or during storage pressure review:

1. Run aggregate proof at `180` days.
2. Save only redacted aggregate results if a retained report is needed.
3. Investigate any large `owner_missing_manual_review` total.
4. Investigate whether any `inactive_user_report_only` accounts are false negatives.
5. Do not proceed into deletion planning from this report alone.

Do not schedule this as cron until a separate Nuclo plan approves:

- target environment,
- output destination,
- redaction policy,
- alert thresholds,
- owner,
- retention policy for reports.

## Validation Commands For Future Changes

When modifying this proof system, run:

```bash
npm -C frontend run test -- tests/sql/account-storage-ownership-proof.test.ts tests/scripts/account-storage-ownership-proof.test.ts tests/lib/runtime-sql-security-audit-script.test.ts
npm -C frontend run docs:check
node --check frontend/scripts/account_storage_ownership_proof.mjs
git diff --check -- sql/migrations/219_add_account_storage_ownership_proof.sql sql/check_account_storage_ownership_proof.sql frontend/scripts/account_storage_ownership_proof.mjs frontend/tests/sql/account-storage-ownership-proof.test.ts frontend/tests/scripts/account-storage-ownership-proof.test.ts
```

If broader checks fail in unrelated dirty work, separate that clearly from this proof lane.

## Absolute Stop Boundaries

Stop immediately before:

- deleting storage objects,
- deleting Auth users,
- deleting user-owned application rows,
- creating a cleanup queue,
- scheduling automatic account/media cleanup,
- exposing row-level proof in browser/admin UI,
- pasting raw user ids, emails, storage paths, signed URLs, or secrets into tracked docs,
- applying production SQL without explicit current-thread approval,
- treating `inactive_user_report_only` as deletion permission.

The intended endpoint for Nuclo is a decision-grade proof report, not data removal.

# Troubleshooting

## Provider or webhook outages
For Fal/OpenAI/Stripe incident triage, use `docs/sops/sop_provider_incident_response.md`.

For AI Studio Fal polling, client status timeouts are intentionally higher than server status-route budgets.
If regressions reappear, check `app_error_logs` for `source='client.api_network'` with abort-like messages on `/api/fal/*-status` endpoints.

## Admin runtime/API error handoff workflow
Use the `/admin` Errors panel `Copy triage` buttons as the default handoff format.

Checklist:
- Prefer triage packets over manually copying full JSON rows.
- Include fresh events first (match `occurredAt` to current test run to avoid historical duplicates).
- If triage packet fields are insufficient for root cause, then include the raw `metadata` block from Event Detail as a second step.

## `next build` / `next lint` prompts to “configure ESLint”
This happens when the repo has `eslint-config-next` installed but no ESLint config file exists.

Fix: ensure `frontend/eslint.config.mjs` is present and valid (flat ESLint config in this repo).

## Supabase auth redirects not working
Checklist:
- `frontend/.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- You’re signed in and the session is persisted (see `frontend/lib/supabaseClient.ts`).
- Protected routes redirect to `/auth` when session is missing (see `frontend/lib/authGuard.ts`).

## Media Library operations fail (upload/list/delete)
Checklist:
- The `media_library` bucket is private and policies require user-scoped paths.
- RLS is enabled for `media_files` and policies enforce `user_id = auth.uid()`.
- You ran the bootstrap scripts in `sql/` (including `sql/create_media_library_tables.sql`) or `docs/supabase_full_schema.sql`.

## Private tab data looks wrong or empty
Checklist:
- Run `sql/migrations/003_add_private_media_source.sql`.
- Run `sql/migrations/004_add_private_media_integrity_checks.sql`.
- Validate row classification:
  ```sql
  select source, count(*) as rows
  from media_files
  group by source
  order by source;
  ```
- Validate private integrity:
  ```sql
  select id, user_id, source, file_type, storage_path
  from media_files
  where (source = 'private_upload' and (lower(coalesce(file_type, '')) <> 'image' or storage_path not like user_id::text || '/private/images/%'))
     or (storage_path like user_id::text || '/private/images/%' and source <> 'private_upload')
  limit 50;
  ```

## Private tab cards show blank placeholders
Checklist:
- Run `sql/migrations/009_repair_legacy_media_storage_paths.sql`.
- Validate remaining non-user-scoped paths:
  ```sql
  select id, user_id, source, storage_path, created_at
  from media_files
  where source = 'private_upload'
    and coalesce(storage_path, '') <> ''
    and storage_path !~* '^https?://'
    and storage_path not like user_id::text || '/%'
  order by created_at desc
  limit 100;
  ```
- Validate storage object existence for unresolved rows:
  ```sql
  select
    mf.id,
    mf.storage_path,
    (obj.name is not null) as object_exists
  from media_files mf
  left join storage.objects obj
    on obj.bucket_id = 'media_library'
   and obj.name = mf.storage_path
  where mf.source = 'private_upload'
  order by mf.created_at desc
  limit 100;
  ```

## Media storage path scope drift
Symptoms:
- Media preview signing returns unexpected `null` URLs for rows that should be accessible.
- Security audits identify `media_files.storage_path` values outside `<user_id>/...`.
- Canonical run order/remediation loop: `docs/sops/sop_sql_migration_operations.md`.

Checklist:
- Ensure `sql/migrations/016_harden_media_storage_path_scope.sql` has been applied.
- Ensure `sql/migrations/017_harden_media_storage_path_shape.sql` has been applied.
- Run diagnostics by executing `sql/check_media_storage_scope_drift.sql`.
- All `mismatch_count` values should be `0`.

Mitigation:
- Run `sql/migrations/009_repair_legacy_media_storage_paths.sql` (safe to re-run).
- Re-run `sql/check_media_storage_scope_drift.sql`.
- If mismatches remain, inspect unresolved rows directly:
  ```sql
  select id, user_id, source, storage_path, created_at
  from media_files
  where (
      coalesce(storage_path, '') = ''
      or storage_path like '/%'
      or
      storage_path not like user_id::text || '/%'
      or storage_path ~ '(^|/)\.\.(/|$)'
      or position(chr(92) in storage_path) > 0
    )
  order by created_at desc
  limit 200;
  ```
- Record persistent mismatches in `docs/change_log.md` and escalate before release.

## Variant hints or derivative rows are missing
Checklist:
- Run `sql/migrations/005_add_media_processing_and_variants.sql`.
- Run `sql/migrations/006_backfill_media_variant_hints.sql`.
- Validate media processing status:
  ```sql
  select processing_status, count(*) as rows
  from media_files
  group by processing_status
  order by processing_status;
  ```
- Validate variant row coverage:
  ```sql
  select variant_kind, status, count(*) as rows
  from media_asset_variants
  group by variant_kind, status
  order by variant_kind, status;
  ```
- Validate rows still missing variant hints:
  ```sql
  select id, file_type, processing_status, thumb_variant_path, poster_variant_path, preview_variant_path
  from media_files
  where (lower(coalesce(file_type, '')) like 'image%' and thumb_variant_path is null)
     or (lower(coalesce(file_type, '')) like 'video%' and (poster_variant_path is null or preview_variant_path is null))
  limit 50;
  ```

## Media library or reference grid feels slow
Checklist:
- Open DevTools Console and clear existing telemetry:
  ```js
  window.__shortpulseMediaPerf?.clear();
  ```
- Reproduce the flow (open Media Library/Modal, scroll, load more, interact with Reference Grid).
- Inspect percentile timing summaries:
  ```js
  window.__shortpulseMediaPerf?.durationStats();
  ```
- Inspect sign-batch reliability by surface/tab/query mode:
  ```js
  window.__shortpulseMediaPerf?.signStats();
  ```
- Inspect render/long-task/memory telemetry for the reference grid:
  ```js
  window.__shortpulseMediaPerf?.snapshot().filter((entry) =>
    [
      "media.grid.render.commit",
      "media.grid.longtask.sample",
      "media.grid.memory.sample",
      "media.grid.archive.transition",
    ].includes(entry.event)
  );
  ```
- If `failed_ratio` is elevated or `p95_duration_ms` is high, verify:
  - `/api/media/sign-batch` returns `200` with a `urls` map for authenticated users,
  - signed URL requests are only for visible/buffered cards,
  - variant paths (`thumb_variant_path`, `poster_variant_path`, `preview_variant_path`) are populated,
  - device/network constraints are applying reduced sign/autoplay budgets.
- If Reference Grid interactions degrade in long sessions, verify:
  - soft archive is active (`NEXT_PUBLIC_REFERENCE_GRID_SOFT_ARCHIVE` not set to `false`),
  - adaptive preview routing is active (`NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW` not set to `false`),
  - active grid count stays near the configured cap (`NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT`, default `500`),
  - archived restore actions are available and returning cards without freezing the main grid.
- Run the automated gate harness when regressions are suspected:
  - on `/ai-studio` DevTools Console, run:
    `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
    `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
- If toolbar/panel/drop interactions lag once references accumulate, verify:
  - shell decoupling is enabled (`NEXT_PUBLIC_AI_STUDIO_SHELL_DECOUPLE` not set to `false`),
  - DnD backpressure is enabled (`NEXT_PUBLIC_AI_STUDIO_DND_BACKPRESSURE` not set to `false`),
  - panel memoization is enabled (`NEXT_PUBLIC_AI_STUDIO_PANEL_MEMOIZATION` not set to `false`),
  - high-density shell mode is enabled (`NEXT_PUBLIC_AI_STUDIO_HIGH_DENSITY_SHELL_MODE` not set to `false`).

## Character Manager alias drift (Character Sheet vs legacy Reference Pack fields)
Symptoms:
- Character Sheet slots appear assigned in one surface but missing in another.
- Character rows load with stale active sheet pointers after mixed-version deployments.

Checklist:
- Ensure `sql/migrations/012_add_character_sheet_aliases_and_compat.sql` has been applied.
- Run diagnostics by executing the SQL in `sql/check_character_sheet_alias_drift.sql`.
- All `mismatch_count` values should be `0`.

Mitigation:
- Re-run migration `012_add_character_sheet_aliases_and_compat.sql` (safe to re-run).
- Re-check drift report; if mismatches remain, inspect trigger health:
  - `trg_characters_sync_character_sheet_aliases`
  - `trg_character_reference_images_sync_character_sheet_aliases`
  - `trg_character_generation_jobs_sync_character_sheet_aliases`
- Record persistent mismatches in `docs/change_log.md` and escalate before removing legacy aliases.

## Prompt or AI Generation saves fail
Checklist:
- `media_prompts`, `ai_generations`, and `media_events` tables exist.
- RLS is enabled and policies enforce `user_id = auth.uid()` on those tables.
- The client is using the anon key only (no service-role key in the browser).

## Admin credit adjustments fail with missing ledger columns
Symptoms:
- Errors like `Could not find the 'created_by' column of 'ai_credit_ledger' in the schema cache`.
- Errors like `column "source" of relation "ai_credit_ledger" does not exist`.

Fix:
- Run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` in the Supabase SQL editor.
- Refresh Supabase table metadata (or reload the dashboard) and retry `/admin` credit adjustments.

## Admin Event Stream fails with `app_error_events` missing in schema cache
Symptoms:
- `/admin` Errors tab Event Stream shows messages like `Could not find the table 'public.app_error_events' in the schema cache`.
- `/api/admin/error-events` returns empty degraded health state or errors in legacy environments.

Fix:
- Run `sql/migrations/015_add_app_error_events.sql` in the Supabase SQL editor.
- Confirm relation availability:
  ```sql
  select to_regclass('public.app_error_logs') as app_error_logs_table,
         to_regclass('public.app_error_events') as app_error_events_table;
  ```
- Refresh Supabase schema cache/dashboard metadata and retry `/admin`.

## AI Studio generation fails with `Unable to process generation credits. Please retry.`
Symptoms:
- Fal submit routes fail before provider submit with the generic billing error above.
- Server logs may include SQL `42702` with `column reference "source_ref" is ambiguous`.

Cause:
- Environment is running an older `reserve_generation_credits`/reservation RPC definition (pre-fix for ambiguous output-column names).

Fix:
- Run `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`.
- Then run `sql/migrations/014_harden_generation_reservation_rpc_security.sql`.
- Refresh Supabase schema cache and retry generation.

Notes:
- The API now falls back to legacy direct-debit billing when reservation RPCs are stale/missing so generation can proceed.
- Applying `013` + `014` is still the durable fix to restore full reservation/capture/release behavior.

## Fal validation fails with `file_download_error` / `Failed to download the file`
Symptoms:
- Provider response includes validation detail on `image_urls` or motion video URL download failure.
- Local logs can include follow-on parser failures like `Fal Seedream result returned non-JSON response` with `405 Method Not Allowed`.

Cause:
- Most often, a Supabase signed reference URL expired between selection time and provider fetch time.
- It can also happen when the signed URL points to a moved/deleted object or a non-user-scoped legacy path.

Current behavior:
- AI Studio now applies a pre-submit signed URL freshness gate for image references and video reference URLs (including motion-control and Kling element video references).
- URLs nearing expiry are force-refreshed before submit; if refresh fails, submission stops early with a user-facing reselect message.

Checklist:
- Re-select failed image/video references and retry generation.
- Verify storage paths are user-scoped and valid (primary + variant paths) via `sql/check_media_storage_scope_drift.sql`.
- Confirm the target object still exists in `storage.objects` under `media_library`.
- If failures persist, capture request IDs plus provider `detail[]` payload and escalate via provider incident SOP.

## SQL role update fails with `column "app_metadata" does not exist`
Symptom:
- Query against `auth.users.app_metadata` fails with `ERROR: 42703`.

Cause:
- Supabase stores auth metadata in `raw_app_meta_data` and `raw_user_meta_data` columns.

Fix:
- Update `raw_app_meta_data` instead of `app_metadata` for admin roles.
- `raw_user_meta_data` is user-editable and is not used for admin authorization.
- Sign out and sign back in so fresh JWT claims include the new role before checking `/admin`.

## Billing migration fails with `ENABLE ROW SECURITY ... not supported for views`
Symptom:
- `ERROR: 42809: ALTER action ENABLE ROW SECURITY cannot be performed on relation "ai_credit_balance"`.

Cause:
- In some legacy deployments, `ai_credit_balance` is a view, not a table.

Fix:
- Re-run the latest `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` from this repo. The current script detects view vs table and skips incompatible RLS/trigger steps automatically.
- Validate relation type:
  ```sql
  select relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'ai_credit_balance';
  ```

## Signup fails with `Database error saving new user`
Symptom:
- Supabase Auth returns `Database error saving new user` during sign up.

Checklist:
- Run the latest `sql/migrate_new_user_plan_default_to_free.sql` to replace `handle_new_user_billing_setup()` with the hardened, fail-open version.
- Ensure billing bootstrap tables exist (`billing_profiles`, `billing_plans`, `ai_credit_ledger`).
- Ensure `app_error_logs` and `app_error_events` tables exist to capture trigger failures in the Admin Errors page.

Diagnostics:
```sql
select id, source, message, last_seen_at, occurrences_count, metadata
from app_error_logs
where source = 'db.trigger.handle_new_user_billing_setup'
order by last_seen_at desc
limit 20;
```

## AI Studio auto-save fails (CORS or fetch errors)
Checklist:
- The provider URL allows browser fetches (some providers block cross-origin downloads).
- If blocked, consider a Supabase Edge Function proxy (requires an ADR) or store metadata only.

## “It works in dev but not in build”
Checklist:
- Run `npm -C frontend run build` and fix type errors first.
- Watch for accidental Node-only usage in the client (e.g., `fs`, server-only env vars).

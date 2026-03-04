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
  - `/api/media/list` returns `200` for authenticated users when list API rollout is enabled,
  - `/api/media/sign-batch` returns `200` with a `urls` map for authenticated users,
  - signed URL requests are only for visible/buffered cards,
  - variant paths (`thumb_variant_path`, `poster_variant_path`, `preview_variant_path`) are populated,
  - device/network constraints are applying reduced sign/autoplay budgets.
- Inspect open-to-first-media attribution events:
  - `media.route.open_to_first_media`
  - `media.modal.open_to_first_media`
- If modal/route grids stutter at higher counts, verify rollout flags:
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIRTUALIZATION_ENABLED=true`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED=true`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED=true`
- If Reference Grid interactions degrade in long sessions, verify:
  - soft archive is active (`NEXT_PUBLIC_REFERENCE_GRID_SOFT_ARCHIVE` not set to `false`),
  - adaptive preview routing is active:
    - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW` not set to `false`
    - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY` not set to `false`
  - active grid count stays near the configured cap (`NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT`, default `500`),
  - optional heavy-load long-edge compaction is only enabled when intentionally set (`NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION=true`),
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

## Media Library modal flashes "Loading media library…" while scrolling
Symptoms:
- While loading the next page or stale-refreshing, cards disappear and the modal briefly shows a blocking loading message.

Checklist:
- Confirm modal stale-refresh path is non-blocking:
  - `frontend/features/ai-studio/components/MediaLibraryModal.tsx` should preserve rows during `stale_refresh`.
  - blocking copy should be gated by `showBlockingLoading` with zero active media rows.
- Confirm shared fetch transition is active:
  - `frontend/features/media-library/logic/mediaFetchTransition.ts` should return `preserveRowsDuringFetch=true` for `stale_refresh` with existing rows.
- Confirm controller parity:
  - `frontend/features/media-library/hooks/useMediaTabDataController.ts` should apply the same transition behavior as modal.
- Run focused tests:
  - `npm -C frontend run test -- MediaLibraryModal useMediaTabDataController`

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

## AI Studio autosave ON/OFF behavior looks wrong
Checklist:
- Ensure migration `sql/migrations/043_add_user_preferences_media_autosave_enabled.sql` is applied.
- Verify current user preference:
  ```sql
  select user_id, media_autosave_enabled, updated_at
  from user_preferences
  where user_id = auth.uid();
  ```

## AI Studio session persistence intentionally paused (hard-off baseline)
Checklist:
- Confirm these flags are set to `false` in the active frontend/server runtime when operating in rollback baseline:
  - `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED`
- Expected behavior in this baseline:
  - no session restore/switch UX,
  - no `/api/ai/sessions*` traffic during normal AI Studio usage,
  - workspace state remains runtime-local only.
- Reference-only rebuild runbook and plan:
  - `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
  - `docs/planning/ai-studio-session-persistence-reference-only-plan-2026-03-04.md`
  - `docs/planning/ai-studio-session-persistence-reference-only-tracker-2026-03-04.md`

## AI Studio session shadow persistence not syncing to server
Checklist:
- Ensure migration `sql/migrations/044_add_ai_studio_sessions_persistence.sql` is applied.
- Ensure ambiguity hotfix migration `sql/migrations/053_fix_ai_studio_session_upsert_ambiguity.sql` is applied.
- Ensure server route flag is enabled (or unset):
  - `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` must not be `false`.
- Ensure client remote-shadow flag is enabled for write-through shadow mode:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=true`.
- Verify authenticated `POST /api/ai/sessions/save` responses are `200` for active users.
- If `POST /api/ai/sessions/save` returns `500`, inspect API/server logs for SQLSTATE `42702` with
  `column reference "user_id" is ambiguous` from `upsert_ai_studio_session_snapshot`.
  This indicates the database function body is running pre-hotfix SQL and will fail every remote save.
- Note: local IndexedDB shadow remains active even when remote shadow is disabled/unavailable.
- Expected behavior:
  - `media_autosave_enabled = true`: eligible generated/uploaded/pasted media can auto-persist.
  - `media_autosave_enabled = false`: recovery path settles generation success but skips background `media_files` insert; manual save remains available.
- Verify recovery decision events:
  ```sql
  select event_type, entity_id, metadata, created_at
  from media_events
  where event_type = 'generation_autosave_decision'
  order by created_at desc
  limit 50;
  ```
- If autosave OFF still persists in recovery, confirm server runtime is on latest recovery executor code (`frontend/lib/server/falIntegration/recoveryExecution.ts`) and no stale deployment is serving older behavior.

## AI Studio session restore candidate does not appear
Checklist:
- Ensure `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED=true` in the frontend environment.
- Ensure `sid` is present and valid in URL (`/ai-studio?sid=<uuid>`).
- If remote restore candidate is expected, ensure `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` is not `false`.
- Verify authenticated `GET /api/ai/sessions/:sid` returns `200` (or `404` when not found).
- Inspect client breadcrumbs for `ai_studio_session_restore_candidate_loaded` to confirm source (`local` or `remote`).
- Note: this phase loads candidates only; hydration apply remains rollout-gated and is not auto-applied yet.

## AI Studio session snapshot is loaded but not applied to UI
Checklist:
- Ensure `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED=true`.
- Ensure restore-candidate loading is enabled:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED=true`.
- If agent transcript/input should also restore, ensure:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED` is not `false`.
- Verify candidate-load breadcrumb exists:
  - `ai_studio_session_restore_candidate_loaded`.
- Verify hydration-apply breadcrumb exists:
  - `ai_studio_session_hydration_applied`.
- If candidate breadcrumb exists but hydration breadcrumb does not, confirm current session `sid` has not already been hydrated in this page lifecycle and that snapshot payload includes expected workspace/output fields.
- When hydration apply is enabled, restored state includes agent transcript + composer input; attachment tray state is intentionally not restored.
- If hydration breadcrumb is present with `agent_hydration_applied=false`, workspace/output restore ran but transcript/input restore is intentionally staged off.

## AI Studio restored session shows placeholder reference cards
Checklist:
- Ensure `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED=true`.
- Verify restored outputs include canonical storage paths (`previewStoragePath`/`fullStoragePath`) in session snapshot payload.
- Verify signed URL batch succeeds for restore-time rehydration:
  - authenticated media sign route (`POST /api/media/sign-batch`) returns `200`,
  - returned `urls` map contains keys for restored storage paths.
- If placeholders persist, inspect client breadcrumbs for:
  - `ai_studio_session_restore_sign_batch_failed` (signed URL rehydration failed),
  - `ai_studio_session_restore_candidate_loaded` + `ai_studio_session_hydration_applied` (restore path executed).
- Confirm storage objects still exist for those paths in `media_library`; missing objects cannot be restored.

## AI Studio unsaved local references are missing after refresh/switch
Checklist:
- Unsaved local references (blob/data previews) now auto-upload to private user-scoped storage for session durability.
- This durability flow does **not** create `media_files` rows and does not auto-add items to Media Library tabs.
- If a local reference is still missing after refresh:
  - inspect client breadcrumbs for `ai_studio_session_reference_durability_upload_failed`,
  - verify `POST /api/upload-image` / `POST /api/upload-video` returned `200`,
  - confirm the local preview URL was still present (not removed/replaced) before upload completed.

## AI Studio Sessions modal cannot load recent sessions
Checklist:
- Ensure `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` is not `false`.
- Verify authenticated `GET /api/ai/sessions?limit=20` returns `200` with `{ sessions, nextCursor }`.
- Confirm the browser request includes a valid bearer token (same auth lane as `/api/ai/*` routes).
- If API returns `400`, validate query params:
  - `limit` must be between `1` and `50`.
  - `cursor` must be a valid base64url session cursor from a prior response.

## AI Studio session switch fails during save-and-switch
Checklist:
- Verify authenticated `POST /api/ai/sessions/save` returns `200` for the current `sid`.
- Confirm `snapshot` payload size is below route/RPC limit (current guard rejects oversized payloads).
- Ensure session save route is enabled:
  - `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` must not be `false`.
- If using remote shadow write-through expectations, ensure:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=true`.
  - (Local IndexedDB write-shadow still persists even when remote mirror is off.)

## AI Studio selected session shows unavailable/expired on switch
Checklist:
- Verify target session still exists via authenticated `GET /api/ai/sessions/:sid`.
- If `404`, the session was likely pruned by TTL/cap policy or never mirrored remotely for this user.
- Confirm target `sid` belongs to the authenticated user (user-scoped session ownership is enforced server-side).
- Re-open Sessions modal and refresh list; if missing from list, create a new session and continue from current workspace state.

## AI Studio safety behavior differs from expected mode
Checklist:
- Verify runtime safety profile mode:
  - `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (default `prod_safe_v1`).
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED=true` means runtime prefers control-plane active profile; set `false` for env-only fallback.
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` controls active-profile cache refresh cadence (bounded `1000..60000`, default `5000`).
- Verify development-only override:
  - `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` should remain `false` outside controlled development tests.
- Verify provider-error normalization mode:
  - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE=production_normalized` keeps user-lane errors normalized.
  - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE=development_verbatim` allows detailed hard-error payloads for debugging.
- Verify auto-rollback gate behavior:
  - `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED=true` enables policy-only rollback when production hard-floor incidents are detected.
  - `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` controls cooldown lock duration (bounded `1..168`, default `24`).
- If refusal rates suddenly change after profile/env updates, roll back to:
  - `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE=prod_safe_v1`
  - `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED=false`
  - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE=production_normalized`

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

## Beginner mode toggle is missing or expert mode is always on
Checklist:
- Verify `NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF` and `NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE` in `frontend/.env.local`.
- Precedence is strict: when `NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF=true`, beginner mode is forced OFF and toggle controls are hidden even if `NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE=true`.
- To temporarily restore UI controls without DB rollback, set:
  - `NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF=false`
  - `NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE=true`
- Remember the DB default after migration `049_enforce_expert_default_beginner_mode.sql` is `user_preferences.beginner_mode=false` for new rows.

## “It works in dev but not in build”
Checklist:
- Run `npm -C frontend run build` and fix type errors first.
- Watch for accidental Node-only usage in the client (e.g., `fs`, server-only env vars).

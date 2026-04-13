# Troubleshooting

## Provider or webhook outages
For Fal/OpenAI/Stripe incident triage, use `docs/sops/sop_provider_incident_response.md`.

For AI Studio Fal polling, client status timeouts are intentionally higher than server status-route budgets.
If regressions reappear, check `app_error_logs` for `source='client.api_network'` with abort-like messages on `/api/fal/*-status` endpoints.

## AI Studio reference upload returns `413`
Symptoms:
- AI Studio shows `Reference upload failed` and the detail mentions `413`, `file too large`, or `Reference image is too large`.
- Nano Banana / Nano Banana Pro rows fail before provider submit begins.

Checklist:
- AI Studio now auto-resizes local/blob/data reference images before upload when possible.
- Treat this as a reference-image upload size limit, not a model/reference token error.
- Confirm the reference image is under the 25 MB upload cap used by `POST /api/upload-image`.
- If the image came from a browser capture, preview export, or Trello attachment, re-export it at a smaller size or compress it before retrying.

Mitigation:
- Re-upload a smaller reference image and retry the generation.
- If the image is already small but still trips 413, capture the upload response and inspect `app_error_logs` for the `upload-image` route.

## Admin runtime/API error handoff workflow
Use the `/admin` Errors panel `Copy triage` buttons as the default handoff format.

Checklist:
- Prefer triage packets over manually copying full JSON rows.
- Include fresh events first (match `occurredAt` to current test run to avoid historical duplicates).
- If triage packet fields are insufficient for root cause, then include the raw `metadata` block from Event Detail as a second step.

## `next build` / `next lint` prompts to “configure ESLint”
This happens when the repo has `eslint-config-next` installed but no ESLint config file exists.

Fix: ensure `frontend/eslint.config.mjs` is present and valid (flat ESLint config in this repo).

## `next dev` lock error (`.next/dev/lock`)
Symptoms:
- `Unable to acquire lock .../.next/dev/lock`
- Port conflict messages (`Port 3000 is in use ... using 3001`) followed by lock failure.

Checklist:
- Ensure only one dev server is running.
- Do not run `npm run dev` in multiple terminals for the same repo.
- Verify active listener:
  ```bash
  lsof -nP -iTCP:3000 -sTCP:LISTEN
  ```

Mitigation:
- Stop duplicate Next dev processes, then start exactly one:
  ```bash
  cd frontend
  npm run dev
  ```

## Next image host not configured (`images.pexels.com`)
Symptoms:
- Runtime error:
  - `Invalid src prop (...) hostname "images.pexels.com" is not configured under images in your next.config.js`

Checklist:
- Confirm `frontend/next.config.js` `images.remotePatterns` includes `images.pexels.com`.
- Restart `npm run dev` after any `next.config.js` updates.

Mitigation:
- Add `images.pexels.com` to trusted image hosts in `frontend/next.config.js` and restart dev server.

## Media Library card previews hit `/_next/image` `500` with Supabase signed URLs
Symptoms:
- Browser console shows repeated `GET /_next/image?... 500 (Internal Server Error)` for Supabase signed media URLs.
- Media cards stall/flash while retries continue.

Checklist:
- Confirm media-library card images are rendered from signed URLs directly (not `/_next/image?...` wrappers).
- Confirm transformed signing profile headers are present:
  - `/api/media/sign-batch` -> `x-shortpulse-media-sign-preview-profile`
  - `/api/media/resolve-previews` -> `x-shortpulse-media-resolve-preview-profile`
- Confirm Adaptive V2 panel surfaces are enabled when expected:
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED=true`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` includes `media-library-grid` and/or `media-library-modal-grid`.

Mitigation:
- Keep media-library preview delivery on Supabase signed URLs (do not re-wrap signed URLs through Next image optimizer).
- Hard-refresh/re-open the media surface to clear stale wrapped preview state from older sessions.

## Internal route returns `404` due alias/deployment drift
Symptoms:
- Internal ops routes unexpectedly return `404` on staging/prod aliases (for example `/api/internal/generation-recovery/run` or `/api/internal/media-derivatives/run`).
- Vercel alias points to an older deployment that does not include current internal route inventory.

Checklist:
- Run deployment route parity gate:
  ```bash
  node scripts/verify_deployment_route_parity.mjs \
    --base-url https://<target-alias-or-url> \
    --token <SHORTPULSE_VERCEL_API_TOKEN>
  ```
- Inspect resolved deployment details directly:
  ```bash
  vercel inspect https://<target-alias-or-url> --format=json --token <SHORTPULSE_VERCEL_API_TOKEN>
  ```
- Confirm required routes are present in build output:
  - `/api/internal/admin-user-health-fleet/run`
  - `/api/internal/generation-recovery/run`
  - `/api/internal/media-derivatives/run`

Mitigation:
- Do not run drain/recovery/derivative operations against aliases that fail route parity.
- Repoint alias or scheduler URLs to a deployment that passes the parity gate.
- Re-run parity check and only proceed when it reports `PASS`.

## Media derivative worker backlog grows or image rows stay `pending`
Symptoms:
- New image rows in `media_files` remain `processing_status='pending'` for long periods.
- `thumb_variant_path` remains null for recently ingested image rows.

Checklist:
- Confirm worker route and auth:
  - `POST /api/internal/media-derivatives/run`
  - `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=true`
  - valid `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET` (or `CRON_SECRET`) provided.
- Confirm migrations are applied:
  - `sql/migrations/065_add_media_derivative_processing_fields.sql`
  - `sql/migrations/066_add_media_derivative_processing_rpcs.sql`
- Run derivative backlog diagnostics:
  - `sql/check_media_derivative_processing_backlog.sql`
- Run terminal derivative failure diagnostics:
  - `sql/check_media_derivative_terminal_failures.sql`
- Confirm runtime SQL security audit includes and passes derivative RPC checks:
  - `sql/check_runtime_sql_security_audit.sql`

Mitigation:
- Trigger a guarded manual run:
  - `curl -X POST -H \"x-shortpulse-cron-secret: <secret>\" http://localhost:3000/api/internal/media-derivatives/run`
- Inspect response metrics (`claimed`, `ready`, `failed`, `exhausted`, `variantRowsUpserted`, `errors`).
- For exhausted rows, inspect `media_files.processing_last_error` and re-queue deliberately with:
  - `sql/repair_media_derivative_requeue_terminal_row.sql`

## Media derivative row is terminal-failed with local-processing errors
Symptoms:
- Backlog query shows `processing_status='failed'`, `processing_attempts >= 5`, `processing_next_retry_at is null`.
- `processing_last_error` starts with one of:
  - `unsupported_input`
  - `decode_failed`
  - `upload_failed`
  - `variant_upsert_failed`

Checklist:
- Confirm queue health first:
  - `sql/check_media_derivative_processing_backlog.sql` should show `pending=0` and `processing=0`.
- Confirm terminal count is bounded:
  - `sql/check_media_derivative_terminal_failures.sql`
- Verify source object exists and is readable.
- For `decode_failed`, verify source bytes are a decodable image.
- For `upload_failed`, verify storage write health and bucket permissions.
- For `variant_upsert_failed`, verify DB relation health and grants.

Mitigation:
- Keep row terminal-failed (no retry churn) when failure is deterministic for that object.
- If business-critical, repair the source object (re-upload/regenerate) and then re-queue the row with:
  - `sql/repair_media_derivative_requeue_terminal_row.sql`
- Monitoring thresholds:
  - Warning: terminal failures > 3 or > 0.5% of image rows.
  - Critical: terminal failures > 20 or > 2% of image rows.

## Style prompt appears weak on some models (especially Google/Nano Banana edit lanes)
Symptoms:
- Style is selected, but outputs mostly follow reference structure with limited style transfer.
- Different model families show noticeably different style adherence for the same prompt + references.

Checklist:
- Confirm style prompt is actually selected and non-empty in the active Create/Edit workflow.
- Confirm style append path is active:
  - `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`
  - `frontend/features/ai-studio/logic/stylePromptAdapter.ts`
  - expected appended line depends on model family:
    - Nano Banana: `Visual style reference (treatment only): ... Preserve subject identity and base composition.`
    - Seedream: `Visual style reference: ... Emphasize cohesive palette, lighting mood, and surface texture.`
    - Generic/adapter disabled: `Visual style reference: <style prompt>`
- Confirm adapter flag state:
  - `NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED` (enabled unless explicitly `false`).
- Confirm visible prompt differences are not mistaken for submit prompt differences:
  - display prompt intentionally does not include the appended style line.
- Compare behavior across at least one non-Google image model and one Nano Banana family model with identical inputs.
- Ensure prompt/reference constraints are not over-specifying geometry/identity in ways that suppress style transfer.

Mitigation:
- Rewrite style prompts with concrete visual directives (palette, lighting, texture, grade) instead of broad adjectives.
- For edit-heavy/fidelity-heavy runs, add explicit scoping:
  - `Treat style as visual treatment only; preserve identity and composition.`
- If style append is present in payload and behavior is consistently weaker only on one model family, treat as expected model characteristic.
- If style adherence regresses after enabling family adaptation, set `NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED=false` to force legacy phrasing and re-compare outputs.
- If style adherence regresses on a model family that previously performed well under unchanged setup, capture payload/output evidence and open a runtime regression investigation.

## Styles Library shows `AbortError` or style extraction timeout/fallback
Symptoms:
- Styles Library shows timeout/interrupted extraction guidance and still creates a fallback style card.
- Legacy runs previously surfaced raw `AbortError` strings in the red warning line.

Checklist:
- Confirm user-facing message is normalized and does not expose raw browser exception text.
- Confirm extraction telemetry records failure class and timing metadata:
  - `failure_class`, `attempt_count`, `probe_ms`, `openai_ms`, `total_ms`, `model_used`.
- Confirm route diagnostics headers are present on `/api/ai/extract-style` responses when available:
  - `x-shortpulse-style-attempt-count`
  - `x-shortpulse-style-probe-ms`
  - `x-shortpulse-style-openai-ms`
  - `x-shortpulse-style-total-ms`
  - `x-shortpulse-style-model-used`

Mitigation:
- Re-run with the same image and verify failure class:
  - `timeout`: increase timeout budget only if telemetry shows consistent near-cap completions.
  - `network_transient`: inspect browser/network instability and retry behavior.
  - `upstream_http`: inspect extraction-route payload detail and trusted-host validation.
- If failures cluster by one model, compare with an alternate vision model using the same input and prompt contract.

## Reference Grid -> Styles drop shows blocked-source guidance
Known major unresolved incident: see `docs/known-issues.md` (P0 Reference Grid -> Styles drop reliability, deferred March 13, 2026).

Symptoms:
- Styles Library shows: `This image source blocks browser access. Download the image and drop the file directly.`
- Internal Reference Grid image drag fails even when the card appears fresh.

Checklist:
- Confirm drag payload is internal (`text/reference-origin=ai-studio-reference-grid`) and includes `text/reference-output-id`.
- Confirm style intake keeps same-origin `/_next/image` transfer URLs for internal drops (do not unwrap to upstream host before fetch).
- Confirm fallback persistence route is available:
  - `POST /api/media/copy-from-url`
- Confirm fallback lane toggle is enabled unless intentionally isolating happy-path behavior:
  - `NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED=true`
- Confirm trusted-host policy includes required media hosts (Supabase host and configured direct media allowlist as needed).
- Confirm `media_files` drift is remediated (run `sql/check_media_all_media_completeness_drift.sql`; apply `sql/migrations/064_backfill_media_files_from_storage_objects.sql` when needed).

Mitigation:
- Re-open/re-add the reference to refresh stale signed URLs.
- If browser fetch is blocked, rely on server copy fallback (`/api/media/copy-from-url`) instead of direct browser download.
- If trusted-host validation rejects the URL, add the host through the media direct-preview allowlist policy or use a user-uploaded source file.

## Expert Edit `@img` prompt references fail or look incorrect
Symptoms:
- Clicking Generate with prompt tokens (`@img1..@img3`) shows warning/error and submit does not start.
- Prompt token highlight appears misaligned or text appears visually duplicated/dim.
- Dragging a secondary image into the prompt does not insert token text.

Checklist:
- Confirm tokens are in supported range: only `@img1`, `@img2`, `@img3`.
- Confirm referenced secondary slots are populated (for example, `@img2` requires slot 2 image present).
- Confirm behavior is in the canonical Expert Edit workflow (legacy Edit fallback has been removed).
- Verify prompt references use the Expert Edit token logic path:
  - `frontend/features/ai-studio/logic/expertEditPromptReferences.ts`
  - `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
  - `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
- Verify prompt mirror and textarea layering/styles in:
  - `frontend/styles/ai-studio-edit-expert.css`

Mitigation:
- Replace unsupported or incomplete tokens (`@img`, `@img4+`) with valid slot tokens.
- Populate missing secondary slots for referenced tokens.
- If token highlighting/caret alignment regresses, re-check prompt mirror invariants:
  - same typography and wrapping rules on textarea + mirror,
  - synced scroll offsets,
  - mirror highlight layer above textarea background,
  - transparent textarea text with visible caret.
- Re-run targeted tests:
  ```bash
  cd frontend
  npm run test -- expertEditPromptReferences.test.ts
  npm run test -- ExpertEditPanelView.test.tsx
  npm run test -- useAiStudioGenerationController.test.ts
  npm run test -- useAiStudioGenerationPromptComposer.test.ts
  ```

## Expert Edit inpaint generate fails before task starts
Symptoms:
- Inpaint Generate shows `Mask selection is required for inpaint.` and no task starts.
- Generate fails quickly after clicking with `Generation failed to start. Please retry.`
- Provider errors include download/signing failures for base image or mask URLs.

Checklist:
- Confirm Inpaint rail is selected and a non-empty mask exists on the selected layer.
- Confirm the inpaint submit path is active:
  - `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
  - `frontend/pages/api/fal/flux-pro-fill-submit.ts`
  - `frontend/pages/api/fal/flux-pro-fill-status.ts`
- Verify temporary upload/signing requests succeed before submit:
  - `POST /api/upload-image` returns `200` for transient blob refs.
  - Signed URLs are fresh and still accessible when submit fires.
- Verify submit payload includes both base image and mask URLs (not empty strings).
- Verify status polling starts with a provider `request_id` after submit.

Mitigation:
- Redraw the mask and retry (maskless submits are blocked by design).
- Re-select/re-upload the layer source image when URLs expired or become inaccessible.
- Re-run with fresh references if provider returns `file_download_error` or `Failed to download the file`.
- If submit returns without a `request_id`, treat as start failure and inspect route logs for submit normalization errors.
- Re-run targeted tests:
  ```bash
  cd frontend
  npm run test -- flux-pro-fill-submit.test.ts
  npm run test -- flux-pro-fill-status.test.ts
  npm run test -- ExpertEditPanelView.test.tsx
  npm run test -- useAiStudioGenerationController.test.ts
  ```

## Signed Supabase image requests fail with `ERR_QUIC_PROTOCOL_ERROR`
Symptoms:
- Browser console shows:
  - `net::ERR_QUIC_PROTOCOL_ERROR 200 (OK)`
- Media cards may remain blank despite successful sign telemetry.

Checklist:
- Verify sign telemetry is healthy first:
  - `window.__shortpulseMediaPerf?.signStats()` shows low/zero failure ratio.
- Confirm issue is transport/browser-lane (request returns `200` but fails at QUIC).

Mitigation (local debugging):
- Launch Chrome with QUIC disabled:
  ```bash
  open -na "Google Chrome" --args --disable-quic --disable-features=UseDnsHttpsSvcbAlpn
  ```
- Hard refresh and re-test.

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

## AI Studio All Media folder is missing expected legacy/private/generated assets
Checklist:
- Confirm listing route is healthy:
  - `POST /api/media/list` should return rows for `folderId=all_items` with `mediaKind=all`.
- Run completeness diagnostics:
  - `sql/check_media_all_media_completeness_drift.sql`
- Verify durable missing classes are expected (`private_images`, `uploads_images`, `uploads_videos`, `generations_images`, `generations_videos`) and transient/character/variant paths are excluded.

Mitigation:
- Apply migration `sql/migrations/064_backfill_media_files_from_storage_objects.sql` in staging first.
- Re-run `sql/check_media_all_media_completeness_drift.sql` and confirm missing counts converge.
- If rollback is required, run `sql/migrations/rollback/064_backfill_media_files_from_storage_objects_rollback.sql` (removes only migration-tagged rows).

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
- If AI Studio `All Media` is specifically slow for `generations_images`, run:
  - `sql/check_media_preview_variant_coverage_and_size.sql`
  - review `ai_studio` + `image` rows for:
    - low thumb/preview variant coverage
    - large `p50_bytes` / `p90_bytes`
  - verify panel compaction flags:
    - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED=true`
    - `NEXT_PUBLIC_MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED=true`
    - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` includes `media-library-grid` or `media-library-modal-grid`
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

## AI Studio session persistence emergency rollback posture
Checklist:
- Default posture is now client session persistence hard-off.
- Confirm this client master gate is unset or `false`:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED`
- If forcing a full rollback baseline, also confirm these flags are `false` in the active frontend/server runtime:
  - `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED`
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED`
- Expected behavior in this baseline:
  - no session restore/switch UX,
  - no `/api/ai/sessions*` traffic during normal AI Studio usage,
  - workspace state remains runtime-local only,
  - `sid` remains runtime identity only and does not imply resumable restore.
- Full-canvas persistence runbook:
  - `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
  - `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`

## AI Studio session shadow persistence not syncing to server
Checklist:
- Ensure migration `sql/migrations/044_add_ai_studio_sessions_persistence.sql` is applied.
- Ensure ambiguity hotfix migration `sql/migrations/053_fix_ai_studio_session_upsert_ambiguity.sql` is applied.
- Ensure server route flag is enabled (or unset):
  - `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` must not be `false`.
- Ensure client remote-shadow flag is enabled for write-through shadow mode (enabled by default):
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED` must not be `false`.
- Verify authenticated `POST /api/ai/sessions/save` responses are `200` for active users.
- Verify snapshot payload size is below server cap (`~900KB` serialized JSON).
- If `POST /api/ai/sessions/save` returns `500`, inspect API/server logs for SQLSTATE `42702` with
  `column reference "user_id" is ambiguous` from `upsert_ai_studio_session_snapshot`.
  This indicates the database function body is running pre-hotfix SQL and will fail every remote save.
- Note: local IndexedDB shadow remains active when remote shadow is disabled/unavailable, but cross-device durability depends on remote save success.

## AI Studio session restore candidate does not appear
Checklist:
- Confirm client session persistence is explicitly opted in:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED=true`
- Ensure `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED` is not `false` in the frontend environment.
- Ensure `sid` is present and valid in URL (`/ai-studio?sid=<uuid>`).
- If remote restore candidate is expected, ensure `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` is not `false`.
- Verify authenticated `GET /api/ai/sessions/:sid` returns `200` (or `404` when not found).
- Inspect client breadcrumbs for `ai_studio_session_restore_candidate_loaded` to confirm source (`local` or `remote`).

## AI Studio session snapshot is loaded but not applied to UI
Checklist:
- Confirm client session persistence is explicitly opted in:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED=true`
- Ensure `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED` is not `false`.
- Ensure restore-candidate loading is enabled:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED` is not `false`.
- If agent transcript/input should also restore, ensure:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED` is not `false`.
- Verify candidate-load breadcrumb exists:
  - `ai_studio_session_restore_candidate_loaded`.
- Verify hydration-apply breadcrumb exists:
  - `ai_studio_session_hydration_applied`.
- If candidate breadcrumb exists but hydration breadcrumb does not, confirm current session `sid` has not already been hydrated in this page lifecycle and that snapshot payload includes expected workspace/output fields.
- When hydration apply is enabled, restored state includes workspace, outputs, agent transcript/input, and canvas state (scene + dual viewport cameras + transient text-edit sessions).
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
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED` is not `false`.
  - (Local IndexedDB write-shadow still persists even when remote mirror is off.)

## AI Studio canvas item cap reached
Symptoms:
- New drops or draft text commits stop adding items once the scene is dense.
- UI warning appears about the canvas item cap.

Checklist:
- Current hard cap is `300` scene items per session snapshot.
- Verify existing scene item count in the canvas state before further inserts.
- Remove or consolidate items, then retry the insert.

## AI Studio session autosave skipped due oversized snapshot
Symptoms:
- UI warning indicates session autosave was skipped due snapshot size.
- Local canvas/workspace state still appears live, but remote durability may lag.

Checklist:
- Reduce payload pressure:
  - remove unused canvas items,
  - avoid non-essential large text blocks in canvas/agent/workspace fields.
- Confirm warning includes current size vs max limit.
- Retry after reducing state size and verify `POST /api/ai/sessions/save` returns `200`.

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

## AI Studio generation fails with `Preparation timed out before generation started. Please retry.`
Symptoms:
- Output placeholder flips to failed before provider submit starts.
- UI error banner shows `Preparation timed out before generation started. Please retry.`

Cause:
- Pre-submit media preparation exceeded the dynamic deadline budget before provider handoff.
- Common stages: local reference fetch, `/api/upload-image` roundtrip, or signed URL refresh.

Checklist:
- Inspect `app_error_logs` for `source='generation_preflight_timeout'` and review metadata:
  - `preflight_work_units`
  - `preflight_timeout_ms`
  - `model_id`
  - `tool`
- Inspect client breadcrumbs for `generation_preflight_prepare_stage` and identify the failing stage:
  - `fetch_local_image`
  - `upload_image_route`
  - `refresh_signed_url`
- If `upload_image_route` is timing out, verify auth/session health and `/api/upload-image` latency.
- If `refresh_signed_url` is failing, reselect references to mint fresh signed URLs.

Mitigation:
- Retry with fewer local blob/data references in one submit.
- Re-add stale references and rerun.
- If repeated on healthy network/session, capture the stage breadcrumb packet and escalate to generation runtime incident triage.

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

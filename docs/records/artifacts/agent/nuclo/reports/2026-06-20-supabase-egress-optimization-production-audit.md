# Supabase Egress Optimization Production Audit

Date: 2026-06-20
Agent: Nuclo
Scope: ShortPulse production Supabase egress optimization lane
Mode: audit/report only; no app, SQL, Vercel, or Supabase mutations

## Goal

Preserve the current production evidence for the Supabase egress optimization lane, identify the highest-confidence root-cause direction, and define the stop boundary while Gearball owns dirty media API files.

## Environment And Branch Evidence

- Local branch: `production`.
- Local branch guard: `shortpulse.allowedBranch = production`.
- Production URL in scope: `https://www.shortpulse.ai`.
- Production Supabase project ref verified from a temporary Vercel production env pull: `ftgrqgjrchpimronuhop`.
- Temporary env file path used for the read-only audit: `/tmp/shortpulse-production-egress-audit.env`.
- Secret-bearing temp env file was deleted after use.

## Validation Run

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai --required-route /api/internal/media-derivatives/run`
  - Result: pass.
  - Live deployment resolved to `https://shortpulse-l7d8cjqfs-kirk-artmans-projects.vercel.app`.
  - Required route `/api/internal/media-derivatives/run` was present.
- Wrong-secret probe against `POST https://www.shortpulse.ai/api/internal/media-derivatives/run`
  - Result: `401`.
  - Interpretation: route is deployed and fail-closed for an invalid cron secret.
- `npm -C frontend run test:supabase-transform-guard`
  - Result: pass.
  - Coverage: 1 test file, 3 tests.
  - Interpretation: the repo guard against Supabase image transformations is still passing.

## Production Data Snapshot

Read-only production REST/storage audit results:

- `media_files`: 3331 rows.
- `media_asset_variants`: 5810 rows.
- Source/kind counts:
  - `ai_studio|audio`: 317
  - `ai_studio|image`: 1857
  - `ai_studio|video`: 239
  - `upload|audio`: 34
  - `upload|image`: 862
  - `upload|video`: 22
- Image variant coverage:
  - Images: 2719 total.
  - Images with thumb variant path: 2719.
  - Image thumb coverage: 100.00%.
- Video variant coverage:
  - Videos: 261 total.
  - Videos with poster: 185.
  - Poster coverage: 70.88%.
  - Videos with preview: 187.
  - Preview coverage: 71.65%.
  - Videos with both poster and preview: 184.
  - Paired video poster+preview coverage: 70.50%.
- Image processing status:
  - `ai_studio|ready`: 1857.
  - `upload|ready`: 862.
- Terminal image failures:
  - Count: 0.

## Object Delivery Samples

Signed object HEAD samples against production storage:

- Recent image thumbs: 50/50 returned `200`.
- Upload image thumbs: 50/50 returned `200`.
- AI Studio image thumbs: 50/50 returned `200`.
- Video posters: 50/50 returned `200`.
- Video previews: 50/50 returned `200`.

Interpretation: current sampled variant object delivery is healthy. The earlier stale/broken image-thumb delivery concern did not reproduce in this production sample.

## Current Diagnosis

The best evidence-backed diagnosis is:

- Image thumbnail generation and sampled delivery are currently healthy.
- Supabase image transformations are still prohibited and the transform guard passes.
- The strongest repo/database-backed media gap is incomplete video poster+preview coverage: about 29.5% of production videos do not have the paired durable video variants.
- If Supabase Dashboard confirms Storage is the dominant egress service, the next likely root-cause lanes are video original delivery/preload behavior, signed URL churn, tutorial/dashboard media usage, or remaining video variant backfill/workflow health.

This report does not prove the exact Supabase egress driver by service. Supabase Dashboard usage/observability breakdown is still needed to distinguish Storage from Database/PostgREST, Auth, Realtime, Edge Functions, Pooler, or Log Drains.

## 2026-06-21 Clean-Seam Source Trace

The previously dirty Gearball-owned media API files were clean in the scoped worktree check on 2026-06-21, so Nuclo resumed source inspection without editing app behavior.

Source trace findings:

- `frontend/pages/api/media/list.ts`
  - Sanitizes storage and variant paths to authenticated user scope before returning rows.
  - Seeds initial signed URLs only for first-page, non-query, `all` media views.
  - Panel surfaces seed only the first 2 signed URLs server-side.
  - Uses `resolvePreferredMediaSigningStoragePath`, so durable preview variants are preferred before originals when present.
- `frontend/pages/api/media/sign-batch.ts`
  - Caps requested paths at 60.
  - Rejects out-of-scope paths.
  - Verifies storage-object existence before signing.
  - Uses `createSignedUrls(paths, expiresInSeconds)` without Supabase transform options.
- `frontend/pages/api/media/resolve-previews.ts`
  - Uses preferred preview/direct URL logic, verifies storage-object existence, and only falls back through bounded basename repair for visible unresolved rows.
  - Browse surfaces prefer trusted direct preview URLs and narrow storage candidates to preferred preview plus original fallback.
- `frontend/lib/mediaPreviewPathCore.ts`
  - For videos, durable preview order is `preview_variant_path` then `poster_variant_path` before metadata variants and original fallback.
  - Explicitly classifies preview paths as durable/original/unknown for telemetry.
- `frontend/lib/mediaSignedUrlCache.ts`
  - Caches signed URLs for 1 hour with a 20 second refresh buffer.
  - Deduplicates in-flight requests and signs via `/api/media/sign-batch` in chunks of 60 with low concurrency.
- `frontend/features/media-library/hooks/useMediaGridVideoBudgetController.ts`
  - Bounds concurrent autoplay/attached video sources and detaches offscreen video sources after idle delay.
- `frontend/features/ai-studio/hooks/useMediaVideoBrowsePreviewUrls.ts`
  - For panel surfaces, video poster/hover signing is scoped to currently visible media ids.
  - Modal surfaces may sign across current media rows, but still use the shared signed URL cache and durable variant preference.
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaCard.tsx`
  - Mixed-feed video cards show poster images when available and render hover videos with `preload="metadata"`.
  - Grid video previews attach source only through the video budget controller.
- `frontend/pages/api/dashboard/tutorial-thumbnail.ts`
  - Public dashboard tutorial thumbnail delivery uses stable app-owned URLs, 24 hour public/CDN cache headers, 7 day stale-while-revalidate, ETags, and an 8 MB in-process memory cache.
  - It signs upstream Supabase objects for only 60 seconds behind the app route rather than exposing changing signed URLs to browsers.
- `frontend/features/dashboard/components/DashboardTutorialGrid.tsx`
  - Tutorial video thumbnails do not attach `src` until autoplay or user intent.
  - They use poster-first display, `preload="none"` until playback, near-viewport checks, autoplay budget, and delayed source release.

Interpretation after the clean-seam trace:

- Current source is already variant-aware, visibility-scoped on panel surfaces, and cache-conscious.
- No obvious canonical app-code patch is justified without knowing the actual Supabase egress driver.
- If Storage is confirmed as the driver, the next proof should rank high-byte paths and compare video-original delivery versus durable poster/preview delivery.
- If Database/PostgREST or another service is confirmed as the driver, the media UI/signing lane is probably the wrong root cause.

## 2026-06-21 Authenticated Production Media Panel KPI Capture

Nuclo inspected the media performance telemetry implementation on 2026-06-21. `frontend/lib/mediaPerfTelemetry.ts` keeps a sanitized in-browser event buffer capped at 500 events, exposes aggregate helpers on `window.__shortpulseMediaPerf`, and adds client breadcrumbs. This is intentionally a runtime debugging surface, not a persisted production database ledger. The practical consequence is that signed URL churn/original-fallback proof requires an authenticated browser capture or another runtime observability source; it cannot be reconstructed from the current production database tables alone.

After the local audit credentials were available, Nuclo ran authenticated production captures against `https://www.shortpulse.ai` with `frontend/scripts/media_panel_kpi_capture.mjs`.

AI Studio Media Panel capture:

- Command shape: `node frontend/scripts/media_panel_kpi_capture.mjs --surface ai-studio-panel --base-url https://www.shortpulse.ai --runs 5 --format markdown`.
- Sample count: 5.
- Overall score: 5.56 / 10, readiness `fragile`, evidence quality `low`.
- First media paint p95: 3144 ms.
- Open to first media p95: 3144 ms.
- Stable content settle p95: 3553 ms.
- Sign batch p95: 1460 ms.
- Extra list calls per open: 1.
- Resolve calls per open: 0.
- Sign failed ratio: 0.
- Console errors per open: 0.
- Missing preview ratio: 0.
- Canonical preview coverage ratio: 1.
- Open-phase list rows averaged 18 rows: 16 images and 2 videos.
- Average durable field coverage: thumb 16, poster 2, preview 2, any 18.
- Average seeded signed rows: 2.
- Open-phase sign breakdown: `uploaded_images`, coverage 1, signed 12, p95 1460 ms.

Elements Embedded Media Panel capture:

- Command shape: `node frontend/scripts/media_panel_kpi_capture.mjs --surface elements-media-panel --base-url https://www.shortpulse.ai --runs 5 --format markdown`.
- Sample count: 5.
- Overall score: 6 / 10, readiness `fragile`, evidence quality `low`.
- First media paint p95: 1278 ms.
- Open to first media p95: 1278 ms.
- Stable content settle p95: 1687 ms.
- Sign batch p95: 1571 ms.
- Extra list calls per open: 1.
- Resolve calls per open: 0.
- Sign failed ratio: 0.
- Console errors per open: 0.
- Missing preview ratio: 0.
- Canonical preview coverage ratio: 1.
- Open-phase list rows averaged 18 rows: 16 images and 2 videos.
- Average durable field coverage: thumb 16, poster 2, preview 2, any 18.
- Average seeded signed rows: 2.
- Open-phase sign breakdown: `uploaded_images`, coverage 1, signed 15, p95 1571 ms.

Interpretation:

- Authenticated production runtime proof does not show original-fallback drift on either panel. Canonical preview coverage was 1, missing preview ratio was 0, resolve calls were 0, and sign failures were 0.
- The browser proof does show a real performance concern: signing p95 is high on both surfaces and each open still incurs one extra list call.
- This is useful launch-performance evidence, but it is not by itself a Storage-egress root cause. The signed assets are durable previews, not originals, and the captured open path did not hit fallback/resolve churn.
- The current media-panel root-cause direction is therefore signing latency/list orchestration, not raw Supabase egress volume. Any runtime patch should be scoped to that performance lane and should not be justified as an egress fix unless Dashboard/Observability shows Storage/API request volume from these routes is the billing driver.

## 2026-06-21 Hosted Production Refresh

Nuclo refreshed the same read-only production REST/storage audit on 2026-06-21 after the Gearball-owned media API seam was clean.

Environment handling:

- Production Vercel env was pulled to `/tmp/shortpulse-production-egress-audit.env`.
- `NEXT_PUBLIC_SUPABASE_URL` project ref verified as `ftgrqgjrchpimronuhop`.
- The temp env file was deleted after the audit.

Current production snapshot:

- `media_files`: 3461 rows.
- `media_asset_variants`: 6020 rows.
- Source/kind counts:
  - `ai_studio|audio`: 317
  - `ai_studio|image`: 1929
  - `ai_studio|video`: 248
  - `upload|audio`: 58
  - `upload|image`: 881
  - `upload|video`: 28
- Image variant coverage:
  - Images: 2810 total.
  - Images with thumb variant path: 2809.
  - Image thumb coverage: 99.96%.
  - Image processing status: 1 `ai_studio|pending`, 1928 `ai_studio|ready`, 881 `upload|ready`.
  - Terminal image failures: 0.
- Video variant coverage:
  - Videos: 276 total.
  - Videos with poster: 200.
  - Poster coverage: 72.46%.
  - Videos with preview: 202.
  - Preview coverage: 73.19%.
  - Videos with both poster and preview: 199.
  - Paired video poster+preview coverage: 72.10%.

Object delivery samples:

- Recent image thumbs: 50/50 returned `200`.
- Upload image thumbs: 50/50 returned `200`.
- AI Studio image thumbs: 50/50 returned `200`.
- Video posters: 50/50 returned `200`.
- Video previews: 50/50 returned `200`.

Interpretation:

- Current sampled object delivery remains healthy.
- Video paired-variant coverage improved from 70.50% to 72.10%, but roughly 27.9% of production videos still lack a complete poster+preview pair.
- Image thumb coverage is effectively complete, with one currently pending AI Studio image and no terminal image failures.
- This still does not prove the billing egress driver by service; Supabase Dashboard Usage/Observability remains the needed source for that question.

## 2026-06-21 Production Media Byte-Risk Aggregate

Nuclo also ran a read-only production REST aggregate over `media_files` to quantify original object byte risk without printing object paths, row ids, user ids, signed URLs, or secrets.

Environment handling:

- Production Vercel env was pulled to `/tmp/shortpulse-production-egress-audit.env`.
- `NEXT_PUBLIC_SUPABASE_URL` project ref verified as `ftgrqgjrchpimronuhop`.
- The temp env file was deleted after the aggregate query.

Tracked original media corpus:

- All tracked `media_files` rows in this sample: 3468.
- Total original bytes represented by `media_files.file_size` or metadata fallback: 12.272 GB.
- All images: 2817 rows, 9.995 GB total, p50 2.41 MB, p90 7.09 MB, p99 19.66 MB.
- All videos: 276 rows, 2.080 GB total, p50 4.89 MB, p90 19.77 MB, p99 34.22 MB.
- All audio: 375 rows, 0.197 GB total, p50 0.04 MB, p90 1.75 MB, p99 5.39 MB.

Source split:

- AI Studio images: 1936 rows, 9.502 GB total, p50 3.50 MB, p90 10.27 MB, p99 20.04 MB, 1936 thumb paths.
- Upload images: 881 rows, 0.493 GB total, p50 near 0 MB, p90 1.98 MB, p99 7.14 MB, 881 thumb paths.
- AI Studio videos: 248 rows, 1.690 GB total, p50 4.79 MB, p90 17.49 MB, p99 29.29 MB.
- Upload videos: 28 rows, 0.390 GB total, p50 6.13 MB, p90 31.92 MB, p99 42.62 MB.

Video pair coverage by original-byte risk:

- All videos with poster+preview pair: 199 rows, 1.438 GB of original bytes.
- All videos missing a complete poster+preview pair: 77 rows, 0.641 GB of original bytes.
- AI Studio videos missing a complete pair: 64 rows, 0.438 GB of original bytes.
- Upload videos missing a complete pair: 13 rows, 0.204 GB of original bytes.

Interpretation:

- The tracked original media corpus is much smaller than the observed billing-cycle egress screenshot. Against the earlier 292.12 GB egress screenshot, the full tracked original corpus would need to be delivered about 23.8 times to explain that amount by itself.
- Missing video poster+preview pairs matter for user experience and for preventing original-video preview fallback, but the missing-pair original-byte pool is only about 0.641 GB. It cannot alone explain hundreds of GB of egress unless those originals are repeatedly fetched many times.
- The largest at-rest source class is AI Studio images at about 9.502 GB. Because image thumb coverage is effectively complete, high image egress would more likely come from surfaces fetching originals/downloads/detail views or a non-variant path, not from missing thumb generation.
- This strengthens the need for Supabase Dashboard/Observability service and path breakdown before making app-code changes. The byte-risk data points to repeated delivery or a non-media service/path, not a simple storage-size problem.

## 2026-06-21 Production Variant Byte-Risk Aggregate

Nuclo ran a read-only production REST aggregate over `media_asset_variants` to quantify stored derivative byte risk without printing object paths, row ids, user ids, signed URLs, or secrets.

Environment handling:

- Production Vercel env was pulled to `/tmp/shortpulse-production-egress-audit.env`.
- `NEXT_PUBLIC_SUPABASE_URL` project ref verified as `ftgrqgjrchpimronuhop`.
- The temp env file was deleted after the aggregate query.

Current production derivative snapshot:

- `media_asset_variants`: 6036 rows.
- Ready variants: 6036 rows.
- Total ready variant bytes: about 77.741 MB.
- `thumb_240`: 2817 ready rows, about 14.416 MB total, about 0.005 MB average, p90 about 0.011 MB, p99 about 0.017 MB.
- `thumb_480`: 2817 ready rows, about 42.636 MB total, about 0.015 MB average, p90 about 0.034 MB, p99 about 0.055 MB.
- `poster_720`: 200 ready rows, about 12.917 MB total, about 0.065 MB average, p90 about 0.127 MB, p99 about 0.236 MB.
- `preview_loop_360p`: 202 ready rows, about 7.772 MB total, about 0.038 MB average among all rows. Thirty rows have null `byte_size`, so this table-backed total is a lower bound for preview-loop bytes.

Interpretation:

- Durable derivative storage volume is very small relative to the earlier 292.12 GB billing-cycle egress screenshot. Even if all recorded derivative bytes were delivered repeatedly, the full ready-variant corpus would need to be transferred roughly 3,850 times to explain 292.12 GB by itself.
- This further weakens "too many thumbnails/variants exist" as the root explanation.
- If Supabase Storage is confirmed as the dominant service, the higher-risk paths remain repeated original-object delivery, cache bypass, direct downloads/detail views, or a path not represented by the derivative table.
- If the Dashboard/Observability service split shows non-Storage egress, this media derivative lane should stop and pivot to the actual service/path.

## 2026-06-21 Production Storage Object Egress-Risk Breakdown

Nuclo ran the next production-safe proof seam: aggregate `storage.objects` by bucket/path class so untracked storage objects could be compared against tracked `media_files` and `media_asset_variants`.

Environment and access handling:

- Production PostgREST rejected `Accept-Profile: storage` with `PGRST106`; only `public` and `graphql_public` are exposed.
- The Vercel production env available to this workspace contains Supabase URL, anon key, and service-role key, but no direct database connection variable, so PostgREST could not provide `storage.objects` aggregate proof.
- `SHORTPULSE_PRODUCTION_DB_URL` was available in the local agent env file and was used only in-process; the raw URL and password were not printed.
- `psql` was available through Homebrew `libpq`.
- Production DB connectivity was confirmed against database `postgres` on PostgreSQL `17.6`.
- The temporary Vercel env file was deleted before the direct DB run.

Diagnostic added and run:

- Added `sql/check_storage_object_egress_risk_breakdown.sql`, a read-only diagnostic that summarizes `storage.objects` bytes by safe bucket/path class and media tracking state without printing object names, user ids, signed URLs, or secrets.
- Added the diagnostic to `docs/sops/sop_sql_migration_operations.md`.
- Added the diagnostic to the media performance runbook as the first hosted SQL check to run when Supabase Storage egress is suspected.
- Production run command shape:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 \
  -f sql/check_storage_object_egress_risk_breakdown.sql
```

Production aggregate results:

- Total classified storage-object bytes in the diagnostic output: about 15,979.116 MB.
- Largest tracked original class: `media_library/generation_images | tracked_original`, 1936 objects, about 9,729.674 MB.
- Largest untracked class: `media_library/transient_image_reference | untracked_by_media_tables`, 1110 objects, about 2,041.484 MB.
- Tracked generation videos: 244 objects, about 1,719.811 MB.
- Untracked generation images: 302 objects, about 423.404 MB.
- Tracked legacy videos: 28 objects, about 398.986 MB.
- Tracked legacy images: 186 objects, about 340.609 MB.
- Untracked transient motion references: 47 objects, about 297.784 MB.
- Untracked character assets: 69 objects, about 293.393 MB.
- Dashboard tutorial thumbnail bucket `source_or_other`: 66 objects, about 218.027 MB.
- Tracked upload images: 695 objects, about 164.484 MB.
- Tracked generation audio: 317 objects, about 141.698 MB.
- Storage variants: 6036 tracked variant-row objects, about 78.823 MB.
- Other user-scoped untracked media-library objects: 53 objects, about 59.170 MB.

Interpretation:

- The full classified storage-object corpus is still far smaller than the earlier 292.12 GB billing-cycle egress screenshot. Even if the full corpus were delivered, it would need to transfer roughly 18.7 times to explain that screenshot by itself.
- The biggest byte class is tracked AI Studio generation images, not dashboard tutorial media and not generated variants.
- Untracked transient/reference classes are real cleanup candidates, especially transient image references and transient motion references, but their byte volume still does not explain hundreds of GB unless repeatedly fetched.
- Durable variants remain tiny relative to originals and relative to the billing screenshot.
- This strengthens the current root-cause direction: if Supabase Storage is the egress driver, the issue is likely repeated delivery, cache bypass, direct original fetches, or a path/service behavior not visible from raw object volume alone.
- Supabase Dashboard Usage/Observability service split remains necessary before making a runtime/code patch. If Storage is not the dominant egress service, this media/storage lane should pivot to the actual service/path.

## 2026-06-21 Public Dashboard Tutorial Delivery Probe

Nuclo ran a read-only production probe against the public dashboard tutorial API and its returned app-owned thumbnail routes. The probe did not print tutorial URLs, object paths, row ids, user ids, signed URLs, or secrets.

Production API response:

- `GET /api/dashboard/tutorials`: `200`.
- API cache header: `public, max-age=60`.
- Tutorial count returned: 18.
- Thumbnail media types returned: 18 videos.

App-owned asset route HEAD summary:

- Unique asset requests checked: 36.
- Video thumbnail assets: 18 returned `200`, about 11.678 MB total, about 0.649 MB average, `Content-Type: video/mp4`.
- Poster image assets: 18 returned `200`, about 1.303 MB total, about 0.072 MB average, `Content-Type: image/jpeg`.
- Cache header for both asset classes: `public, max-age=86400, immutable`.
- URL class for both asset classes: app-owned proxy route.

Interpretation:

- The signed-out dashboard tutorial assets are currently small enough and cacheable enough that they are not a strong standalone explanation for hundreds of GB of Supabase egress.
- This does not rule out tutorial media as a contributor if browsers repeatedly bypass cache, if high traffic arrives, or if a different dashboard path fetches original Supabase objects directly.
- Based on current production HEAD evidence and authenticated browser capture, the next higher-ROI proof is Supabase Dashboard/Observability service and path breakdown.

## 2026-06-21 Production Database Egress Query-Stats Breakdown

Nuclo ran the matching production-safe database/API proof seam: aggregate `pg_stat_statements` by query class so high-frequency database behavior can be separated from large-row-payload behavior without printing raw query text or row data.

Environment and access handling:

- `SHORTPULSE_PRODUCTION_DB_URL` was available in the local agent env file and was used only in-process; the raw URL and password were not printed.
- `psql` was available through Homebrew `libpq`.
- Production DB connectivity had already been confirmed against database `postgres` on PostgreSQL `17.6`.
- The diagnostic reads `pg_stat_statements` counters, which are cumulative since the last reset.

Diagnostic added and run:

- Added `sql/check_database_egress_query_stats.sql`, a read-only diagnostic that summarizes `pg_stat_statements` into low-cardinality query classes.
- Added the diagnostic to `docs/sops/sop_sql_migration_operations.md`.
- Added the diagnostic to the media performance runbook as the first hosted SQL check to run when Supabase Database/PostgREST egress is suspected.
- Production run command shape:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 \
  -f sql/check_database_egress_query_stats.sql
```

Production aggregate results:

- `pg_stat_statements` is enabled.
- `stats_reset`: `2026-06-18 17:01:12.171848+00`.
- Highest call classes in the point-in-time production runs, rounded because counters continue to accumulate:
  - `postgrest_session_setup`: about 424k calls, rows/call 1.000, weighted mean about 0.036 ms.
  - `connection_transaction_overhead`: about 235k calls, 0 rows, weighted mean about 0.007 ms.
  - `other`: about 229k calls, rows/call about 0.88, weighted mean about 1.49 ms.
  - `public.generation_projection`: about 154k calls, rows/call 1.000, weighted mean about 9.19 ms.
  - `pg_net_cron_internal`: about 85k calls, rows/call about 0.80, weighted mean about 0.14 ms.
  - `public.ai_generations`: about 65k calls, rows/call 1.000, weighted mean about 27.1 ms.
  - `auth_internal`: about 48k calls, rows/call about 1.00.
  - `public.project_generation_items`: about 34k calls, rows/call 1.000, weighted mean about 0.20 ms.
  - `storage.objects`: about 21k calls, rows/call about 1.30.
  - `pooler_auth`: about 13k calls.
- Hot generation query shapes in the same point-in-time runs:
  - `generation_projection_workspace_runtime_key`: about 70k calls, rows/call 1.000, weighted mean about 19.7 ms.
  - `ai_generations_request_lookup`: about 60k calls, rows/call 1.000, weighted mean about 29.1 ms.
  - `project_generation_items`: about 34k calls, rows/call 1.000, weighted mean about 0.20 ms.
  - `generation_projection_request_lookup`: about 32k calls, rows/call 1.000, weighted mean about 0.12 ms.
  - `generation_projection_project_scoped`: about 26k calls, rows/call 1.000, weighted mean about 0.47 ms.
  - `generation_projection_other`: about 21k calls, rows/call 1.000, weighted mean about 0.58 ms.
  - `ai_generations_status_or_recovery`: about 5k calls, rows/call 1.000, weighted mean about 2.34 ms.
  - `generation_projection_source_ref_lookup`: about 5k calls, rows/call 1.000, weighted mean about 0.24 ms.

Interpretation:

- Production DB/API stats show high-frequency one-row generation and session setup behavior, not obvious high-row result payloads.
- The hottest generation shapes are workspace-runtime-key projection reads and request-id generation lookups. If Supabase Dashboard/Observability shows Database, PostgREST, or Pooler as the dominant egress service, the next root-cause lane should inspect generated-output workspace restore, active task polling/status lookup, and project generation hydration cadence rather than media thumbnail delivery.
- If Supabase Dashboard/Observability shows Storage as the dominant egress service, this DB query-stat proof lowers the likelihood that database result payload size is the primary cause and shifts attention back to repeated object delivery, cache bypass, or direct original fetches.
- This diagnostic still cannot replace the Dashboard service split. It proves query-shape risk inside the database, not which Supabase service generated the billed egress bytes.

## 2026-06-21 Database/API Source Trace

Nuclo traced the hottest database query classes back through the current source without editing runtime behavior.

Likely source families:

- `generation_projection_workspace_runtime_key`
  - Maps most closely to generated-output workspace restore and non-project AI Studio output hydration in `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`.
  - The visible output list path can query `generation_projection` by `workspace_runtime_key`, order by generation recency, and limit bounded output rows.
- `ai_generations_request_lookup`
  - Maps to request-id/provider-status/recovery lookup surfaces across `frontend/lib/server/api/falStatusProxy.ts`, `frontend/lib/server/api/generationReconcile.ts`, `frontend/lib/server/api/generationProjection.ts`, recovery helpers, and generated-media authority.
  - This is consistent with active task polling and server lifecycle reconciliation rather than a large result payload.
- `project_generation_items` and `generation_projection_project_scoped`
  - Map to project-scoped generated-output hydration in `frontend/features/ai-studio/logic/generatedMediaAuthority.ts` and `frontend/lib/server/projectGenerationAssociationsService.ts`.
  - These paths are bounded and one-row/limited-list shaped, but can be called often during project/workspace restore.
- `GET /api/credits/snapshot`
  - `frontend/features/ai-studio/hooks/useCredits.ts` fetches `/api/credits/snapshot` on mount, on focus, on visible-tab return, and every 120 seconds while visible.
  - The route reads `ai_credit_balance` and active `ai_credit_reservations` for the authenticated user.
- Provider status polling
  - `frontend/features/ai-studio/hooks/taskPolling/pollingSchedulePolicy.ts` starts status polling at 900 ms, linearly backs off by 300 ms, caps at 3,000 ms, and allows up to 4 concurrent status requests.
  - This cadence is intentionally user-facing generation progress behavior; changing it without direct billed-service/path proof risks degrading UX while only guessing at egress impact.

Interpretation:

- The DB/API root direction, if confirmed by Supabase Usage, is high-frequency one-row generation/workspace/status behavior, not oversized database responses.
- There is no safe canonical code patch yet because the hot query shapes are tied to core user-visible generation progress, workspace restore, and project hydration behavior.
- The next DB/API optimization pass should start with route-level production frequency and user-flow reproduction for AI Studio generated-output restore/status polling before changing polling cadence or hydration queries.
- A likely good patch, if DB/API egress is confirmed, would be to reduce duplicate restore/status reads while preserving visible progress and project/workspace correctness. A bad patch would simply slow all polling globally without knowing whether active polling is the billed driver.

## 2026-06-21 Hot Query Index Posture Audit

Nuclo checked whether the hot DB/API query shapes were evidence of missing hosted indexes. This was a read-only production inspection.

Production table scan/cache posture:

- `ai_generations`: about 45k sequential scans and about 362M sequential tuples read since table stats began/reset, with about 8,150 live rows and about 100% heap cache hit.
- `generation_projection`: about 9k sequential scans and about 22M sequential tuples read, with about 2,503 live rows and about 99.99% heap cache hit.
- `project_generation_items`: 3 sequential scans, about 94k index scans, about 2,449 live rows, and about 99.83% heap cache hit.
- `media_files`: 12 sequential scans, about 96k index scans, about 3,469 live rows, and about 99.98% heap cache hit.
- `ai_credit_reservations`: 0 sequential scans, about 36k index scans, and about 95.07% heap cache hit.

Production index posture:

- `ai_generations_user_request_id_unique_idx` exists on `ai_generations (user_id, request_id)` where `request_id is not null`.
- `ix_generation_projection_request_id` exists on `generation_projection (user_id, request_id)` where `request_id is not null`.
- `ix_generation_projection_user_project_updated` exists on `generation_projection (user_id, project_id, updated_at desc)` where `project_id is not null`.
- `ix_generation_projection_user_workspace_runtime_updated` exists on `generation_projection (user_id, workspace_runtime_key, updated_at desc)` where `workspace_runtime_key is not null`.
- `ix_project_generation_items_user_project` exists on `project_generation_items (user_id, project_id, updated_at desc)`.
- `ix_project_generation_items_user_generation` exists on `project_generation_items (user_id, generation_id)`.

Production hot-path distribution:

- Current `generation_projection` rows with non-null `workspace_runtime_key`: 0 workspace groups.
- Current `ai_generations` rows with non-null `request_id`: 8,045 rows.
- Current `generation_projection` rows with non-null `request_id`: 2,592 rows.

Focused execution-plan check:

- The current workspace-runtime-key sample had no rows to explain because there are no non-null `workspace_runtime_key` groups at rest right now.
- The request-id `ai_generations` lookup uses `ai_generations_user_request_id_unique_idx`; the direct lookup itself was sub-millisecond in the sampled plan.
- The expensive part of the ad hoc sample query was choosing a sample group for the audit, not the application's indexed request-id lookup.

Interpretation:

- There is no evidence-backed index migration to add in this lane right now.
- The high `ai_generations` sequential-tuple counter is a real query-efficiency smell, but it does not prove egress volume: the table is small, cache-hot, and the hot `pg_stat_statements` classes are one-row-per-call shaped.
- The cumulative `pg_stat_statements` hot shapes may include historical traffic since the June 18 stats reset and do not prove the current at-rest workspace-runtime-key workload is active.
- If Database/PostgREST/Pooler egress is confirmed by Supabase Usage, the next optimization should focus on duplicate call cadence and route/user-flow frequency, not adding blind indexes.
- If DB compute/performance becomes the lane after egress is understood, inspect the `ai_generations` status/recovery/provider count queries separately from this egress lane.
- This strengthens the current stop boundary: without Supabase service/path egress proof, a schema patch would be lower ROI than stopping.

## 2026-06-21 Scheduler Activity Sanity Check

Nuclo checked whether internal scheduler traffic could explain the high `pg_stat_statements` call volume or indicate duplicate hosted cron jobs.

Tooling findings:

- The installed Supabase CLI version is `2.78.1`.
- This CLI exposes database inspect helpers but no `supabase logs` command, so it cannot directly retrieve hosted Supabase Usage service split or service log analytics from this workspace.
- `vercel logs` can expose recent app request logs, but it does not measure Supabase billed egress bytes.
- Raw Vercel CLI log output repeated identical log IDs in the same response. In one probe, 1,000 raw lines deduped to 52 unique log IDs.

Deduped Vercel production log probe:

- Window represented by unique log IDs: `2026-06-21T15:02:00.304Z` to `2026-06-21T15:17:00.039Z`.
- Unique production log IDs: 52.
- Top deduped routes:
  - `POST /api/internal/generation-recovery/run`: 17 unique logs.
  - `POST /api/internal/media-derivatives/run`: 16 unique logs.
  - `GET /api/credits/snapshot`: 14 unique logs.
  - `POST /api/media/list`: 2 unique logs.
  - `POST /api/internal/billing-contract-renewals/run`: 1 unique log.
  - `POST /api/internal/admin-user-health-fleet/run`: 1 unique log.
  - `POST /api/media/prompts/list`: 1 unique log.

Hosted production scheduler diagnostic:

- Added `sql/check_scheduler_egress_activity.sql`, a read-only diagnostic that summarizes ShortPulse Supabase Cron jobs, recent run counts, and recent `pg_net` response statuses without printing URLs, headers, bodies, response content, Vault values, or secrets.
- Added the diagnostic to `docs/sops/sop_sql_migration_operations.md`.
- Added the diagnostic to the media performance runbook as the check to run before changing cron cadence when internal traffic looks inflated.
- Production run command shape:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 \
  -f sql/check_scheduler_egress_activity.sql
```

Production scheduler results:

- Active ShortPulse cron jobs:
  - `shortpulse_admin_user_health_fleet_hourly`: `0 * * * *`, active.
  - `shortpulse_generation_recovery_every_minute`: `* * * * *`, active.
  - `shortpulse_internal_billing_renewals_hourly`: `15 * * * *`, active.
  - `shortpulse_media_derivatives_every_minute`: `* * * * *`, active.
- Recent two-hour cron runs:
  - `shortpulse_generation_recovery_every_minute`: 120 succeeded runs.
  - `shortpulse_media_derivatives_every_minute`: 120 succeeded runs.
  - `shortpulse_admin_user_health_fleet_hourly`: 2 succeeded runs.
  - `shortpulse_internal_billing_renewals_hourly`: 2 succeeded runs.
- Recent two-hour `pg_net` responses:
  - `200`, not timed out, no error: 242 responses.
  - `409`, not timed out, no error: 2 responses.

Interpretation:

- Hosted cron is not duplicated. The every-minute jobs are running once per minute and succeeding.
- The apparent high request count in raw Vercel CLI output was inflated by repeated identical log IDs, so raw Vercel line count should not be used as request-volume proof without deduplication.
- Scheduler traffic is a real baseline contributor to database/API activity, but this production proof does not show a runaway cron loop, duplicate job, timeout retry storm, or obvious scheduler-caused egress incident.
- If Database/PostgREST/Pooler is the dominant Supabase egress service, the stronger next root-cause direction remains user/runtime polling and generation hydration cadence, not scheduler duplication.

## 2026-06-21 Supabase Usage Dashboard Proof

Nuclo opened the authenticated Supabase Usage dashboard read-only and filtered the organization Usage page to the production project. No Supabase settings, data, auth config, billing config, or repo runtime behavior were changed.

Dashboard source:

- Capture date: 2026-06-21. Supabase states Usage data refreshes hourly, so treat these values as point-in-time dashboard evidence.
- Organization: `Sleepy Sea Monster`, Pro plan.
- Billing cycle shown: `11 Jun 2026 - 11 Jul 2026`.
- Organization Usage page: `https://supabase.com/dashboard/org/aettteppbagwsszkrgde/usage`.
- Production filter URL state: `?projectRef=ftgrqgjrchpimronuhop`.
- Production project label: `ShortPulse - PRODUCTION - Live`.

All-project current-cycle usage shown in the dashboard:

- Egress: `403.697 / 250 GB (161%)`.
- Cached Egress: `31.371 / 250 GB (13%)`.
- Storage Size: `26.718 / 100 GB (27%)`.
- Storage Image Transformations: `0 / 100`.
- Edge Function Invocations: `0 / 2,000,000`.
- Log Drain Events: `0`.
- Billing panel egress used in period: `403.70 GB`.
- Billing panel egress overage in period: `153.70 GB`.
- Micro Compute Hours: `1,020 hours ($13.71)`.

Production-project filtered usage shown in the dashboard:

- Egress: `402.211 GB`.
- Cached Egress: `29.318 GB`.
- Storage Size: `2.375 GB`.
- Monthly Active Users: `7 MAU`.
- Monthly Active SSO Users: `0 MAU`.
- Monthly Active Third-Party Users: `0 MAU`.
- Storage Image Transformations: `0`.
- Realtime Concurrent Peak Connections: `0`.
- Realtime Messages: `0`.
- Edge Function Invocations: `0`.
- Log Drain Events: `0`.
- Micro Compute Hours: `255 hours`.

Interpretation:

- The high current-cycle egress is overwhelmingly in the production project. Production accounts for about `402.211 / 403.697 GB`, or roughly `99.6%`, of the all-project current-cycle egress visible in the dashboard.
- The earlier concern is not a development/staging project artifact; the production project is the correct root-cause surface.
- Supabase Image Transformations are currently `0` for both all-project and production-filtered views. That confirms the prior image-transformation regression is not the active current-cycle Usage driver.
- Realtime, Edge Functions, and Log Drains are also `0` in the production-filtered summary, so those services are not likely egress drivers for this cycle.
- Cached egress is nonzero but much smaller than uncached egress (`29.318 GB` cached versus `402.211 GB` egress in production). It should be tracked, but it is not the main overage metric shown by the production filter.
- The production dashboard proof materially narrows the lane. Tooltip capture from the production-filtered daily egress chart now shows that Storage dominated the first high day, but PostgREST dominated the later and larger sustained daily egress.

Dashboard breakdown boundary:

- The production page showed an `Egress per day` chart with dates `11 Jun` through `21 Jun` and scale labels up to `61.2GB`.
- The chart is rendered as a stacked Recharts SVG, so accessible chart text alone is insufficient.
- Nuclo scrolled the authenticated dashboard container and captured the visible hover tooltips for the daily bars without changing Supabase settings, billing, data, or auth config.

Production-filtered daily egress service split captured from dashboard tooltips:

- `11 Jun 2026`: Auth `9.074MB`, PostgREST `829.632MB`, Storage `51.398GB`.
- `12 Jun 2026`: Auth `8.556MB`, PostgREST `634.252MB`, Storage `8.179GB`.
- `13 Jun 2026`: Auth `6.085MB`, PostgREST `992.188MB`, Storage `6.577GB`.
- `14 Jun 2026`: Auth `4.595MB`, PostgREST `26.879GB`, Storage `2.487GB`.
- `15 Jun 2026`: Auth `5.455MB`, PostgREST `12.757GB`, Storage `3.822GB`, Shared Pooler `295.412KB`.
- `16 Jun 2026`: Auth `6.823MB`, PostgREST `18.942GB`, Storage `5.361GB`, Shared Pooler `20.913KB`.
- `17 Jun 2026`: Auth `6.228MB`, PostgREST `27.054GB`, Storage `3.717GB`.
- `18 Jun 2026`: Auth `4.635MB`, PostgREST `47.184GB`, Storage `2.385GB`.
- `19 Jun 2026`: Auth `4.412MB`, PostgREST `54.8GB`, Storage `1.554GB`.
- `20 Jun 2026`: Auth `6.529MB`, PostgREST `58.001GB`, Storage `3.201GB`.
- `21 Jun 2026`: Auth `1.824MB`, PostgREST `36.895GB`, Storage `955.933MB`.

Interpretation:

- The early-cycle spike on `11 Jun` was Storage-heavy.
- From `14 Jun` onward, the sustained overage is overwhelmingly PostgREST-heavy.
- Realtime, Edge Functions, Log Drains, and image transformations remain non-drivers in the dashboard summary.
- Shared Pooler appears negligible in the captured daily tooltips.
- The active optimization lane should therefore pivot from media derivative/storage cleanup to PostgREST response volume, request cadence, and payload projection risk.
- Storage remains a secondary follow-up for the early `11 Jun` spike, but it is not the dominant current daily overage driver.

## 2026-06-21 PostgREST Payload Projection Risk

Nuclo added and ran a focused read-only production diagnostic to separate "many small PostgREST calls" from "many calls that repeatedly ship heavy rows." The diagnostic does not print raw query text, row data, user ids, tokens, signed URLs, prompts, or object paths.

Diagnostic added and run:

- Added `sql/check_postgrest_payload_projection_risk.sql`.
- Added the diagnostic to `docs/sops/sop_sql_migration_operations.md`.
- Added the diagnostic to the media performance SOP as the PostgREST-specific follow-up after `sql/check_database_egress_query_stats.sql`.
- Production run command shape:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 \
  -f sql/check_postgrest_payload_projection_risk.sql
```

Production payload-size findings:

- `ai_generations._full_row`: 8,150 rows, average about `11.18KB`, p50 about `1.92KB`, p99 about `222.40KB`, max about `425.50KB`, total about `86.89MB`.
- `ai_generations.metadata`: average about `10.33KB`, p50 about `1.06KB`, p99 about `221.74KB`, max about `424.96KB`, total about `80.27MB`.
- `generation_projection._full_row`: 2,592 rows, average about `34.27KB`, p50 about `3.94KB`, p99 about `249.37KB`, max about `424.25KB`, total about `84.71MB`.
- `generation_projection.generation_replay`: average about `12.35KB`, p90 about `55.87KB`, p99 about `85.30KB`, total about `30.52MB`.
- `generation_projection.style_context`: average about `11.23KB`, p90 about `50.53KB`, p99 about `87.72KB`, total about `27.77MB`.
- `generation_projection.workflow_reload`: average about `8.79KB`, p90 about `53.34KB`, p99 about `90.55KB`, total about `21.73MB`.
- Smaller delivery/display fields such as `preview_url`, `preview_storage_path`, `full_storage_path`, and `result_urls` are much smaller than the heavy replay/reload/style payload columns.

Production hot query projection findings:

- `generation_projection | selects_heavy_payload_columns | workspace_runtime_key`: about `70.7k` calls since `pg_stat_statements` reset, one row per call, weighted mean about `19.7ms`.
- `ai_generations | selects_heavy_payload_columns | request_id`: about `48.0k` calls, one row per call, weighted mean about `36.4ms`.
- Smaller/narrower `generation_projection` request/project/status classes also exist, but they are not the top PostgREST payload-risk class.

Source trace findings:

- `frontend/features/ai-studio/logic/generatedMediaAuthority.ts` defines `GENERATION_PROJECTION_DELIVERY_SELECT_COLUMN_LIST`, which currently includes heavy columns:
  - `generation_replay`
  - `workflow_reload`
  - `character_context`
  - `style_context`
  - `error_payload`
- `listVisibleGeneratedOutputs` uses this delivery select for workspace/runtime hydration and maps rows through `toHydratedGeneratedOutput`.
- The hydration path has valid reasons to use those heavy fields for workflow reload, style context, character context, audio/music restore, and replay metadata.
- `toProjectionDelivery` does not need the heavy replay/reload/style columns, so delivery-only batch resolution is a possible lower-risk optimization, but it is not proven to be the dominant production egress shape.
- `frontend/lib/server/api/falStatusProxy.ts` reads `ai_generations.metadata` for FAL provider-returned status/response base URLs, and `frontend/lib/server/api/generationReconcile.ts` also has metadata-backed project reconciliation fallback paths. Those are plausible contributors to the hot `ai_generations | metadata | request_id` class.

Interpretation:

- The current PostgREST overage is not explained by huge multi-row result sets. It is better explained by many one-row calls that often select heavy JSON/text payload columns.
- The likely root fix is not an index migration. Hosted hot-path indexes already exist and the hot classes are one-row shaped.
- The likely root fix is a payload/cadence split:
  - keep lightweight display/status/delivery hydration on the frequent path
  - fetch heavy replay/reload/style/metadata payloads only when workflow reload, restore, or a specific UI action actually needs them
  - dedupe or back off repeated hydration/status calls without degrading visible generation progress
- This is launch-critical AI Studio behavior, so Nuclo did not patch runtime code in this report pass. A rushed change could break restore/reload semantics while only guessing at egress impact.

## Stop Boundary

On 2026-06-20, the local worktree had Gearball-owned dirty files in the exact media delivery seam:

- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/resolve-previews.ts`
- `frontend/pages/api/media/sign-batch.ts`

On 2026-06-21, the scoped worktree check showed those files clean, so Nuclo resumed source inspection. Future Nuclo work should still stop if these files become dirty again under Gearball ownership, because implementation-grade root-cause work depends on them if the cause is signed URL churn, preview resolution, or media API selection behavior.

## Next Proof Needed

After the current production dashboard tooltip proof:

1. Re-run the production egress audit and confirm object delivery and video variant coverage against the settled deployed code path.
2. Treat the production project as the root surface: the Supabase Dashboard production filter showed `402.211 GB` egress out of `403.697 GB` all-project egress for the current cycle.
3. Treat PostgREST as the current primary overage lane for `14 Jun` through `21 Jun`; the captured dashboard tooltips show PostgREST dominating the sustained daily overage.
4. Use `sql/check_database_egress_query_stats.sql` and `sql/check_postgrest_payload_projection_risk.sql` together before any runtime patch:
   - Start with the hot shapes now exposed by `sql/check_database_egress_query_stats.sql`: `generation_projection_workspace_runtime_key`, `ai_generations_request_lookup`, and project generation hydration.
   - Then confirm whether those shapes still select heavy payload columns with `sql/check_postgrest_payload_projection_risk.sql`.
   - Deduplicate `vercel logs --json` by `id` before using Vercel route logs as request-volume evidence.
   - Use `sql/check_scheduler_egress_activity.sql` before changing Supabase Cron cadence; current production proof does not show duplicate scheduler jobs.
5. For the implementation pass, inspect generated-output hydration and status/reconcile routes before changing polling cadence:
   - `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`
   - `frontend/lib/server/api/falStatusProxy.ts`
   - `frontend/lib/server/api/generationReconcile.ts`
6. Preferred implementation shape if code work is approved: split frequent lightweight display/status hydration from heavy workflow reload/replay/style metadata hydration; do not remove restore metadata or globally slow generation progress polling without user-flow proof.
7. Keep Storage as a secondary follow-up for the `11 Jun` Storage-heavy spike. If Storage reappears as the dominant current driver and dirty media files are clean, trace the canonical media delivery path before changing anything:
   - `frontend/pages/api/media/list.ts`
   - `frontend/pages/api/media/resolve-previews.ts`
   - `frontend/pages/api/media/sign-batch.ts`
   - any UI surface that preloads video originals or asks for original URLs when poster/preview variants would do.
8. Treat the authenticated media-panel captures as current proof for the open path until a new deploy or major media-runtime change lands. Re-run them after any signing/list-orchestration patch.

## Optional Dashboard Refresh Packet

The daily dashboard tooltip capture is no longer the blocker for this lane. Use this packet only when refreshing the proof after a deploy, after a large usage change, or if Supabase Usage values drift materially.

Capture target:

- Supabase organization: `Sleepy Sea Monster`.
- Supabase project: ShortPulse production, project ref `ftgrqgjrchpimronuhop`.
- Supabase Dashboard area: Usage, filtered to the production project rather than all projects.
- Billing cycle/dates: the high-egress billing cycle shown in the original screenshot, especially the highest daily bars.

Screenshots or copied values to refresh:

- Usage Summary service split for the billing cycle:
  - Egress used. Current production-filtered dashboard value: `402.211 GB`.
  - Cached egress used. Current production-filtered dashboard value: `29.318 GB`.
  - Storage Image Transformations used. Current production-filtered dashboard value: `0`.
  - Storage Size. Current production-filtered dashboard value: `2.375 GB`.
  - Any visible per-service totals for Database, Storage, Auth, Realtime, Edge Functions, Pooler, and Log Drains.
- Daily egress bar hover/details for the highest days, if values changed after the 2026-06-21 capture:
  - The date.
  - Total egress for that day.
  - Service breakdown shown in the hover/details panel.
  - Whether the bar includes cached egress separately or stacked in the same daily chart.
- If available in Observability/Logs Explorer:
  - Top API paths for the same high-egress day.
  - Top Storage/API paths if Supabase exposes a path breakdown.
  - Do not export raw logs with user ids, tokens, signed URLs, or request bodies into the repo.

Decision rule after refresh:

- If Storage dominates again, trace repeated object delivery/cache bypass/direct original fetches. Prioritize AI Studio generated images, video originals missing durable pairs, and any non-app-owned storage URL path.
- If Database/PostgREST/Pooler continues to dominate, trace generated-output workspace restore, active task polling/status lookup, project generation hydration cadence, and heavy payload projection. Do not add indexes blindly; hosted hot-path indexes already exist.
- If cached egress dominates, inspect public/app-owned cache headers and CDN behavior rather than private signed-url churn first.
- If Storage Image Transformations moved again, treat it as a regression because Supabase image transformations are prohibited for all ShortPulse paths.

## Non-Goals

- Do not use Supabase image transformations.
- Do not change current UI/UX without a concrete root-cause-backed plan.
- Do not patch around Gearball-owned dirty work.
- Do not use `vercel env run` as production proof for Supabase targeting; local env contamination has already been observed in this lane. Use a temporary `vercel env pull` file, verify the project ref, run the read-only audit, then delete the temp file.

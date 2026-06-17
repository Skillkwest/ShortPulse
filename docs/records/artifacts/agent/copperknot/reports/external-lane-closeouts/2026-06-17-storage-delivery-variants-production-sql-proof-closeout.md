# Storage, Delivery, And Variants Production/SQL Proof Closeout

## Lane

- Lane id: `storage-delivery-variants-production-sql-proof-2026-06-04`
- Source handoff: `docs/agents/copperknot/handoffs/2026-06-04-storage-delivery-variants-production-sql-proof.md`
- Execution status: `production proof found residual blocker`
- Production target: `https://www.shortpulse.ai` and Supabase project ref `ftgrqgjrchpimronuhop`
- Freshness: `2026-06-17T14:31:34Z`

## Systems Touched

- Launch system: `Storage, delivery, and variants`
- Operator systems:
  - `media_upload_list_sign_resolve`
  - `media_derivative_worker`
  - `security_boundary_auth_rls_storage`

## Files Changed

- Added this closeout report only.

## Production SQL/Data Checks

`psql` was unavailable in the local shell, so the read-only SQL checks were executed as production Supabase service-role REST aggregate equivalents over the same tables and columns used by the canonical SQL scripts. No raw ids, storage paths, signed URLs, tokens, or secrets were printed or retained in this report.

Production data scanned:

- `media_files`: `3129` rows
- `media_asset_variants`: `5450` rows

Storage-scope drift equivalent to `sql/check_media_storage_scope_drift.sql`:

- `media_files.storage_path_empty`: `0`
- `media_files.storage_path_not_user_scoped`: `0`
- `media_files.storage_path_leading_slash`: `0`
- `media_files.storage_path_traversal_segment`: `0`
- `media_files.storage_path_backslash`: `0`
- `media_files.variant_hint_invalid_shape`: `0`
- `media_asset_variants.storage_path_invalid_shape`: `0`

Derivative backlog equivalent to `sql/check_media_derivative_processing_backlog.sql`:

- `ai_studio|ready`: `1745`
- `upload|ready`: `842`
- pending/processing/failed image rows without thumb variants: `0`
- max attempts: `ai_studio=2`, `upload=1`

Terminal failures equivalent to `sql/check_media_derivative_terminal_failures.sql`:

- terminal failed image rows: `0`

Variant coverage equivalent to `sql/check_media_preview_variant_coverage_and_size.sql`:

- `ai_studio` images: `1745/1745` have thumb variants (`100%`)
- `upload` images: `842/842` have thumb variants (`100%`)
- `ai_studio` videos: `135/199` have paired poster+preview variants (`67.84%`)
- `upload` videos: `1/14` have paired poster+preview variants (`7.14%`)

Interpretation: production storage path shape, image derivative queue state, and terminal image derivative posture are healthy at the row/metadata level. Video preview-loop/poster coverage remains a watch/backlog item, especially for uploaded videos.

## Authenticated Production Media Checks

Using the configured production audit account against `https://www.shortpulse.ai`:

- `POST /api/media/list`
  - status: `200`
  - sample: `8` rows
  - returned numeric `libraryTotalCount`
  - initial signed seed count: `2`
- `POST /api/media/sign-batch`
  - status: `200`
  - requested path count: `6`
  - returned signed URL count: `6`
  - preview profile header: `media-library-panel-image-card`
- `POST /api/media/resolve-previews`
  - status: `200`
  - requested id count: `6`
  - returned signed URL count: `0`
  - fallback lookups observed: `7` to `11` across mixed/image samples
- Dummy-secret probe for `POST /api/internal/media-derivatives/run`
  - status: `401`
  - result: fail-closed when unauthorized

URL class summary for list/sign samples:

- Supabase `/storage/v1/render/image/` URLs observed: `0`
- Next optimizer `/_next/image` URLs observed: `0`
- Signed Supabase object URLs observed from list/sign samples: `8` in the mixed sample, `6` in the image-only sign sample

Signed delivery checks:

- Image sign-batch sample, thumb variant paths:
  - signed count: `6`
  - `HEAD 200`: `1`
  - `HEAD 400`: `5`
- Same image rows, original paths:
  - signed count: `6`
  - `HEAD 200`: `6`

Sanitized production stale-thumb audit:

- Global recent image thumb sample:
  - inspected rows: `50`
  - thumb `HEAD 200`: `50`
  - recoverable stale thumbs: `0`
- Authenticated audit-account image thumb sample:
  - inspected rows: `50`
  - thumb `HEAD 200`: `17`
  - thumb `HEAD 400`: `33`
  - originals for failed thumbs `HEAD 200`: `33`
  - recoverable stale thumbs: `33`
  - recoverable stale thumbs by source: `upload=22`, `ai_studio=11`
  - recoverable stale thumbs by processing status: `ready=33`

Interpretation: production image derivative metadata looks complete, but at least one authenticated user has ready image rows whose `thumb_variant_path` is stale or missing in storage while the original object still delivers. This is not a Supabase transform issue; it is durable variant delivery drift. Current list/sign behavior can mint signed URLs for broken thumb paths, so the row-level coverage checks alone are insufficient launch proof.

## Transform-Prohibition Evidence

Observed during this run:

- No `/storage/v1/render/image/` URLs in authenticated list/sign/HEAD samples.
- No `/_next/image` wrapper URLs in authenticated list/sign/HEAD samples.
- Local guard validation passed:
  - `npm -C frontend run test:supabase-transform-guard`
  - Result: `1` file passed, `3` tests passed.

## Validation Commands

- `npm -C frontend run test:supabase-transform-guard`
- Production Supabase service-role read-only aggregate check for:
  - storage-scope drift
  - derivative backlog
  - terminal derivative failures
  - preview variant coverage and size
- Authenticated production route probes for:
  - `/api/media/list`
  - `/api/media/sign-batch`
  - `/api/media/resolve-previews`
- Production signed URL `HEAD` checks for sampled thumb/original paths.
- Dummy-secret production probe for `/api/internal/media-derivatives/run`.

## Self-Audit Findings

- Literal `psql -f` output was not captured because `psql` is not installed in this shell and the `storage`/`cron` schemas are not exposed through PostgREST for direct schema queries. The service-role REST aggregates are still production data evidence, but final operator proof may rerun the canonical SQL files through a SQL client.
- The real derivative worker secret was not invoked. That route can mutate rows when backlog exists, so an authorized run remains an approval/operations boundary.
- Storage-scope drift and image derivative queue health are strong, but they do not prove signed object delivery. The stale-thumb audit shows why object-level delivery checks are required.
- The stale-thumb issue appears account/sample-scoped rather than a fresh global derivative backlog: the global recent `50` row sample was healthy, while the authenticated audit account sample had `33/50` recoverable stale ready thumbs.

## Residual Risk

- Authenticated media browsing can still select broken thumb variant URLs for some ready image rows, causing blank/failed previews until a fallback, repair, or requeue path intervenes.
- `/api/media/resolve-previews` returned `200` but no URLs for sampled listed image ids, so it did not rescue the stale-thumb condition in this production check.
- Uploaded-video durable poster/preview coverage is weak (`1/14` paired variants), and AI Studio video paired coverage is incomplete (`135/199`).
- Scheduler liveness and authorized derivative worker success were not proven in this run because direct SQL access to `cron` was unavailable and the real worker secret was not invoked.

## Recommended Copperknot Decision

Keep `Storage, delivery, and variants` at `Below Floor`.

Recommended next owner/action:

- Holomony/media-health lane: repair or requeue stale ready image thumbs for affected rows and decide whether runtime preview fallback should verify delivery before trusting `thumb_variant_path`.
- Nuclo/operator lane if needed: rerun the canonical SQL files and scheduler health check through a SQL client against production, then perform an explicitly approved authorized derivative worker no-op/health run.
- Copperknot should not lift this system above `Below Floor` until authenticated media list/sign/resolve plus signed object delivery prove that durable variants or originals render reliably without Supabase image transformations.

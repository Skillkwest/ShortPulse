# Media Optimization Schema and Migration Spec

Status: draft  
Date: February 12, 2026  
Scope: Supabase schema/storage changes required for derivative-first media delivery

## Purpose
Specify the database/storage deltas, migration ordering, backfill strategy, and rollback plan for the media optimization architecture.

## Design constraints
- Preserve private bucket model and per-user isolation.
- Keep `media_files` as canonical asset row.
- Maintain compatibility with existing tabs and `source` values (`upload`, `private_upload`, `ai_studio`).
- Avoid breaking current read/write flows during rollout.

## Proposed schema changes
### 1) `media_files` additions
Add fields to support processing state and lightweight listing hints:
- `processing_status` text not null default `ready`
  - allowed: `pending`, `processing`, `ready`, `failed`
- `width` int null
- `height` int null
- `duration_seconds` numeric null
- `poster_variant_path` text null
- `thumb_variant_path` text null
- `preview_variant_path` text null

Indexes:
- `(user_id, processing_status, created_at desc)`
- `(user_id, source, processing_status, created_at desc)`

### 2) New table: `media_asset_variants`
Columns:
- `id` uuid pk default `gen_random_uuid()`
- `media_file_id` uuid not null references `media_files(id)` on delete cascade
- `user_id` uuid not null default `auth.uid()`
- `variant_kind` text not null
- `storage_path` text not null
- `mime_type` text not null
- `width` int null
- `height` int null
- `duration_seconds` numeric null
- `byte_size` bigint null
- `status` text not null default `ready` (`pending`, `ready`, `failed`)
- `metadata` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Recommended unique/index constraints:
- unique `(media_file_id, variant_kind)` where status != `failed` (or strict unique if preferred)
- index `(user_id, variant_kind, status, created_at desc)`
- index `(media_file_id, status, updated_at desc)`

RLS:
- mirror `media_files` ownership model:
  - select/insert/update/delete where `user_id = auth.uid()`

### 3) Storage path conventions (private bucket)
- Originals:
  - `<uid>/uploads/images/...`
  - `<uid>/uploads/videos/...`
  - `<uid>/private/images/...`
  - `<uid>/generations/images/...`
  - `<uid>/generations/videos/...`
- Variants:
  - `<uid>/variants/<media_file_id>/<variant_kind>/<filename>`

No new bucket required; retain `media_library` private bucket policies.

## Variant profile (initial)
- Images:
  - `thumb_240`
  - `thumb_480` (optional)
- Videos:
  - `poster_720`
  - `preview_loop_360p` (for grid autoplay)
  - `playback_720p` (detail modal default)

## Migration plan
Proposed migration sequence (next available after 004):
1. `005_add_media_processing_and_variants.sql`
2. `006_backfill_media_variant_hints.sql` (optional helper SQL + queue priming)

Rollback pair:
- `sql/migrations/rollback/005_add_media_processing_and_variants_rollback.sql`
- `sql/migrations/rollback/006_backfill_media_variant_hints_rollback.sql` (no-op; data backfill rollback requires snapshots)

## Backfill strategy
Stages:
1. Schema deploy (no read-path switch).
2. Start derivative generation for new uploads only.
3. Backfill existing media in descending recency order.
4. Enable derivative-first reads behind feature flag.
5. Expand rollout to all users after metrics pass.

Backfill priority:
- first 180 days of assets,
- then long-tail assets.

Failure policy:
- Mark row `processing_status = failed` when retries are exhausted.
- Preserve original media usability.
- Allow manual or scheduled retry.

## Read-path compatibility during migration
During transition:
- If `thumb/poster/preview` path exists and signs successfully, use variant.
- Else fallback to original `storage_path`.
- Never block media visibility on missing variants.

## RLS and security checks
Required validations after migration:
- Cross-user read attempts for `media_asset_variants` return zero rows.
- Storage access still scoped to `auth.uid()` folder prefix.
- Unauthenticated users cannot list or sign user assets.

## Operational considerations
- Add monitoring for:
  - variant generation throughput,
  - queue lag,
  - variant failure rate by `variant_kind`,
  - fallback-to-original rate.
- Add kill switch:
  - `NEXT_PUBLIC_MEDIA_VARIANT_PREFERRED=false` to force original-path reads.

## Docs required when implementation starts
When SQL/code lands, update:
- `docs/supabase_full_schema.sql`
- `docs/data-dictionary.md`
- `docs/security-checklist.md`
- `docs/database-migrations.md` (required migration set)
- Relevant SOPs for media library and AI Studio reference flows

# Data Dictionary

Purpose: define the Supabase tables and analytics fields used by ShortPulse’s Next.js app and internal API routes.

## Supabase tables

### saved_creators

- `id` (uuid, pk)
- `handle` (text): Creator handle stored in normalized form.
- `platform` (text): instagram | tiktok | youtube.
- `followers` (int, default 0)
- `avg_views` (int, default 0)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### media_files

- `id` (uuid, pk, default `gen_random_uuid()`)
- `filename` (text): Friendly file name stored alongside the object.
- `storage_path` (text): Full path in the `media_library` bucket (prefix with `auth.uid()`). Private tab uploads use `<auth.uid()>/private/images/<filename>`.
- `file_type` (text): image | video (or MIME-derived fallback).
- `file_size` (bigint, nullable): Bytes.
- `source` (text, default `upload`): upload | private_upload | ai_studio | character_reference | character_generation | character_quickswap.
- `source_ref` (uuid, nullable): References `ai_generations.id` when source is `ai_studio`.
- `prompt_id` (uuid, nullable): References `media_prompts.id` when saved from a prompt.
- `metadata` (jsonb, default `{}`): Provider/model metadata and any generation context.
  - Canonical image dimension keys for masonry surfaces: `width` (px), `height` (px), `aspect_ratio` (`width/height`).
  - Legacy dimension keys may still appear (`image_width`, `image_height`, `pixel_width`, `pixel_height`, nested `dimensions.width/height`) and are normalized by migration `061_backfill_media_image_dimensions_metadata.sql`.
  - Character profile uploads store `character_id` and `role = character_profile` for traceability.
  - Migration-tagged All Media backfill rows may include:
    - `backfill_migration = "064_backfill_media_files_from_storage_objects"`
    - `backfill_storage_object_id` (origin `storage.objects.id`)
    - `backfill_storage_object_created_at` (origin object timestamp)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `processing_status` (text, default `ready`): pending | processing | ready | failed.
- `processing_attempts` (int, default `0`): Derivative worker attempt counter (non-negative).
- `processing_next_retry_at` (timestamptz, nullable): Next derivative claim eligibility timestamp.
- `processing_last_error` (text, nullable): Last derivative worker failure message.
- `processing_updated_at` (timestamptz, default `now()`): Last derivative worker status update timestamp.
- `thumb_variant_path` (text, nullable): Preferred image-card derivative storage path.
- `poster_variant_path` (text, nullable): Preferred video-poster derivative storage path.
- `preview_variant_path` (text, nullable): Preferred video-preview derivative storage path.
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity checks:
  - `source` constrained to `upload | private_upload | ai_studio | character_reference | character_generation | character_quickswap`.
  - `source` is non-null with default `upload` (see `sql/migrations/007_harden_media_source_and_usage_rpc.sql`).
  - `source = private_upload` requires `file_type = image` and `storage_path` under `<user_id>/private/images/...`.
  - Any row with `storage_path` under `<user_id>/private/images/...` must use `source = private_upload`.
  - `source = character_reference` requires `file_type = image`, `storage_path` under `<user_id>/characters/...`, and metadata keys for `character_id`, `character_sheet_id`, and `slot_key` (see `sql/migrations/010_harden_character_reference_media_integrity.sql`, `sql/migrations/012_add_character_sheet_aliases_and_compat.sql`, and `sql/migrations/122_retire_character_sheet_alias_compat.sql`).
  - `source = character_quickswap` requires `file_type = image`, `storage_path` under `<user_id>/characters/<character_id>/quickswap/...`, and metadata key `character_id` (see `sql/migrations/045_add_character_quickswap_deck.sql`).
  - Legacy All Media convergence: durable missing rows can be diagnosed with `sql/check_media_all_media_completeness_drift.sql` and backfilled with `sql/migrations/064_backfill_media_files_from_storage_objects.sql`.
  - Migration `065_add_media_derivative_processing_fields.sql` adds derivative retry/lease control fields and an insert-default trigger that marks new image rows `pending` for derivative processing.

### media_asset_variants

- `id` (uuid, pk, default `gen_random_uuid()`)
- `media_file_id` (uuid): Parent media row with cascade delete.
- `user_id` (uuid): Owner for RLS scoping and scoped FK parity with `media_files`.
- `variant_kind` (text): `original | thumb_240 | thumb_480 | poster_720 | preview_loop_360p | playback_720p | admitted_reference_25mb`.
- `storage_path` (text): User-scoped variant object path in `media_library`.
- `mime_type` (text): Stored variant MIME type.
- `width` / `height` (int, nullable): Variant dimensions.
- `duration_seconds` (numeric, nullable): Variant duration (video variants).
- `byte_size` (bigint, nullable): Variant file size.
- `status` (text): pending | ready | failed.
- `metadata` (jsonb, default `{}`): Variant generation metadata. `admitted_reference_25mb` stores generated-image product-use admission metadata for provider/reference reuse only; the parent `media_files` row remains the full-quality authority for detail, save, download, and export behavior.
- `created_at` / `updated_at` (timestamptz).
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### Media usage RPCs

- `get_media_library_usage_bytes()`: returns total `file_size` bytes for the authenticated user’s `media_files` rows.
- Used by: dashboard/account storage surfaces for accurate usage display independent of paged list caches.

### characters

- `id` (uuid, pk)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `name` (text): Character display name.
- `status` (text): draft | active | archived.
- `active_character_sheet_id` (uuid, nullable): Active character sheet pointer for generation workflows.
- `metadata` (jsonb, default `{}`)
  - Character profile image linkage keys:
    - `profile_image_storage_path` (text path in `media_library`)
    - `profile_image_character_media_id` (canonical uuid of linked `character_media_assets` row)
    - `profile_image_zoom` (number; persisted profile crop zoom)
    - `profile_image_offset_x` (number; persisted profile crop horizontal offset)
    - `profile_image_offset_y` (number; persisted profile crop vertical offset)
  - Character sheet assignment keys:
    - `character_sheet_assignments` (canonical key used by current Character Manager UI)
  - Character sheet preset key:
    - `character_sheet_presets_v1`
      - `active_preset_id`: `"1"`..`"10"`
      - `presets`: record keyed by preset id (`1..10`)
      - `tab_order`: visible preset-tab id list (`1..10` ids, default `["1"]` for new users)
      - `tab_labels`: display label map keyed by preset id (`1..10`)
      - `tab_descriptions`: per-preset character-description map keyed by preset id (`1..10`, max 150 chars each)
      - Each preset stores `portrait | close_up | front_shot`
      - Each zone is `null` or `{ character_media_id, storage_path }`
      - Preset references are user-scoped and used by AI Studio Character Mode injection.
      - Character Mode description injection uses active preset `tab_descriptions[active_preset_id]`; falls back to legacy `characters.description` when active preset description is empty.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### elements

- `id` (uuid, pk)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `name` (text): Element display name.
- `alias` (text): Persisted legacy workflow token retained for compatibility with older prompt/session data. New live token behavior derives from `name`; on rename this field may preserve the previous name-derived token so older prompts can still rewrite safely.
- `status` (text): draft | ready | archived.
- `metadata` (jsonb, default `{}`)
  - Element profile image linkage keys:
    - `profile_image_storage_path` (text path in `media_library`)
    - `profile_image_media_asset_id` (uuid of linked `element_media_assets` row)
    - `profile_image_zoom` (number; persisted profile crop zoom)
    - `profile_image_offset_x` (number; persisted profile crop horizontal offset)
    - `profile_image_offset_y` (number; persisted profile crop vertical offset)
  - Element reference metadata keys:
    - `active_reference_set_id` (`"1"` today; retained only for persistence compatibility)
    - `active_reference_set_asset_type` (`image | video` for the persisted compatibility row)
    - `reference_set_tab_order` (currently persisted as `["1"]` for compatibility)
  - Active product/runtime contract:
    - one `description`
    - one `assetType`
    - one `imageReferenceUrls` collection
    - one optional `videoReferenceUrl`
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### element_reference_sets

- `id` (uuid, pk)
- `element_id` (uuid): Parent element.
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `set_key` (text): Compatibility set id. The active product contract persists only `"1"` today.
- `label` (text): Compatibility label for the persisted set row.
- `description` (text): Persisted description for the active Elements reference collection.
- `asset_type` (text): image | video for the active Elements reference collection.
- `deck_reference_urls` (jsonb array): Legacy compatibility alias retained to avoid schema churn. Mirrors image references when persisted and is merged back during hydration.
- `image_reference_urls` (jsonb array): Saved image references for the active Elements collection.
- `video_reference_url` (text, nullable): Saved motion-reference URL when the active collection is video-backed.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### element_media_assets

- `id` (uuid, pk)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `element_id` (uuid): Parent element.
- `asset_kind` (text): `profile`.
- `storage_path` (text): Canonical private object path under `<user_id>/elements/<element_id>/...`.
- `filename` (text)
- `file_type` (text)
- `file_size` (bigint)
- `metadata` (jsonb, default `{}`)
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### character_reference_packs

- `id` (uuid, pk)
- `character_id` (uuid): Parent character.
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `version` (int, >0): Draft/version history index per character.
- `status` (text): draft | validating | ready | failed.
- `consistency_score` (numeric, nullable)
- `seedream_payload` (jsonb, default `{}`)
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### character_reference_images

- `id` (uuid, pk)
- `character_id` (uuid): Parent character.
- `character_sheet_id` (uuid): Parent character sheet (canonical).
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `slot_key` (text): Fixed character reference slot key.
- `character_media_id` (uuid): Required linked `character_media_assets` row.
- `storage_path` (text): Canonical private object path under `<user_id>/characters/<character_id>/<character_sheet_id>/<slot_key>/...`.
- `validation_status` (text): pending | pass | warn | fail.
- `validation_notes` (jsonb, default `{}`)
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - `storage_path` must match the character/pack/slot path convention.
  - Trigger `trg_character_reference_images_media_integrity` enforces that linked `character_media_assets` row stays user-owned, uses `asset_kind = sheet_slot`, and has matching character/path linkage.

### character_quick_swap_items

- `id` (uuid, pk)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `character_id` (uuid): Parent character.
- `character_media_id` (uuid): Required linked `character_media_assets` row.
- `storage_path` (text): Canonical private object path under `<user_id>/characters/<character_id>/quickswap/...`.
- `status` (text): active | archived.
- `created_at` (timestamptz): Insertion timestamp used for active/archive ordering.
- `archived_at` (timestamptz, nullable): Set when item is archived.
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Notes:
  - QuickSwap Deck keeps newest 500 rows active; overflow rows are archived.
  - Legacy `character_reference_images` remains compatibility data for fixed-slot fallback only.
  - Trigger `trg_character_quick_swap_items_media_integrity` enforces that linked `character_media_assets` row stays user-owned, uses `asset_kind = quickswap`, and matches the stored character/path linkage.

### character_generation_jobs

- `id` (uuid, pk)
- `character_id` (uuid): Parent character.
- `character_sheet_id` (uuid): Parent character sheet used by generation (canonical).
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `provider` (text), `request_id` (text, nullable), `status` (text), `prompt` (text)
- `output_media_file_id` (uuid, nullable): Linked generation output in `media_files`.
- `metadata` (jsonb, default `{}`)
- `created_at` / `updated_at` / `completed_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### media_prompts

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `title` (text, nullable): Optional friendly label.
- `prompt_text` (text): Saved prompt body.
- `mode` (text): text | image | video.
- `model_id` (text, nullable): Model at save time.
- `source` (text, default `manual`): manual | ai_studio | agent.
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### media_folders

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, references `auth.users.id`): Owner for RLS scoping.
- `name` (text): Custom folder display name (`btrim(name)`, length `1..64`).
- `parent_folder_id` (uuid, nullable): Parent custom folder id. `NULL` means the folder lives directly under the virtual `All Media` root.
- `created_at` / `updated_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Sibling-scoped case-insensitive uniqueness on folder name (`unique (user_id, parent_folder_id, lower(name))`, with `NULL` parent representing root-level children of `All Media`).
  - `(id, user_id)` unique index is used by scoped membership foreign keys.
  - `(parent_folder_id, user_id)` references `media_folders (id, user_id)` so parent ancestry is same-user only.
  - Self-parenting is rejected.
  - Recursive cycle guard trigger rejects folder hierarchies that would introduce ancestry loops.

### media_folder_media_items

- `folder_id` (uuid, pk segment): References `media_folders.id` with cascade delete.
- `media_file_id` (uuid, pk segment): References `media_files.id` with cascade delete.
- `user_id` (uuid, references `auth.users.id`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- RLS: select/insert/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Composite scoped FKs enforce same-user ownership for both folder and media row via `(folder_id, user_id)` and `(media_file_id, user_id)`.
  - Current runtime still supports multi-folder membership without deleting `media_files` on unassign.
  - Real nested hierarchy work now lives on `media_folders.parent_folder_id`; membership semantics remain a compatibility/runtime concern until the folder-contents cutover lands.

### media_folder_prompt_items

- `folder_id` (uuid, pk segment): References `media_folders.id` with cascade delete.
- `prompt_id` (uuid, pk segment): References `media_prompts.id` with cascade delete.
- `user_id` (uuid, references `auth.users.id`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- RLS: select/insert/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Composite scoped FKs enforce same-user ownership for both folder and prompt row via `(folder_id, user_id)` and `(prompt_id, user_id)`.
  - Current runtime still supports multi-folder membership without deleting `media_prompts` on unassign.
  - Real nested hierarchy work now lives on `media_folders.parent_folder_id`; prompt membership semantics remain a compatibility/runtime concern until the folder-contents cutover lands.

### ai_generations

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `mode` (text): image | video.
- `provider` (text): fal | kie | ... (`kei` may still appear in older historical rows or legacy docs)
- `model_id` (text): Model used to generate.
- `prompt_text` (text): Prompt used for the generation.
- `aspect` (text, nullable)
- `duration_seconds` (int, nullable)
- `resolution` (text, nullable)
- `request_id` (text, nullable)
- `status` (text, default `pending`): pending | submitted | running | success | fail.
- `error_message` (text, nullable)
- `failure_reason_code` (text, nullable): Normalized failure code for retrieval/persist/recovery incidents.
- `recovery_state` (text, not null, default `none`): none | queued | recovering | recovered | exhausted.
- `recovery_attempts` (int, not null, default `0`): Number of automated/manual recovery attempts.
- `last_recovery_at` (timestamptz, nullable): Last recovery attempt timestamp.
- `next_recovery_at` (timestamptz, nullable): Next reconciler eligibility timestamp.
- `last_media_detected_at` (timestamptz, nullable): Last timestamp where provider media was observed.
- `created_at` (timestamptz, default now)
- `completed_at` (timestamptz, nullable)
- `metadata` (jsonb, default `{}`): Provider payload summary plus compact retrieval/recovery probe trace snapshots.
  - Historical rows may still contain compatibility fields such as `result_urls` and `media_file_ids` from the pre-canonical-output transition window.
  - Admin stats v1 submit-context keys:
    - `shortpulse_context.selected_tool`
    - `shortpulse_context.mode`
    - `shortpulse_context.project_id_present`
    - `shortpulse_context.is_character_mode`
    - `shortpulse_context.selected_character_id`
    - `shortpulse_context.has_style`
    - `shortpulse_context.style_id`
    - `shortpulse_context.reference_count`
  - Current pricing-observability keys may also appear:
    - `shortpulse_context.displayed_billed_credits`
    - `shortpulse_context.pricing_display_source`
    - `shortpulse_context.pricing_policy_ready`
    - `pricing_observability.displayed_billed_credits`
    - `pricing_observability.actual_billed_credits`
    - `pricing_observability.delta_credits`
    - `pricing_observability.mismatch`
    - `pricing_observability.pricing_display_source`
    - `pricing_observability.pricing_policy_ready`
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Constraints and indexes:
  - `ai_generations_recovery_state_check` enforces `recovery_state` enum values.
  - `ai_generations_recovery_attempts_non_negative_check` enforces non-negative attempts.
  - Unique partial index on `(user_id, request_id)` where `request_id is not null`.
  - Composite unique index on `(id, user_id)` supports project-scoped generation association foreign keys.
  - Reconciler scan index on `(recovery_state, next_recovery_at, created_at)`.
  - Trigger `trg_ai_generations_enforce_status_transition` blocks illegal status transitions, with guarded recovery override for `fail -> success` when `failure_reason_code='terminal_success_no_media'` and recovery state is converging to `recovered`.

### projects

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid): Owner for RLS scoping.
- `title` (text): Server-normalized project display title.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Constraints and indexes:
  - Composite unique index on `(id, user_id)` supports same-user project membership foreign keys.
  - Dashboard lists are ordered by `updated_at desc`.

### project_workspace_states

- `project_id` (uuid, pk segment): References the parent `projects` row.
- `user_id` (uuid): Owner for RLS scoping and same-user FK parity with `projects`.
- `schema_version` (int): Current persisted AI Studio workspace envelope version.
- `snapshot` (jsonb object): Project-owned workspace snapshot payload.
- `snapshot_updated_at` (timestamptz): Server-authoritative freshness timestamp derived from the saved snapshot's own `updatedAt` field.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Notes:
  - Current payload still reuses the AI Studio session snapshot envelope as the migration boundary.
  - Stale/out-of-order autosave completions must not overwrite a row whose `snapshot_updated_at` is newer.
  - Workspace reads return the sanitized saved snapshot without blocking on generated-output projection/media refresh.

### project_media_items

- `project_id` (uuid, pk segment): Parent project.
- `media_file_id` (uuid, pk segment): Associated saved media row.
- `user_id` (uuid): Owner for RLS scoping and same-user FK parity.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Composite scoped FKs enforce same-user ownership across the project row and target `media_files` row.
  - Used for project-owned saved-media association without changing global Media Library ownership.

### project_prompt_items

- `project_id` (uuid, pk segment): Parent project.
- `prompt_id` (uuid, pk segment): Associated saved prompt row.
- `user_id` (uuid): Owner for RLS scoping and same-user FK parity.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Composite scoped FKs enforce same-user ownership across the project row and target `media_prompts` row.
  - Used for project-owned saved-prompt association without changing global prompt library ownership.

### project_generation_items

- `project_id` (uuid, pk segment): Parent project.
- `generation_id` (uuid, pk segment): Associated generated output lineage row in `ai_generations`.
- `user_id` (uuid): Owner for RLS scoping and same-user FK parity.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Composite scoped FKs enforce same-user ownership across the project row and target `ai_generations` row.
  - Workspace saves backfill this table from restore-relevant `generationId` values already in the snapshot.
  - AI Studio's post-bootstrap generated-output maintenance uses this table to refresh delivery only for generations explicitly associated to the active project.

### generation_attempts

- `id` (uuid, pk, default `gen_random_uuid()`)
- `generation_id` (uuid): Parent `ai_generations` row with cascade delete.
- `user_id` (uuid): Owner for RLS scoping.
- `attempt_number` (int): Monotonic attempt lineage index per generation (`>= 1`).
- `provider` (text): Provider family for the accepted attempt (`fal`, `kie`, ...).
- `model_id` (text): Model used for the attempt.
- `provider_request_id` (text, nullable): Provider request handle once acceptance succeeds.
- `status` (text): `created | submitted | running | succeeded | failed | timed_out | abandoned`.
- `dispatch_source` (text): `direct_submit | queued_submit | admin_replay | reconciler`.
- `submit_route` (text, nullable): Route that produced the attempt.
- `queue_id` (uuid, nullable): Transitional queue correlation id for queued-submit lineage.
- `submitted_at` / `started_at` / `completed_at` / `last_observed_at` (timestamptz, nullable): Attempt lifecycle timestamps.
- `failure_reason_code` / `error_message` (text, nullable): Attempt failure detail.
- `metadata` (jsonb, default `{}`): Compact attempt context such as `source_ref`, queue attempts, and submit target details.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Constraints and indexes:
  - Unique `(generation_id, attempt_number)` preserves ordered attempt lineage.
  - Partial unique `(user_id, provider_request_id)` where provider handle is present.
  - `generation_attempts_attempt_number_positive_check` enforces positive attempt numbers.
  - `generation_attempts_status_check` enforces bounded attempt states.
  - `generation_attempts_dispatch_source_check` enforces bounded dispatch-source values.

### ai_generation_outputs

- `id` (uuid, pk, default `gen_random_uuid()`)
- `generation_id` (uuid): Parent `ai_generations` row with cascade delete.
- `user_id` (uuid): Owner for RLS scoping.
- `output_index` (int): Canonical zero-based provider output slot index.
- `provider_request_id` (text, nullable): Provider job handle attached to this output snapshot.
- `result_url` (text): Provider-returned result URL captured at recovery time.
- `media_file_id` (uuid, nullable): Linked durable `media_files` row when autosave or later persistence exists.
- `metadata` (jsonb, default `{}`): Compact output-level recovery metadata such as autosave decision and actor.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Constraints and indexes:
  - Unique `(generation_id, output_index)` prevents duplicate canonical output rows for the same generation slot.
  - `(user_id, provider_request_id)` index supports request-level output lookups when needed.

### generation_projection

- `generation_id` (uuid, pk/fk): Parent `ai_generations` row with same-user parity.
- `user_id` (uuid): Owner for RLS scoping.
- `project_id` (uuid, nullable): Project restore scope when a generation starts from a project route.
- `workspace_runtime_key` (text, nullable): Bounded non-project workspace/session restore scope, such as `session:<sid>`, used to rehydrate generated outputs for the same AI Studio runtime without scanning user-global generated-output state.
- `source_ref` (text, nullable): Submit/request correlation seam.
- `character_context` (jsonb, default `{}`): Persisted character-mode lineage and applied-state context.
- `style_context` (jsonb, default `{}`): Persisted style lineage and applied-state context.
- `generation_replay` (jsonb, default `{}`): Replay/reference snapshot used for recovery and workflow-context analytics.
- `workflow_reload` (jsonb, default `{}`): Versioned navigate-and-hydrate workflow metadata for reloading the originating AI Studio panel from a generated reference.
- `publication_status` / `publication_id` / `published_at` (nullable): Publication tracking fields.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Notes:
  - Admin stats v1 treats this as the primary workflow-context authority for style-applied, character-mode, and reference-assisted generation analytics.
  - Accepted submit paths pass additive `generation_replay`, `workflow_reload`, `character_context`, and `style_context` snapshots through the provider submit proxy so direct accepted runs preserve workflow analytics and reload context.
  - Reference Grid generated-output hydration must scope by `project_id` on project routes or by `workspace_runtime_key` on plain-session routes; plain sessions must not re-enable user-global generated-output startup hydration.

### generation_abandonments

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid): Owner for RLS scoping.
- `source_ref` (text, nullable): Client/server submit correlation used before provider request ids or generation ids exist.
- `generation_id` (uuid, nullable): Linked `ai_generations` row when known.
- `request_id` (text, nullable): Provider request id when known.
- `reason` (text): Abandon origin, currently `reference_grid_clear` for spinner clear actions.
- `no_refund` (boolean): Whether later provider failure should keep/capture the charge instead of refunding/releasing it.
- `metadata` (jsonb, default `{}`): Output id and route context for audit/debugging.
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update allowed only when `user_id = auth.uid()`.
- Notes:
  - Used when a user clears an in-flight Reference Grid placeholder. Provider work may continue upstream, but recovery/direct settlement suppresses projection/publication and honors no-refund semantics.

### media_events

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `event_type` (text): upload | delete | rename | move | prompt_saved | generation_saved | generation_failed.
- `entity_type` (text): media_file | media_prompt | ai_generation.
- `entity_id` (uuid): Row id the event refers to.
- `metadata` (jsonb, default `{}`): Event payload details.
- `created_at` (timestamptz, default now)
- RLS: select + insert allowed only when `user_id = auth.uid()`.
- Notes:
  - Admin stats v1 uses `media_events` as the asset-behavior authority for save/upload/rename/move/delete/prompt-save metrics.
  - Some event families are emitted from client interaction hooks, so they are suitable for product/marketing insight but not strict audit-grade accounting.

### generation persistence idempotency

- `media_files_generation_output_idx_unique`:
  - Unique index on `(source_ref, metadata->>'generation_output_index')` for `source='ai_studio'`.
  - Prevents duplicate media rows for the same generation output slot.
- `ux_ai_generation_outputs_generation_index`:
  - Unique index on `(generation_id, output_index)`.
  - Canonical output-slot idempotency key for persisted generation outputs.

### reconciler claim function

- `claim_generation_recovery_batch(p_limit, p_max_attempts, p_min_age_seconds, p_lease_seconds)`:
  - Claims recovery work using `FOR UPDATE SKIP LOCKED`.
  - Increments `recovery_attempts` and marks claimed rows `recovery_state='recovering'`.
  - Sets `next_recovery_at` lease to prevent concurrent re-claims during active execution.

### media derivative claim/update functions

- `claim_media_derivative_batch(p_limit, p_max_attempts, p_lease_seconds)`:
  - Claims image derivative work using `FOR UPDATE SKIP LOCKED`.
  - Increments `processing_attempts` and marks claimed rows `processing_status='processing'`.
  - Sets `processing_next_retry_at` lease to prevent concurrent worker claims.
- `mark_media_derivative_ready(p_media_file_id, p_user_id, p_thumb_variant_path, p_width, p_height)`:
  - Marks a claimed image row `ready`, updates `thumb_variant_path`, and clears retry/error state.
- `mark_media_derivative_failed(p_media_file_id, p_user_id, p_error, p_retry_seconds, p_exhausted)`:
  - Marks derivative processing failure, records last error, and either schedules retry or exhausts retries.

### fal_webhook_events

- `id` (uuid, pk): Ingestion event row id.
- `event_id` (text, unique): Provider webhook event id for idempotent ingest.
- `request_id` (text, nullable): Provider request/job id.
- `fal_user_id` (text, nullable): Provider user id header snapshot.
- `headers` (jsonb): Canonical verified Fal header values.
- `payload` (jsonb): Raw webhook payload snapshot.
- `verification_method` (text, nullable): active rows use `fal`; older rows may still contain historical `hmac` values from the retired cutover window.
- `payload_hash` (text, nullable): SHA-256 hash used in Fal signature validation.
- `processing_status` (text): received | recovered | exhausted | ignored\_\* | failed.
- `processing_error` (text, nullable): Processing failure detail when applicable.
- `received_at` / `processed_at` (timestamptz): Ingestion + terminal processing timestamps.

### ai_agent_conversation_state

- `user_id` (uuid, pk segment, fk -> `auth.users.id`): Owner for state isolation.
- `conversation_id` (text, pk segment): Conversation identity (`<=191` chars).
- `canonical_prompt` (text): Canonical prompt continuity value (`<=4096` chars).
- `updated_at` (timestamptz): Last canonical state write.
- `expires_at` (timestamptz): Retention horizon for pruning.
- `turn_count` (integer): Incrementing turn counter per conversation.
- RLS: enabled with user ownership policy (`auth.uid() = user_id`).
- Integrity:
  - `ai_agent_conversation_state_conversation_id_length_check` enforces bounded conversation id length.
  - Expired rows are removed in write path and can be pruned operationally.

### Conversation state RPC contract

- `upsert_ai_agent_conversation_state(p_user_id, p_conversation_id, p_canonical_prompt, p_ttl, p_user_cap)`
  - Name/signature and return shape are stable for runtime compatibility.
  - Execution posture: service-role path only.
  - Server-owned bounds:
    - TTL clamp `1 day..90 days` (default `30 days`).
    - Per-user cap clamp `1..200` (default `200`).
  - Deterministic retention:
    - Stable tie-break ordering with current-conversation preservation during same-cycle pruning.
  - Concurrency:
    - Per-user advisory lock serializes upsert/prune for deterministic behavior.
- `prune_ai_agent_conversation_state_expired(p_limit default 10000)`
  - Service-role cleanup helper for scheduled stale-row pruning.

### ai_studio_sessions

- `user_id` (uuid, pk segment, fk -> `auth.users.id`): Session owner.
- `session_id` (uuid, pk segment): Stable AI Studio session identity (`sid` query contract).
- `title` (text, nullable, `<=120` chars): Optional display label.
- `schema_version` (integer, default `1`): Snapshot schema version (`1..100` bounded).
- `snapshot` (jsonb object): Persisted workspace snapshot payload.
- `save_seq` (bigint): Monotonic per-session save sequence used for last-write-wins observability.
- `created_at` / `updated_at` / `expires_at` (timestamptz): Creation/update timestamps + retention horizon.
- RLS: enabled with user ownership policies (`auth.uid() = user_id`) for select/insert/update/delete.
- Retention:
  - Save RPC enforces per-user cap and TTL bounds server-side.
  - Expired rows are cleaned in save path and by scheduled prune RPC.

### AI Studio session RPC contract

- `upsert_ai_studio_session_snapshot(p_user_id, p_session_id, p_snapshot, p_schema_version, p_title, p_ttl, p_user_cap)`
  - Service-role-only execute posture.
  - Requires JSON-object snapshot payload and valid user/session ids.
  - Atomic upsert (`INSERT ... ON CONFLICT`) with monotonic `save_seq`.
  - Deterministic cap/TTL pruning under per-user advisory lock.
- `get_ai_studio_session_snapshot(p_user_id, p_session_id)`
  - Service-role-only read helper that returns one non-expired snapshot row.
- `list_ai_studio_sessions(p_user_id, p_limit, p_cursor_updated_at, p_cursor_session_id)`
  - Service-role-only listing helper ordered by `(updated_at desc, session_id desc)` with cursor windowing.
- `prune_ai_studio_sessions_expired(p_limit default 10000)`
  - Service-role cleanup helper for bounded stale-row pruning.

### dashboard_announcements

- `id` (uuid, pk, default `gen_random_uuid()`).
- `title` (text, required): Trimmed title (`btrim`) with length `1..120`.
- `message` (text, required): Trimmed body copy (`btrim`) with length `1..500`.
- `is_active` (boolean, default `false`): Active global bulletin flag.
- `published_at` (timestamptz, nullable): Publish timestamp for active/current history rows.
- `created_by` / `updated_by` (uuid, nullable fk -> `auth.users.id`): Admin attribution.
- `created_at` / `updated_at` (timestamptz, default UTC now).
- RLS: enabled with authenticated read policy limited to active rows (`auth.uid() is not null and is_active = true`).
- Integrity:
  - Partial unique index enforces a single active row at a time (`where is_active = true`).
  - Update trigger stamps `updated_at` on row mutation.
  - Historical rows are retained after deactivation for future admin history UX.

### Dashboard announcement RPC contract

- `publish_dashboard_announcement(p_title, p_message, p_actor_user_id)`
  - Service-role-only execute posture (`security definer` + execute grant restricted to `service_role`).
  - Trims and bounds payload server-side (`title <= 120`, `message <= 500`) and rejects empty values.
  - Atomically deactivates current active row and inserts a new active row with `published_at`.
  - Uses advisory lock serialization for deterministic one-active semantics under concurrent publish calls.

### admin_kanban_items

- `id` (uuid, pk, default `gen_random_uuid()`).
- `title` (text, required): Trimmed task title with length `1..140`.
- `details` (text, default `''`): Trimmed operator notes, bounded to 1000 characters.
- `status` (text, default `backlog`): `backlog | in_progress | review | complete | published`.
- `sort_order` (integer, default `0`): Stable board ordering value for future manual ordering.
- `created_by` / `updated_by` / `archived_by` (uuid, nullable fk -> `auth.users.id`): Admin attribution.
- `archived_at` (timestamptz, nullable): Soft-delete marker; active board APIs exclude archived rows.
- `created_at` / `updated_at` (timestamptz, default UTC now).
- RLS: enabled with no direct browser policies; trusted admin API routes use service-role access after `requireAdminUser`.
- Integrity:
  - Status is constrained to the five shipped board columns.
  - `updated_at` is stamped by trigger on row mutation.
  - Partial active indexes support status/ordering reads while archived history remains retained.

### admin_kanban_activity

- `id` (uuid, pk, default `gen_random_uuid()`).
- `item_id` (uuid, fk -> `admin_kanban_items.id`): Parent task.
- `action` (text): `created | updated | moved | archived`.
- `from_status` / `to_status` (text, nullable): Status transition metadata when applicable.
- `note` (text, nullable): Compact human-readable mutation context.
- `actor_user_id` (uuid, nullable fk -> `auth.users.id`): Operator id when available.
- `actor_email` (text, nullable): Operator email snapshot for audit context.
- `created_at` (timestamptz, default UTC now).
- RLS: enabled with no direct browser policies; admin timeline reads flow through `/api/admin/kanban/items/:itemId/activity`.
- Integrity:
  - Activity actions and statuses are constrained to known board values.
  - Activity rows restrict parent item deletion so audit history cannot be cascade-deleted accidentally.

### Admin kanban RPC contract

- `create_admin_kanban_item(p_title, p_details, p_actor_user_id, p_actor_email)`
- `update_admin_kanban_item(p_item_id, p_title, p_details, p_actor_user_id, p_actor_email)`
- `move_admin_kanban_item(p_item_id, p_status, p_actor_user_id, p_actor_email)`
- `archive_admin_kanban_item(p_item_id, p_actor_user_id, p_actor_email)`
  - Service-role-only execute posture (`security definer` + execute grant restricted to `service_role`).
  - Validate bounded task input and allowed statuses in-database.
  - Atomically mutate `admin_kanban_items` and insert the matching `admin_kanban_activity` row.
  - `move_admin_kanban_item` locks the active item row before computing `from_status`, preventing stale transition logs under concurrent moves.

### agent_safety_policy_versions

- `id` (bigint identity, pk): Immutable policy version row id.
- `profile_id` (text): `prod_safe_v1 | staging_lenient | dev_absolute_zero`.
- `version` (integer): Profile-local version number (`>=1`).
- `policy` (jsonb object): Profile policy document (modality -> category -> action mapping).
- `is_enabled` (boolean): Activation eligibility toggle.
- `note` (text, nullable): Optional operator note for policy version intent.
- `created_by_user_id` / `created_by_email` (nullable): Operator attribution metadata.
- `created_at` (timestamptz, default now).
- RLS: enabled; service-role RPC paths are authoritative for writes/reads.

### agent_safety_policy_runtime

- `singleton` (boolean, pk, always `true`): Singleton runtime state row key.
- `active_policy_version_id` (bigint fk -> `agent_safety_policy_versions.id`): Currently active policy version.
- `last_known_safe_policy_version_id` (bigint fk -> `agent_safety_policy_versions.id`, nullable): Rollback target version.
- `cooldown_until` (timestamptz, nullable): Profile activation lock deadline after rollback.
- `updated_by_user_id` / `updated_by_email` (nullable): Last operator/system update attribution.
- `updated_at` (timestamptz): Last runtime-state mutation timestamp.
- RLS: enabled; service-role RPC paths are authoritative for writes/reads.

### agent_safety_policy_events

- `id` (bigint identity, pk): Event row id.
- `event_type` (text): `activate | rollback | cooldown_blocked`.
- `from_policy_version_id` / `to_policy_version_id` (nullable fk -> `agent_safety_policy_versions.id`): Policy transition pointers.
- `actor_user_id` / `actor_email` (nullable): Operator attribution metadata.
- `reason` (text, nullable): Operator reason for activation/rollback event.
- `metadata` (jsonb object): Event context (`source`, `single_reviewer_ack`, cooldown metadata).
- `created_at` (timestamptz, default now).
- RLS: enabled; service-role RPC paths are authoritative for writes/reads.

### Agent safety control-plane RPC contract

- `get_active_agent_safety_policy()`
  - Service-role-only read helper for active runtime profile/version + last-known-safe + cooldown metadata.
- `activate_agent_safety_policy(p_profile_id, p_reason, p_actor_user_id, p_actor_email, p_single_reviewer_ack, p_source)`
  - Service-role-only activation helper.
  - Enforces profile allowlist, required `singleReviewerAck`, and cooldown lock windows.
  - Records `activate` or `cooldown_blocked` audit events.
- `rollback_agent_safety_policy(p_reason, p_actor_user_id, p_actor_email, p_source, p_cooldown_hours)`
  - Service-role-only rollback helper.
  - Reverts to last-known-safe policy version and applies bounded cooldown (`1..168` hours).
  - Records rollback audit events for operator traceability.

### model_pricing_policy_versions

- `id` (bigint identity, pk): Immutable model-pricing policy version row id.
- `version` (integer): Global version number (`>=1`).
- `policy` (jsonb object): Normalized model-pricing policy document (credit conversion settings plus row-specific `perModel` pricing/rounding overrides).
- `custom_rows` (jsonb object): Companion admin pricing custom-row manifest keyed by model id for operator-authored display rows that still resolve onto canonical variant ids.
- `note` (text, nullable): Optional operator note for the version.
- `created_by_user_id` / `created_by_email` (nullable): Operator attribution metadata.
- `created_at` (timestamptz, default now).
- RLS: enabled; service-role RPC paths are authoritative for writes/reads.

### model_pricing_policy_runtime

- `singleton` (boolean, pk, always `true`): Singleton runtime state row key.
- `active_policy_version_id` (bigint fk -> `model_pricing_policy_versions.id`): Currently active model-pricing policy version.
- `last_known_safe_policy_version_id` (bigint fk -> `model_pricing_policy_versions.id`, nullable): Rollback target version.
- `updated_by_user_id` / `updated_by_email` (nullable): Last operator/system update attribution.
- `updated_at` (timestamptz): Last runtime-state mutation timestamp.
- RLS: enabled; service-role RPC paths are authoritative for writes/reads.

### model_pricing_policy_events

- `id` (bigint identity, pk): Event row id.
- `event_type` (text): `apply | rollback`.
- `from_policy_version_id` / `to_policy_version_id` (nullable fk -> `model_pricing_policy_versions.id`): Policy transition pointers.
- `actor_user_id` / `actor_email` (nullable): Operator attribution metadata.
- `reason` / `note` (text, nullable): Operator reason and optional version note.
- `source` (text, nullable): Mutation source label (`admin_api`, etc.).
- `metadata` (jsonb object): Event context (`version`, rollback restore metadata).
- `created_at` (timestamptz, default now).
- RLS: enabled; service-role RPC paths are authoritative for writes/reads.

### Model pricing control-plane RPC contract

- `get_active_model_pricing_policy()`
  - Service-role-only read helper for active runtime version/document/custom-row manifest + last-known-safe metadata.
- `apply_model_pricing_policy(p_policy, p_custom_rows, p_note, p_reason, p_actor_user_id, p_actor_email, p_source)`
  - Service-role-only activation helper.
  - Creates the next immutable policy version row, updates the runtime singleton, and records an `apply` audit event.
- `rollback_model_pricing_policy(p_reason, p_actor_user_id, p_actor_email, p_source)`
  - Service-role-only rollback helper.
  - Swaps the runtime singleton back to the last-known-safe version and records a `rollback` audit event.

### user_preferences

- `user_id` (uuid, pk, references `auth.users(id)`): Profile owner.
- `media_autosave_enabled` (boolean, default `true`): AI Studio autosave policy toggle used by client autosave orchestration and server recovery enforcement.
- `expert_edit_preset_panel_labels` (text[], default `{'Selfie','Side Profile','Enhance Realism'}`): Persistent per-user Expert Edit preset panel chip allocation (legacy labels; current client normalization caps the active panel at 10).
- `expert_edit_preset_panel_ids` (text[], default `{'selfie','side_profile','enhance_realism'}`): Canonical per-user Expert Edit preset panel allocation stored by preset ID (current client normalization caps the active panel at 10).
- `expert_edit_custom_presets` (jsonb, default `{}`): Per-user preset override map keyed by canonical preset id (`selfie`, `side_profile`, `custom_1..custom_18`, etc.) storing `{ label, prompt }` values.
- `ai_studio_create_pulse_panel_ids` (text[], default `{'image','multi_shot','story_builder'}`): Canonical per-user Create Pulse rail allocation storing the curated left-rail Pulse IDs shown in Expert Create `Pulse` mode.
- `ai_studio_saved_pulses` (jsonb, default `[]`): Per-user custom Pulse library records stored as ordered minimal `{ presetId, label, description, systemInstructions, pulseKind, createdAt, schemaVersion }` objects. This column is for user-authored custom Pulses only; global built-in guided-workflow records are not stored here and must not be treated as per-user overrides. Legacy workflow fields may still appear in older saved payloads, but client/runtime normalization strips them and resolves user-owned records back to the minimal custom Pulse contract before use. The unified Presets Library (`Pulses` section) and the Expert Create Pulse rail merge these custom records with the shared built-in catalog at runtime.
- `ai_studio_style_panel_ids` (text[], default `{}`): Canonical per-user Styles Library order storing the shared tile sequence consumed by the primary Styles Library panel and the right-rail Styles chooser.
- `ai_studio_deleted_style_ids` (text[], default `{}`): Per-user style ID denylist used by the primary Styles Library panel to persist deletions across sessions/devices.
- `ai_studio_style_details_overrides` (jsonb, default `{}`): Per-user custom-style records keyed by style id storing the editable core style fields `{ style, title, referenceImageName, stylePrompt, previewImageUrl }`. Global built-in Style ids are ignored by runtime when they appear here; built-in definitions come from `ai_studio_builtin_style_runtime`.
- `ai_studio_saved_voices` (jsonb, default `[]`): Per-user AI Studio saved-voice compatibility cache storing `{ voiceId, name, previewUrl, sampleStoragePath, description, provider, isFallback, createdAt }` records. This remains useful for UI metadata and legacy compatibility, but it is no longer sufficient by itself to prove ownership of a custom provider voice.
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now, maintained by trigger)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### user_owned_custom_voices

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, fk -> `auth.users.id`): Owner for RLS scoping and the authoritative custom-voice tenant boundary.
- `provider` (text): Current fixed provider id. Presently constrained to `elevenlabs`.
- `voice_id` (text): Upstream provider voice id. Unique per provider so one custom provider voice cannot be claimed by multiple users.
- `display_name` (text): User-facing voice label stored by the authoritative ownership row.
- `description` (text, nullable): Provider/user description persisted alongside the owned voice metadata.
- `preview_url` (text, nullable): Last known preview URL. Signed sample URLs may still be refreshed at request time from `sample_storage_path`.
- `sample_storage_path` (text, nullable): Private `media_library` storage path for the sample preview generated during create/clone.
- `origin_kind` (text): Canonical saved-voice origin classification (`provider-user-created`, `provider-saved`, `provider-default`, `legacy-saved`).
- `saved_source` (text): Ownership/write source (`text-to-voice-create`, `voice-clone`, `provider-save`, `legacy`).
- `provider_delete_eligible` (boolean): Whether the owned custom voice is allowed to be deleted upstream through ShortPulse.
- `ownership_provenance` (text): How ownership was established (`text_to_voice_create`, `voice_clone`, `provider_save`, `legacy_migrated`, `admin_repair`).
- `ownership_confidence` (text): Confidence level for the ownership record (`high`, `migrated`, `disputed`). Only `high` rows are trusted by runtime custom-voice access; `migrated` and `disputed` rows are review-only until repaired.
- `created_at` / `updated_at` (timestamptz): Timestamps for first ownership persistence and latest authoritative update.
- Runtime role: authoritative ledger for custom-provider voice ownership used by the ElevenLabs voice library, generation routes, and destructive voice actions. Shared provider workspace inventory must not override this table.
- Migration note: `sql/migrations/129_backfill_user_owned_custom_voices_from_preferences.sql` seeds this table from legacy `user_preferences.ai_studio_saved_voices` entries that look like owned custom voices (`provider-user-created`, `text-to-voice-create`, `voice-clone`, or provider-delete-eligible records). `sql/migrations/130_quarantine_legacy_migrated_custom_voice_ownership.sql` then moves those legacy-migrated rows into `ownership_confidence = 'disputed'` so they can be reviewed before runtime trusts them.

### create_pulse_builtin_runtime

- `singleton` (boolean, pk, default `true`): Singleton row guard for the active built-in Create Pulse catalog.
- `pulse_definitions` (jsonb): Ordered built-in guided-workflow definition array stored as `{ presetId, label, description, systemInstructions, starterAssistantMessage, workflowStageHints, artifactTarget }` records.
- `updated_at` (timestamptz, default `timezone('utc', now())`): Last control-plane write timestamp.
- `updated_by_user_id` (uuid, nullable): Admin user id that last saved the catalog.
- `updated_by_email` (text, nullable): Admin email captured with the last save for operator traceability.
- Runtime role: global source of truth for built-in guided workflows consumed by `/api/ai/create-pulse-builtins` and enforced by `/api/ai/studio-agent-pulse` when a built-in preset id is active.
- Access model: service-role-only direct reads/writes. Browser sessions must go through trusted authenticated routes; customer sessions must never query this table directly.

### ai_studio_builtin_style_runtime

- `singleton` (boolean, pk, default `true`): Singleton row guard for the active built-in Styles catalog.
- `style_definitions` (jsonb): Ordered built-in Style definition array stored as `{ styleId, title, stylePrompt, previewImageUrl, referenceImageName, schemaVersion }` records.
- `updated_at` (timestamptz, default `timezone('utc', now())`): Last control-plane write timestamp.
- `updated_by_user_id` (uuid, nullable): Admin user id that last saved the catalog.
- `updated_by_email` (text, nullable): Admin email captured with the last save for operator traceability.
- Runtime role: global source of truth for built-in AI Studio Styles consumed by `/api/ai/built-in-styles` and merged with per-user custom styles in the Styles Library.
- Access model: service-role-only direct reads/writes. Browser sessions must go through trusted authenticated routes; customer sessions must never query this table directly.

### user_media_compliance_acceptances

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, fk -> `auth.users.id`): Owner for RLS scoping.
- `agreement_key` (text): Stable agreement identifier. Current protected-route gate uses `media_usage_compliance`.
- `agreement_version` (text): Accepted version string for the agreement copy shown in the app shell.
- `accepted_at` (timestamptz, default `timezone('utc', now())`): When the user accepted that exact agreement version.
- `ip_address` (text, nullable): First forwarded client IP captured by the server when acceptance is recorded.
- `user_agent` (text, nullable): Browser user-agent captured by the server when acceptance is recorded.
- Uniqueness: one row per `user_id + agreement_key + agreement_version`, preserving acceptance history across future version bumps.
- RLS: select/insert allowed only when `user_id = auth.uid()`. Protected-route reads/writes currently flow through authenticated server routes.

### user_issue_reports

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, nullable fk -> `auth.users.id`): Authenticated submitter at write time. Uses `on delete set null` so report history can persist after account deletion.
- `submitter_email` (text): Snapshot of the authenticated account email when the report was filed.
- `message` (text): User-authored issue description, trimmed and bounded to 4000 chars.
- `status` (text): Manual admin lifecycle state (`new | reviewing | resolved`).
- `admin_notes` (text): Operator notes captured during review, default empty string.
- `source_path` (text, nullable): Route/path context captured from the client at submit time.
- `user_agent` (text, nullable): Browser user-agent captured by the server.
- `reviewed_at` (timestamptz, nullable): Last admin review/update timestamp.
- `reviewed_by_user_id` (uuid, nullable fk -> `auth.users.id`): Admin user id that last updated status or notes.
- `created_at` / `updated_at` (timestamptz): Canonical creation/update timestamps.
- Runtime role: canonical signed-in issue-report inbox for `/report-issue` and `/admin/reports`.
- Access model: RLS enabled with no browser policies; all reads and writes flow through trusted server routes using service-role Supabase access.

### billing_plans

- `id` (text, pk): Stable plan identifier used across billing profiles, subscriber contracts, and the public catalog. Public acquisition uses `starter | media | studio | business`; the legacy `free` database id is a non-public baseline fallback row, not a customer-facing plan.
- `display_name` (text): UI-facing plan label.
- `monthly_price_cents` (int): Current public baseline price in cents for the tier.
- `monthly_credits_cents` (int): Current public baseline monthly credits for the tier.
- `storage_limit_bytes` (bigint): Current public baseline media storage entitlement for the tier.
- `stripe_price_id` (text, nullable): Legacy/current recurring Stripe price ID for the tier baseline. Subscriber-specific recurring prices should prefer `billing_plan_offers` / `billing_subscription_contracts`.
- `stripe_product_id` (text, nullable): Stripe product id for the plan identity created from `/api/admin/pricing/plans/create`.
- `sort_order` (int): UI ordering for billing catalog and admin pricing plan rendering.
- `is_active` (boolean): Plan availability toggle.
- `created_at` (timestamptz, default now)
- RLS: select allowed for all users; writes are server/admin only.

### billing_plan_offers

- `id` (text, pk): Stable versioned offer id (for example `studio__current`, future dated legacy/current variants).
- `plan_id` (text, fk -> `billing_plans.id`): Tier this offer belongs to.
- `offer_name` (text): Operator-facing offer label.
- `recurring_price_cents` (int): Recurring price snapshot for this offer.
- `monthly_credits_cents` (int): Included monthly credits snapshot for this offer.
- `storage_limit_bytes` (bigint): Included base media storage entitlement snapshot for this offer.
- `max_concurrent_generations` (int): Active generation slot entitlement for this offer.
- `stripe_price_id` (text, nullable): Stripe recurring price id for this offer.
- `currency` (text, default `usd`): Offer currency.
- `billing_interval` (text, default `month`): Current recurring interval.
- `acquisition_enabled` (boolean): Whether new customers can currently buy this offer.
- `is_active` (boolean): Soft-active flag for the offer record.
- Internal comp note: hidden internal/admin offers such as `business__internal_comp` keep `acquisition_enabled = false`, `stripe_price_id = null`, and `recurring_price_cents = 0`.
- `effective_start_at` / `effective_end_at` (timestamptz, nullable): Offer lifecycle window.
- `created_at` / `updated_at` (timestamptz)
- RLS: select allowed for all users; writes are server-only/service-role-only.

### billing_credit_packages

- `id` (text, pk): Stable package ID used by checkout API.
- `display_name` (text): UI package label.
- `credit_amount_cents` (int): Credits granted on successful purchase.
- `price_cents` (int): One-time package price.
- `stripe_price_id` (text, nullable): Stripe one-time price ID.
- `is_active` (boolean): Package availability toggle.
- `sort_order` (int): UI ordering.
- `created_at` (timestamptz, default now)
- RLS: select allowed for all users; writes are server/admin only.

### billing_storage_addons

- `id` (text, pk): Stable recurring storage add-on id used for catalog and Stripe mapping.
- `display_name` (text): UI-facing add-on label.
- `storage_limit_bytes` (bigint): Included recurring storage capacity for one add-on unit.
- `monthly_price_cents` (int): Current public baseline monthly price for the add-on.
- `sort_order` (int): UI ordering.
- `is_active` (boolean): Add-on availability toggle.
- `created_at` (timestamptz, default now)
- RLS: select allowed for all users; writes are server-only/service-role-only.

### billing_storage_addon_offers

- `id` (text, pk): Stable versioned recurring storage add-on offer id.
- `storage_addon_id` (text, fk -> `billing_storage_addons.id`): Shared add-on this offer belongs to.
- `offer_name` (text): Operator-facing add-on offer label.
- `storage_limit_bytes` (bigint): Locked storage amount for this add-on offer version.
- `recurring_price_cents` (int): Locked recurring price snapshot for this add-on offer version.
- `stripe_price_id` (text, nullable): Stripe recurring price id for this add-on offer.
- `currency` (text, default `usd`): Offer currency.
- `billing_interval` (text, default `month`): Current recurring interval.
- `acquisition_enabled` (boolean): Whether this add-on offer is currently available for new purchases.
- `is_active` (boolean): Soft-active flag for the offer record.
- `effective_start_at` / `effective_end_at` (timestamptz, nullable): Offer lifecycle window.
- `created_at` / `updated_at` (timestamptz)
- RLS: select allowed for all users; writes are server-only/service-role-only.

### billing_profiles

- `user_id` (uuid, pk, references `auth.users(id)`): Owner.
- `plan_id` (text, fk -> `billing_plans.id`): Active plan projection used by existing runtime/UI paths.
- `stripe_customer_id` (text, nullable): Stripe customer reference.
- `stripe_subscription_id` (text, nullable): Stripe subscription reference.
- `subscription_status` (text): active | trialing | canceled | past_due | inactive (runtime values from Stripe sync).
- `current_period_end` (timestamptz, nullable): Subscription period end timestamp.
- `created_at` / `updated_at` (timestamptz)
- RLS: users can read only their own row; plan/customer/subscription writes are server-only through trusted routes, triggers, and webhooks.
- Contract note: `billing_profiles` is not the long-term commercial source of truth for grandfathered recurring pricing; use `billing_subscription_contracts` for subscriber-specific recurring terms.

### billing_subscription_contracts

- `id` (uuid, pk): Historical/current subscriber contract row.
- `user_id` (uuid, fk -> `auth.users(id)`): Contract owner.
- `plan_id` (text, fk -> `billing_plans.id`): Tier associated with the contract.
- `offer_id` (text, nullable fk -> `billing_plan_offers.id`): Offer/version purchased for this contract.
- `stripe_customer_id` (text, nullable): Stripe customer reference copied onto the contract row.
- `stripe_subscription_id` (text, nullable): Stripe subscription reference for this contract lineage.
- `stripe_price_id` (text, nullable): Stripe recurring price id actually used for the contract.
- `recurring_price_cents` (int): Locked recurring price snapshot for the subscriber.
- `monthly_credits_cents` (int): Locked included monthly credits snapshot for the subscriber.
- `storage_limit_bytes` (bigint): Locked base media storage entitlement snapshot for the subscriber.
- `max_concurrent_generations` (int): Locked active generation slot entitlement for the subscriber.
- `currency` (text, default `usd`): Contract currency.
- `billing_interval` (text, default `month`): Current recurring interval.
- `status` (text): Contract/subscription status projection (`active`, `trialing`, `past_due`, `canceled`, `inactive`, etc.).
- `contract_source` (text, default `stripe`): Renewal owner for the contract (`stripe` or `internal_comp`).
- `current_period_start` / `current_period_end` (timestamptz, nullable): Stripe period boundaries when known.
- `cancel_at_period_end` (boolean, default `false`): Scheduled cancellation flag.
- `granted_by_user_id` (uuid, nullable fk -> `auth.users.id`): Admin/operator who created the internal comp contract where applicable.
- `grant_reason` (text, nullable): Operator-supplied reason for the internal comp override.
- `updated_by_user_id` (uuid, nullable fk -> `auth.users.id`): Last trusted operator who manually updated the contract where applicable.
- `started_at` (timestamptz): Contract start timestamp.
- `ended_at` (timestamptz, nullable): Contract end timestamp; `null` means current/open contract row.
- `created_at` / `updated_at` (timestamptz)
- RLS: users can read only their own rows; writes are server-only/service-role-only. At most one open contract row per user and per Stripe subscription.

### growth_attribution_identities

- `anonymous_id` (text, pk): Browser-stable anonymous attribution key (`sp_growth_anonymous_id`).
- `user_id` (uuid, nullable unique fk -> `auth.users.id`): Stitched authenticated owner once a trusted growth event arrives with bearer auth.
- First-touch fields:
  - `first_utm_source`
  - `first_utm_medium`
  - `first_utm_campaign`
  - `first_landing_path`
  - `first_referrer_host`
- Last-touch fields:
  - `last_utm_source`
  - `last_utm_medium`
  - `last_utm_campaign`
  - `last_landing_path`
  - `last_referrer_host`
- `first_seen_at` / `last_seen_at` (timestamptz): First/latest observed growth telemetry timestamp for the anonymous identity.
- `signup_submitted_at` / `signup_completed_at` (timestamptz, nullable): Top-of-funnel auth milestones captured through `/api/telemetry/growth`.
- `stitched_at` (timestamptz, nullable): When the anonymous identity was first linked to an authenticated user.
- `created_at` / `updated_at` (timestamptz)
- RLS: service-role-only read/write surface used by trusted API routes and admin aggregate RPCs.

### billing_subscription_storage_addons

- `id` (uuid, pk): Historical/current subscriber recurring storage add-on row.
- `user_id` (uuid, fk -> `auth.users(id)`): Add-on owner.
- `storage_addon_id` (text, fk -> `billing_storage_addons.id`): Shared add-on catalog id.
- `offer_id` (text, nullable fk -> `billing_storage_addon_offers.id`): Versioned add-on offer purchased for this row.
- `stripe_subscription_id` (text, nullable): Stripe subscription reference tied to this add-on.
- `stripe_subscription_item_id` (text, nullable): Stripe subscription item reference for this add-on line.
- `stripe_price_id` (text, nullable): Stripe recurring price id actually used for this add-on.
- `quantity` (int): Number of identical add-on units attached to the subscription item.
- `storage_limit_bytes` (bigint): Locked storage amount per add-on unit for this subscriber row.
- `recurring_price_cents` (int): Locked recurring amount per add-on unit for this subscriber row.
- `currency` (text, default `usd`): Add-on currency.
- `billing_interval` (text, default `month`): Current recurring interval.
- `status` (text): Add-on status projection (`active`, `trialing`, `past_due`, `canceled`, etc.).
- `current_period_start` / `current_period_end` (timestamptz, nullable): Known recurring period boundaries.
- `started_at` (timestamptz): Add-on start timestamp.
- `ended_at` (timestamptz, nullable): Add-on end timestamp; `null` means current/open row.
- `created_at` / `updated_at` (timestamptz)
- RLS: users can read only their own rows; writes are server-only/service-role-only. At most one open row per Stripe subscription item.

### ai_credit_balance

- `user_id` (uuid, pk, references `auth.users(id)`): Balance owner.
- `balance_cents` (bigint): Current credit balance (1 cent == 1 credit in current pricing model).
- `updated_at` (timestamptz): Last balance mutation timestamp.
- RLS: select only when `user_id = auth.uid()`.

### ai_credit_ledger

- `id` (uuid, pk): Ledger entry.
- `user_id` (uuid, fk -> `auth.users.id`): Balance owner.
- `change_cents` (int): Positive credits grant; negative credits debit.
- `reason` (text): Human-readable reason (generation, purchase, admin adjustment, etc.).
- `source` (text): signup_seed | stripe_checkout | subscription_renewal | admin_adjustment | generation | ...
- `source_ref` (text, nullable): Idempotency reference (unique by user+source+ref when provided).
- `metadata` (jsonb): Context payload for audits/debugging.
  - Current generation debit rows may include:
    - `shortpulse_context.*` client submit context
    - `pricing_breakdown` for raw/billed credit math
    - `pricing_observability` for displayed-vs-actual billed credit comparison
- `created_by` (uuid, nullable): Actor ID where available.
- `created_at` (timestamptz, default now)
- Legacy note: some older environments still use `ref_id` instead of `source/source_ref/metadata/created_by`. Run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` to align schema.
- RLS: users can read own entries; users can only insert negative entries for themselves; positive credits require privileged context.
- Trigger guards: disallow zero deltas, prevent balance underflow, keep `ai_credit_balance` synchronized.

### ai_credit_reservations

- `id` (uuid, pk): Reservation row.
- `user_id` (uuid, fk -> `auth.users.id`): Balance owner.
- `source_ref` (text): Request correlation/idempotency key for the generation attempt.
- `provider_request_id` (text, nullable): Provider job/request ID once submission succeeds.
- `model_id` (text): Model charged for reservation.
- `amount_cents` (int): Reserved amount (always positive).
- `status` (text): `reserved` | `captured` | `released`.
- `reason` (text): Human-readable reservation reason.
- `metadata` (jsonb): Reservation context and settlement details.
  - Admission-aware rows include `admission_tier` for tier-scoped concurrency accounting.
  - Release paths persist `release_finality` (`conditional` default, `waived` explicit) for downstream success-settlement recapture policy.
  - Billable AI Studio reservations may also include:
    - `shortpulse_context.*` client submit context
    - `pricing_breakdown` for raw/billed credit math
    - `pricing_observability` for displayed-vs-actual billed credit comparison
- `created_at` / `updated_at` (timestamptz)
- `captured_at` / `released_at` (timestamptz, nullable)
- RLS: users can select only own reservations (`user_id = auth.uid()`); server-side functions handle writes.
- Provisioned by: `sql/migrations/002_add_generation_credit_reservations.sql`.

### Reservation lifecycle RPCs

- `reserve_generation_credits(...)`: creates or idempotently confirms a reservation if funds are available.
- `admit_and_reserve_generation_credits(...)`: flagged atomic admission+reservation path that can return `admission_limited` with snapshot counters before insert.
- `mark_generation_reservation_submitted(...)`: attaches provider request id to a reserved row.
- `capture_generation_reservation_by_provider_request(...)`: writes ledger debit + marks reservation captured.
- `release_generation_reservation_by_source_ref(...)`: releases reservation by source reference.
- `release_generation_reservation_by_provider_request(...)`: releases reservation by provider request id.
- `release_stale_generation_reservations(p_limit, p_min_age_seconds)`: conservative janitor that releases only pre-submit stale rows (`status='reserved'`, `provider_request_id is null`) and skips rows with active queue entries.
- `release_stale_provider_attached_generation_reservations(p_limit, p_min_age_seconds, p_orphan_min_age_seconds)`: conservative janitor for provider-attached reserved rows that are clearly non-active (terminal/exhausted generation linkage or aged orphaned request id) and not actively queued.
- Used by: `frontend/lib/server/api/generationBilling.ts`, `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/falStatusProxy.ts`.

### ai_generation_submit_queue

- `id` (uuid, pk, default `gen_random_uuid()`): Queue row id.
- `generation_id` (uuid, unique, fk -> `ai_generations.id`): Pending generation row associated with queued submit intent.
- `user_id` (uuid, fk -> `auth.users.id`): Queue owner for per-user concurrency control.
- `model_id` (text): Target model id for tier/cap evaluation at dispatch time.
- `source_ref` (text): Submit idempotency key (`x-shortpulse-request-id` correlation).
- `submit_route` (text): API route that captured the submit intent.
- `submit_payload` (jsonb): Provider-ready payload captured server-side for deferred dispatch.
- `timeout_ms` (int): Dispatch submit timeout budget.
- `status` (text): `queued` | `dispatching` | `exhausted`.
- `attempts` (int): Dispatch attempt counter.
- `next_attempt_at` (timestamptz): Next eligible dispatch time.
- `lease_until` (timestamptz, nullable): Active dispatcher lease deadline.
- `last_error` / `last_error_code` (text, nullable): Last dispatch failure detail.
- `created_at` / `updated_at` (timestamptz).
- Constraints and indexes:
  - Unique `(user_id, source_ref)` idempotent enqueue key.
  - Unique `(generation_id)`.
  - Dispatch scan index on `(status, next_attempt_at, created_at)`.
  - Per-user status index on `(user_id, status, created_at)`.
  - Unique partial index on `(user_id) where status='dispatching'` to keep one active leased dispatch per user.
- RLS:
  - Select and write policies scoped to `user_id = auth.uid()`.
  - Service-role RPCs (`enqueue_generation_submit`, `claim_generation_submit_queue_batch`) are authoritative write paths.

### stripe_event_log

- `id` (text, pk): Stripe event ID (`evt_*`).
- `event_type` (text): Stripe event type.
- `received_at` (timestamptz, default now)
- `payload` (jsonb): Event payload snapshot.
- Purpose: webhook idempotency and audit trail.
- RLS: service-role-only write surface; customer sessions never mutate this table directly.

### app_error_logs

- `id` (uuid, pk): Incident record ID.
- `fingerprint` (text): Hash of normalized source/message/stack/location for deduping repeats.
- `source` (text): e.g. client.runtime | client.unhandledrejection | client.api_response | client.api_network | client.react_error_boundary | client.route_change | generation.workflow_failure | generation.stale_timeout | client.ai_studio.media_library_save_failure | api.exception | db.trigger.handle_new_user_billing_setup. Low-severity browser `telemetry.ai_studio.*` UI mirrors are suppressed before ingest and should not appear here.
- `scope` (text): app | generation.
- `severity` (text): low | medium | high.
- `status` (text): open | ignored | resolved.
- `message` (text): Normalized error message.
- `stack` (text, nullable): Stack snapshot where available.
- `route` (text, nullable): Frontend route label/context.
- `endpoint` (text, nullable): API endpoint involved where applicable.
- `request_id` (text, nullable): Correlation id from `x-shortpulse-request-id`.
- `http_status` (int, nullable): HTTP status when available.
- `user_id` (uuid, nullable): Auth user who experienced the incident.
- `user_email` (text, nullable): Snapshot email for faster admin triage.
- `metadata` (jsonb): Extra context (method, user agent, route label, release/build tags, deployment headers, etc.). Repeated incidents merge metadata values so context accumulates across occurrences.
- `first_seen_at` / `last_seen_at` (timestamptz): First/most recent observed timestamps for this grouped incident.
- `occurrences_count` (int): Number of times this incident has recurred.
- `created_at` / `updated_at` (timestamptz)
- RLS: enabled with no client policies by default (service-role/server-only writes and reads).

### app_error_events

- `id` (uuid, pk): Immutable event row ID.
- `incident_id` (uuid, nullable): Optional link to grouped `app_error_logs.id`.
- `fingerprint` (text): Same normalized fingerprint used for incident grouping.
- `source` (text): Event source channel (client/runtime/api/provider-specific).
- `scope` (text): app | generation.
- `severity` (text): low | medium | high.
- `message` (text): Event message at the time of occurrence.
- `stack` (text, nullable): Event stack snapshot where available.
- `route` (text, nullable): Frontend/API route context.
- `endpoint` (text, nullable): Endpoint involved where applicable.
- `request_id` (text, nullable): Correlation id from `x-shortpulse-request-id`.
- `http_status` (int, nullable): HTTP status when available.
- `user_id` / `user_email` (nullable): user context snapshot.
- `metadata` (jsonb): sanitized structured context captured at event time.
- `occurred_at` / `created_at` (timestamptz)
- RLS: enabled with no client policies by default (service-role/server-only writes and reads).
- Telemetry contract notes:
  - `telemetry.ai_studio.generate_clicked` was the original intent authority for admin stats v1, but low-severity browser `telemetry.ai_studio.*` ingest is currently suppressed before `/api/log/client-error`, so do not treat this source as fresh/live authority until a dedicated product-telemetry lane replaces it.
  - Growth funnel sources now include:
    - `telemetry.marketing.page_view`
    - `telemetry.marketing.cta_clicked`
    - `telemetry.auth.signup_submitted`
    - `telemetry.auth.signup_completed`
    - `telemetry.billing.pricing_viewed`
    - `telemetry.billing.upgrade_clicked`
    - `telemetry.billing.checkout_started`
    - `telemetry.billing.checkout_completed`
  - Current generate-click metadata keys used by `/admin/stats`:
    - `selected_tool`
    - `mode`
    - `model_id`
    - `selected_model_id`
    - `project_id_present`
    - `is_character_mode`
    - `selected_character_id`
    - `has_style`
    - `style_id`
    - `reference_count`
  - Current growth-telemetry metadata keys used by `/admin/stats`:
    - `anonymous_id`
    - `utm_source`
    - `utm_medium`
    - `utm_campaign`
    - `landing_path`
    - `referrer_host`
    - event-specific metadata such as `page_name`, `cta_id`, `pricing_surface`, `upgrade_target`, `package_id`

### storage.objects (Supabase bucket)

- Bucket: `media_library` (private).
- Policy: allow select/insert/update/delete when bucket is `media_library` **and** the folder prefix matches `auth.uid()` (or service role).
- App path convention:
  - Standard uploads: `<auth.uid()>/images/...` and `<auth.uid()>/videos/...`
  - Private tab uploads: `<auth.uid()>/private/images/...`
  - AI Studio generations: `<auth.uid()>/generations/<images|videos>/...`
- See `sql/storage_policies.sql` for the full policy script.

## Demo analytics fields (computed client-side)

- `reel_id`, `reel_url`, `platform`, `platform_label`, `category`, `creator_username`
- `publish_time`, `latest_scraped_at`
- `views`, `likes`, `comments`, `shares_or_saves`
- Derived per refresh:
  - `hours_since_publish` (from `publish_time`)
  - `views_per_hour` = `views / hours_since_publish`
  - `engagement_rate` = `(likes + comments + shares_or_saves) / views` (0 if views is 0)
  - Percentiles for `views`, `views_per_hour`, `engagement_rate`
  - `performance_score` = `0.45*engagement_percentile + 0.40*views_per_hour_percentile + 0.15*views_percentile`
- Additional fields used by UI: `completion_rate`, `click_through_rate`, `watch_time_seconds`, `trend_direction`, `rank`, `outlierMultiplier` (derived in-page).

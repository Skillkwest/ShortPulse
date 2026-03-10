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
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity checks:
  - `source` constrained to `upload | private_upload | ai_studio | character_reference | character_generation | character_quickswap`.
  - `source` is non-null with default `upload` (see `sql/migrations/007_harden_media_source_and_usage_rpc.sql`).
  - `source = private_upload` requires `file_type = image` and `storage_path` under `<user_id>/private/images/...`.
  - Any row with `storage_path` under `<user_id>/private/images/...` must use `source = private_upload`.
  - `source = character_reference` requires `file_type = image`, `storage_path` under `<user_id>/characters/...`, and metadata keys for `character_id`, `character_sheet_id` (legacy `reference_pack_id` is still accepted), and `slot_key` (see `sql/migrations/010_harden_character_reference_media_integrity.sql` and `sql/migrations/012_add_character_sheet_aliases_and_compat.sql`).
  - `source = character_quickswap` requires `file_type = image`, `storage_path` under `<user_id>/characters/<character_id>/quickswap/...`, and metadata key `character_id` (see `sql/migrations/045_add_character_quickswap_deck.sql`).

### Media usage RPCs
- `get_media_library_usage_bytes()`: returns total `file_size` bytes for the authenticated user’s `media_files` rows.
- Used by: `frontend/pages/media-library.tsx` for accurate storage usage display independent of paged list cache.

### characters
- `id` (uuid, pk)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `name` (text): Character display name.
- `status` (text): draft | active | archived.
- `active_character_sheet_id` (uuid, nullable): Active character sheet pointer for generation workflows.
- `active_reference_pack_id` (uuid, nullable): Legacy alias kept in sync for backward compatibility.
- `metadata` (jsonb, default `{}`)
  - Character profile image linkage keys:
    - `profile_image_storage_path` (text path in `media_library`)
    - `profile_image_media_file_id` (uuid of linked `media_files` row)
    - `profile_image_zoom` (number; persisted profile crop zoom)
    - `profile_image_offset_x` (number; persisted profile crop horizontal offset)
    - `profile_image_offset_y` (number; persisted profile crop vertical offset)
  - Character sheet assignment keys:
    - `character_sheet_assignments` (canonical key used by current Character Manager UI)
    - `reference_pack_assignments` (legacy alias kept in sync for backward compatibility)
  - Character sheet preset key:
    - `character_sheet_presets_v1`
      - `active_preset_id`: `"1"`..`"10"`
      - `presets`: record keyed by preset id (`1..10`)
      - `tab_order`: visible preset-tab id list (`1..10` ids, default `["1"]` for new users)
      - `tab_labels`: display label map keyed by preset id (`1..10`)
      - `tab_descriptions`: per-preset character-description map keyed by preset id (`1..10`, max 150 chars each)
      - Each preset stores `portrait | close_up | front_shot | back_shot`
      - Each zone is `null` or `{ media_file_id, storage_path }`
      - Preset references are user-scoped and used by AI Studio Character Mode injection.
      - Character Mode description injection uses active preset `tab_descriptions[active_preset_id]`; falls back to legacy `characters.description` when active preset description is empty.
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
- `reference_pack_id` (uuid): Legacy alias kept in sync for backward compatibility.
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `slot_key` (text): Fixed character reference slot key.
- `media_file_id` (uuid): Linked `media_files` row.
- `storage_path` (text): Canonical private object path under `<user_id>/characters/<character_id>/<character_sheet_id>/<slot_key>/...`.
- `validation_status` (text): pending | pass | warn | fail.
- `validation_notes` (jsonb, default `{}`)
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - `storage_path` must match the character/pack/slot path convention.
  - Trigger `trg_character_reference_images_media_integrity` enforces that linked `media_files` row stays user-owned, uses `source = character_reference`, and has matching path/metadata.

### character_quick_swap_items
- `id` (uuid, pk)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `character_id` (uuid): Parent character.
- `media_file_id` (uuid): Linked `media_files` row.
- `storage_path` (text): Canonical private object path under `<user_id>/characters/<character_id>/quickswap/...`.
- `status` (text): active | archived.
- `created_at` (timestamptz): Insertion timestamp used for active/archive ordering.
- `archived_at` (timestamptz, nullable): Set when item is archived.
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Notes:
  - QuickSwap Deck keeps newest 500 rows active; overflow rows are archived.
  - Legacy `character_reference_images` remains compatibility data for fixed-slot fallback only.

### character_generation_jobs
- `id` (uuid, pk)
- `character_id` (uuid): Parent character.
- `character_sheet_id` (uuid): Parent character sheet used by generation (canonical).
- `reference_pack_id` (uuid): Legacy alias kept in sync for backward compatibility.
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
- `created_at` / `updated_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Per-user case-insensitive uniqueness on folder name (`unique (user_id, lower(name))`).
  - `(id, user_id)` unique index is used by scoped membership foreign keys.

### media_folder_media_items
- `folder_id` (uuid, pk segment): References `media_folders.id` with cascade delete.
- `media_file_id` (uuid, pk segment): References `media_files.id` with cascade delete.
- `user_id` (uuid, references `auth.users.id`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- RLS: select/insert/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Composite scoped FKs enforce same-user ownership for both folder and media row via `(folder_id, user_id)` and `(media_file_id, user_id)`.
  - Supports multi-folder membership without deleting `media_files` on unassign.

### media_folder_prompt_items
- `folder_id` (uuid, pk segment): References `media_folders.id` with cascade delete.
- `prompt_id` (uuid, pk segment): References `media_prompts.id` with cascade delete.
- `user_id` (uuid, references `auth.users.id`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- RLS: select/insert/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - Composite scoped FKs enforce same-user ownership for both folder and prompt row via `(folder_id, user_id)` and `(prompt_id, user_id)`.
  - Supports multi-folder membership without deleting `media_prompts` on unassign.

### ai_generations
- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `mode` (text): image | video.
- `provider` (text): fal | kei (legacy) | ...
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
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Constraints and indexes:
  - `ai_generations_recovery_state_check` enforces `recovery_state` enum values.
  - `ai_generations_recovery_attempts_non_negative_check` enforces non-negative attempts.
  - Unique partial index on `(user_id, request_id)` where `request_id is not null`.
  - Reconciler scan index on `(recovery_state, next_recovery_at, created_at)`.
  - Trigger `trg_ai_generations_enforce_status_transition` blocks illegal status transitions, with guarded recovery override for `fail -> success` when `failure_reason_code='terminal_success_no_media'` and recovery state is converging to `recovered`.

### media_events
- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `event_type` (text): upload | delete | rename | move | prompt_saved | generation_saved | generation_failed.
- `entity_type` (text): media_file | media_prompt | ai_generation.
- `entity_id` (uuid): Row id the event refers to.
- `metadata` (jsonb, default `{}`): Event payload details.
- `created_at` (timestamptz, default now)
- RLS: select + insert allowed only when `user_id = auth.uid()`.

### generation persistence idempotency
- `media_files_generation_output_idx_unique`:
  - Unique index on `(source_ref, metadata->>'generation_output_index')` for `source='ai_studio'`.
  - Prevents duplicate media rows for the same generation output slot.

### reconciler claim function
- `claim_generation_recovery_batch(p_limit, p_max_attempts, p_min_age_seconds, p_lease_seconds)`:
  - Claims recovery work using `FOR UPDATE SKIP LOCKED`.
  - Increments `recovery_attempts` and marks claimed rows `recovery_state='recovering'`.
  - Sets `next_recovery_at` lease to prevent concurrent re-claims during active execution.

### fal_webhook_events
- `id` (uuid, pk): Ingestion event row id.
- `event_id` (text, unique): Provider webhook event id for idempotent ingest.
- `request_id` (text, nullable): Provider request/job id.
- `fal_user_id` (text, nullable): Provider user id header snapshot.
- `headers` (jsonb): Canonical verified Fal header values.
- `payload` (jsonb): Raw webhook payload snapshot.
- `verification_method` (text, nullable): `fal` or `hmac` during dual cutover.
- `payload_hash` (text, nullable): SHA-256 hash used in Fal signature validation.
- `processing_status` (text): received | recovered | exhausted | ignored_* | failed.
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

### user_preferences
- `user_id` (uuid, pk, references `auth.users(id)`): Profile owner.
- `beginner_mode` (boolean, default `false`): AI Studio/Character Manager beginner mode preference (expert-first default while runtime lockdown is active).
- `media_autosave_enabled` (boolean, default `true`): AI Studio autosave policy toggle used by client autosave orchestration and server recovery enforcement.
- `expert_edit_preset_panel_labels` (text[], default `{'Selfie','Side Profile','Enhance Realism'}`): Persistent per-user Expert Edit preset panel chip allocation (max 11 labels enforced by client normalization).
- `expert_edit_preset_panel_ids` (text[], default `{'selfie','side_profile','enhance_realism'}`): Canonical per-user Expert Edit preset panel allocation stored by preset ID (max 11 IDs enforced by client normalization).
- `expert_edit_custom_presets` (jsonb, default `{}`): Per-user preset override map keyed by canonical preset id (`selfie`, `side_profile`, `custom_1..custom_18`, etc.) storing `{ label, prompt }` values.
- `ai_studio_deleted_style_ids` (text[], default `{}`): Per-user style ID denylist used by the primary Styles Library panel to persist deletions across sessions/devices.
- `ai_studio_style_details_overrides` (jsonb, default `{}`): Per-user style-details overrides keyed by style id storing editable `style`, `title`, `referenceImageName`, and `stylePrompt` values plus optional metadata (`styleProfile`, `extractionMeta`) used by Styles Library creator quality/trace contracts.
- `ai_studio_character_quickswap_tip_hidden` (boolean, default `false`): Per-user flag that hides the embedded Character QuickSwap guidance bubble after high-density deck usage.
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now, maintained by trigger)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### billing_plans
- `id` (text, pk): free | media | studio | business.
- `display_name` (text): UI-facing plan label.
- `monthly_price_cents` (int): Plan price in cents.
- `monthly_credits_cents` (int): Recurring monthly credits allocated to the plan.
- `stripe_price_id` (text, nullable): Stripe recurring price ID when subscriptions are wired.
- `is_active` (boolean): Plan availability toggle.
- `created_at` (timestamptz, default now)
- RLS: select allowed for all users; writes are server/admin only.

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

### billing_profiles
- `user_id` (uuid, pk, references `auth.users(id)`): Owner.
- `plan_id` (text, fk -> `billing_plans.id`): Active plan.
- `stripe_customer_id` (text, nullable): Stripe customer reference.
- `stripe_subscription_id` (text, nullable): Stripe subscription reference.
- `subscription_status` (text): active | trialing | canceled | past_due | inactive (runtime values from Stripe sync).
- `current_period_end` (timestamptz, nullable): Subscription period end timestamp.
- `created_at` / `updated_at` (timestamptz)
- RLS: users can read/update their own row; privileged writes happen via server routes/webhooks.

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

### app_error_logs
- `id` (uuid, pk): Incident record ID.
- `fingerprint` (text): Hash of normalized source/message/stack/location for deduping repeats.
- `source` (text): e.g. client.runtime | client.unhandledrejection | client.api_response | client.api_network | client.react_error_boundary | client.route_change | generation.workflow_failure | generation.stale_timeout | api.exception | db.trigger.handle_new_user_billing_setup.
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

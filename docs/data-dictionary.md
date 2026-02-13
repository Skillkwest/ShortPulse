# Data Dictionary

Purpose: define the Supabase tables and demo analytics fields used by ShortPulse’s frontend-only experience.

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
- `source` (text, default `upload`): upload | private_upload | ai_studio | character_reference | character_generation.
- `source_ref` (uuid, nullable): References `ai_generations.id` when source is `ai_studio`.
- `prompt_id` (uuid, nullable): References `media_prompts.id` when saved from a prompt.
- `metadata` (jsonb, default `{}`): Provider/model metadata and any generation context.
  - Character profile uploads store `character_id` and `role = character_profile` for traceability.
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity checks:
  - `source` constrained to `upload | private_upload | ai_studio | character_reference | character_generation`.
  - `source` is non-null with default `upload` (see `sql/migrations/007_harden_media_source_and_usage_rpc.sql`).
  - `source = private_upload` requires `file_type = image` and `storage_path` under `<user_id>/private/images/...`.
  - Any row with `storage_path` under `<user_id>/private/images/...` must use `source = private_upload`.
  - `source = character_reference` requires `file_type = image`, `storage_path` under `<user_id>/characters/...`, and metadata keys for `character_id`, `reference_pack_id`, and `slot_key` (see `sql/migrations/010_harden_character_reference_media_integrity.sql`).

### Media usage RPCs
- `get_media_library_usage_bytes()`: returns total `file_size` bytes for the authenticated user’s `media_files` rows.
- Used by: `frontend/pages/media-library.tsx` for accurate storage usage display independent of paged list cache.

### characters
- `id` (uuid, pk)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `name` (text): Character display name.
- `status` (text): draft | active | archived.
- `active_reference_pack_id` (uuid, nullable): Active reference pack pointer for generation workflows.
- `metadata` (jsonb, default `{}`)
  - Character profile image linkage keys:
    - `profile_image_storage_path` (text path in `media_library`)
    - `profile_image_media_file_id` (uuid of linked `media_files` row)
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
- `reference_pack_id` (uuid): Parent reference pack.
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `slot_key` (text): Fixed character reference slot key.
- `media_file_id` (uuid): Linked `media_files` row.
- `storage_path` (text): Canonical private object path under `<user_id>/characters/<character_id>/<reference_pack_id>/<slot_key>/...`.
- `validation_status` (text): pending | pass | warn | fail.
- `validation_notes` (jsonb, default `{}`)
- `created_at` / `updated_at` (timestamptz)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.
- Integrity:
  - `storage_path` must match the character/pack/slot path convention.
  - Trigger `trg_character_reference_images_media_integrity` enforces that linked `media_files` row stays user-owned, uses `source = character_reference`, and has matching path/metadata.

### character_generation_jobs
- `id` (uuid, pk)
- `character_id` (uuid): Parent character.
- `reference_pack_id` (uuid): Parent reference pack used by generation.
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

### ai_generations
- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `mode` (text): image | video.
- `provider` (text): fal | kei | ...
- `model_id` (text): Model used to generate.
- `prompt_text` (text): Prompt used for the generation.
- `aspect` (text, nullable)
- `duration_seconds` (int, nullable)
- `resolution` (text, nullable)
- `request_id` (text, nullable)
- `status` (text, default `pending`): pending | running | success | fail.
- `error_message` (text, nullable)
- `created_at` (timestamptz, default now)
- `completed_at` (timestamptz, nullable)
- `metadata` (jsonb, default `{}`): Provider payload summary.
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

### media_events
- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `event_type` (text): upload | delete | rename | move | prompt_saved | generation_saved | generation_failed.
- `entity_type` (text): media_file | media_prompt | ai_generation.
- `entity_id` (uuid): Row id the event refers to.
- `metadata` (jsonb, default `{}`): Event payload details.
- `created_at` (timestamptz, default now)
- RLS: select + insert allowed only when `user_id = auth.uid()`.

### user_preferences
- `user_id` (uuid, pk, references `auth.users(id)`): Profile owner.
- `beginner_mode` (boolean, default `true`): AI Studio beginner mode toggle.
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
- `created_at` / `updated_at` (timestamptz)
- `captured_at` / `released_at` (timestamptz, nullable)
- RLS: users can select only own reservations (`user_id = auth.uid()`); server-side functions handle writes.
- Provisioned by: `sql/migrations/002_add_generation_credit_reservations.sql`.

### Reservation lifecycle RPCs
- `reserve_generation_credits(...)`: creates or idempotently confirms a reservation if funds are available.
- `mark_generation_reservation_submitted(...)`: attaches provider request id to a reserved row.
- `capture_generation_reservation_by_provider_request(...)`: writes ledger debit + marks reservation captured.
- `release_generation_reservation_by_source_ref(...)`: releases reservation by source reference.
- `release_generation_reservation_by_provider_request(...)`: releases reservation by provider request id.
- Used by: `frontend/pages/api/_utils/generationBilling.ts`, `frontend/pages/api/_utils/falSubmitProxy.ts`, `frontend/pages/api/_utils/falStatusProxy.ts`.

### stripe_event_log
- `id` (text, pk): Stripe event ID (`evt_*`).
- `event_type` (text): Stripe event type.
- `received_at` (timestamptz, default now)
- `payload` (jsonb): Event payload snapshot.
- Purpose: webhook idempotency and audit trail.

### app_error_logs
- `id` (uuid, pk): Incident record ID.
- `fingerprint` (text): Hash of normalized source/message/stack/location for deduping repeats.
- `source` (text): client.runtime | client.unhandledrejection | client.api_response | client.api_network | api.exception | db.trigger.handle_new_user_billing_setup.
- `scope` (text): app | generation (generation scope is currently filtered from admin ingest).
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

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
- `storage_path` (text): Full path in the `media_library` bucket (prefix with `auth.uid()`).
- `file_type` (text): image | video (or MIME-derived fallback).
- `file_size` (bigint, nullable): Bytes.
- `source` (text, default `upload`): upload | ai_studio.
- `source_ref` (uuid, nullable): References `ai_generations.id` when source is `ai_studio`.
- `prompt_id` (uuid, nullable): References `media_prompts.id` when saved from a prompt.
- `metadata` (jsonb, default `{}`): Provider/model metadata and any generation context.
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)
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
- `event_type` (text): upload | delete | rename | prompt_saved | generation_saved | generation_failed.
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
- `id` (text, pk): free | media | pro | creative_suite.
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
- `metadata` (jsonb): Extra context (method, user agent, route label, etc.).
- `first_seen_at` / `last_seen_at` (timestamptz): First/most recent observed timestamps for this grouped incident.
- `occurrences_count` (int): Number of times this incident has recurred.
- `created_at` / `updated_at` (timestamptz)
- RLS: enabled with no client policies by default (service-role/server-only writes and reads).

### storage.objects (Supabase bucket)
- Bucket: `media_library` (private).
- Policy: allow select/insert/update/delete when bucket is `media_library` **and** the folder prefix matches `auth.uid()` (or service role).
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

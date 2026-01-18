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
- `user_id` (uuid, default `auth.uid()`): Owner for RLS scoping.
- `created_at` (timestamptz, default now)
- RLS: select/insert/update/delete allowed only when `user_id = auth.uid()`.

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

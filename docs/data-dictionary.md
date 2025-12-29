# Data Dictionary

Purpose: define core tables and derived metrics used by ShortPulse.

## Tables
### reels_raw_events
- `id` (uuid, pk)
- `reel_id` (string): Platform-specific id or shortcode.
- `platform` (string): instagram | tiktok | youtube.
- `reel_url` (string): Canonical URL to the reel/short.
- `scraped_at` (timestamptz): When the event was ingested.
- `publish_time` (timestamptz): When the content was published.
- `views`, `likes`, `comments` (int): Raw counts at scrape time.
- `shares_or_saves` (int, nullable): Shares or saves count when available.
- `caption_text` (text, nullable)
- `audio_id`, `audio_name` (string, nullable)
- `duration_seconds` (float, nullable)
- `apify_run_id` (string): Source run identifier.
- `source_surface` (string): Source surface (default reels_feed).
- `created_at` (timestamptz): Insert timestamp.

### reels_latest_state
- `reel_id` (pk): Same as raw events.
- `platform`, `reel_url`: Canonical platform and URL.
- `publish_time` (timestamptz): Original publish time.
- `latest_views`, `latest_likes`, `latest_comments`, `latest_shares_or_saves` (int): Latest known counts.
- `latest_scraped_at` (timestamptz): Timestamp of latest scrape.
- `caption_text`, `audio_id`, `audio_name`, `duration_seconds` (nullable): Metadata.
- `updated_at` (timestamptz): Auto-updated timestamp.

## Derived metrics (computed in `app/metrics.py`)
- `hours_since_publish`: Max of 1 minute and elapsed hours since publish.
- `views_per_hour`: `latest_views / hours_since_publish`.
- `engagement_rate`: `(likes + comments + shares_or_saves) / views` (0 if views is 0).
- Percentiles: computed per cohort for `views`, `views_per_hour`, `engagement_rate` (0–100).
- `performance_score`: weighted blend `0.45*engagement_percentile + 0.40*views_per_hour_percentile + 0.15*views_percentile`.

## Notes
- Duplicate raw events are de-duplicated via `uq_reel_scrape_run` on `(reel_id, scraped_at, apify_run_id)`.
- Latest state upserts on `reel_id` to keep the freshest snapshot per video.

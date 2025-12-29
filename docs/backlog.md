# ShortPulse Backlog & Ideas

Use this as the running list of tasks and future ideas. Keep items concise and scoped; move completed work into the progress log.

## Near-term (MVP hardening)
- Wire real `DATABASE_URL` (Supabase service role) and run Alembic or `sql/create_reels_tables.sql` in Supabase SQL.
- Add Apify credentials (`APIFY_API_TOKEN`, `APIFY_ACTOR_ID`) and validate output fields match ingestion mapping.
- Add minimal unit tests for percentile math and ingestion mapping.
- Add basic runtime logging/monitoring (structured logs, error alerts).
- Verify scheduler cadence (6h) in production runtime and cap result size to ~200 per run.

## Product/Data
- Add 7d cohort regeneration job to rebuild percentiles in case of data anomalies.
- Implement top-performer threshold marker (95th) tuning based on real data volume.
- Capture Apify actor input in config for versioning.

## Backend/Infra
- Add deploy artifacts (Dockerfile/compose or Procfile) for API + frontend bundle.
- Add healthcheck endpoint for scheduler status (last ingestion run, rows ingested).
- Add pagination support for `/reels/performance` if volume grows.
- Implement rate limiting or auth token for API access.

## Frontend/UX
- Wire performance page filters to backend time windows (7d/30d/90d) instead of client-side filtering only.
- Make tooltips resilient to long URLs (truncate with ellipsis).
- Add platform filter tabs (IG/TikTok/YT) driven by backend data once ingestion expands.
- Integrate Media Library UI with Supabase storage/auth (RLS enforced) and add uploads/listing.
- Fix Media Library blow-up modal aesthetics for images & videos: auto-resize preview container to match media aspect ratio, eliminate blank space, and keep the rounded corners consistent.

## Documentation
- Write API endpoint reference with request/response examples.
- Add runbook for production ingestion failures and Apify errors.
- Create contributor guide (branching, linting, testing expectations).

## Later/Future (post-MVP)
- Multi-platform ingestion (TikTok/YouTube) with palette extensions.
- ML experiments: early performance prediction baseline once data is sufficient.

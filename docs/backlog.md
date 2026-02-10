# ShortPulse Backlog & Ideas

Use this as the running list of tasks and future ideas. Keep items concise and scoped; move completed work into the change log.

## Near-term (MVP hardening)
- **[HIGH PRIORITY] Create Stripe price IDs for updated billing tiers** (Free, Media, Studio, Business) and credit packages (starter_500, growth_2000, scale_6000, studio_10000). Document price IDs and update `billing_plans.stripe_price_id` and `billing_credit_packages.stripe_price_id` in Supabase.
- Confirm Supabase schemas (`saved_creators`, `media_files`) and RLS work end-to-end.
- Add lightweight component/integration tests for auth + saved creators + media library.
- Add client-side logging/error surfacing for Supabase operations.
- Expand manual data actions on Performance (status history, filter reset affordances).

## Product/Data
- Add CSV import/export for saved creators.
- Ship additional demo dataset variants (per niche) and allow switching cohorts in the UI.
- Display plan usage counters (searches/storage/credits) sourced from client-side state.

## Frontend/UX
- Make tooltips resilient to long URLs (truncate with ellipsis).
- Add platform filter tabs (IG/TikTok/YT) driven by the demo dataset toggle.
- Integrate Media Library UI polish: error banners, retries, empty state for RLS failures.
- Fix Media Library blow-up modal aesthetics for images & videos: auto-resize preview container to match media aspect ratio, eliminate blank space, and keep the rounded corners consistent.

## Documentation
- Document Supabase bootstrap for `media_files` alongside `saved_creators`.
- Add SOP for the performance data actions rail and how demo metrics are recomputed client-side.
- Add contributor guide sections for testing expectations once a harness is chosen.

## Later/Future (post-MVP)
- Explore live data sources or edge functions if we reintroduce backend capabilities.
- ML experiments: early performance prediction baseline once real data is available again.

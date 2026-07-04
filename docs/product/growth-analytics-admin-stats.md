# Growth Analytics Admin Stats

Purpose: define the lean growth analytics contract layered onto `/admin/stats`.

## Scope

The stats workspace has three growth/product analytics lenses:

- `Product`: existing usage, model, workflow, asset, and project analytics.
- `Marketing`: signup, activation, time-to-value, retention, and source/campaign attribution.
- `Sales`: pricing intent, checkout behavior, paid conversion, and high-intent/PQL users.

Storage now lives on the sibling `/admin/storage` page: Supabase usage snapshots, product-tracked media storage, recurring storage add-on capacity/MRR, plan storage rows, and local capacity risk.

This is intentionally not a full CDP, CRM pipeline, billing ledger, or provider invoice reconciliation surface. The current scope is admin-side product-growth visibility plus a separate storage-economics workspace.

## Canonical Definitions

- `Signup`: `billing_profiles.created_at`
- `Activated`: first `media_events.event_type='generation_saved'` or first `project_generation_items.created_at`, whichever happens first within 7 days of signup
- `Time-to-value`:
  - signup -> first generate click
  - signup -> first successful generation
  - signup -> activation
  - first generate click -> activation
- `PQL`: activated user who satisfies any 2 of:
  - `3+` saved outputs
  - `1+` project created or project-attached generation
  - activity on `2+` distinct UTC days
  - `5+` successful generations
  - `100+` spent credits (`ai_credit_ledger` negative deltas)
- `Paid converted`: first Stripe-backed paid `billing_subscription_contracts` row (`contract_source='stripe'`)

## Source Of Truth

- Top-of-funnel attribution:
  - `growth_attribution_identities`
  - allowlisted public/authenticated growth telemetry in `app_error_events`
- Product intent and value:
  - `app_error_events`
  - `ai_generations`
  - `generation_projection`
  - `media_events`
  - `projects`
  - `project_generation_items`
- Sales and commercial state:
  - `billing_profiles`
  - `billing_subscription_contracts`
  - `ai_credit_ledger`
- Storage state:
  - `media_files.file_size`
  - `billing_subscription_contracts.storage_limit_bytes`
  - `billing_profiles.plan_id`
  - `billing_plans`
  - `billing_storage_addons`
  - `billing_storage_addon_offers`
  - `billing_subscription_storage_addons`
  - `admin_storage_usage_snapshots`
  - sanitized storage add-on mutation telemetry in `app_error_events`

## Attribution Contract

- Anonymous id: browser-local `sp_growth_anonymous_id`
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
- Stitching rule:
  - anonymous attribution rows are linked to the authenticated user when an allowlisted growth telemetry event arrives with both bearer auth and the browser anonymous id.
- V1 limitation:
  - no cross-device attribution stitching

## Event Families

- `telemetry.marketing.page_view`
- `telemetry.marketing.cta_clicked`
- `telemetry.auth.signup_submitted`
- `telemetry.auth.signup_completed`
- `telemetry.billing.pricing_viewed`
- `telemetry.billing.upgrade_clicked`
- `telemetry.billing.checkout_started`
- `telemetry.billing.checkout_completed`
- `telemetry.storage.addon`

Growth telemetry remains telemetry-only rows in `app_error_events`; it does not open grouped incidents in `app_error_logs`. Storage add-on telemetry uses the existing app-error event surface with sanitized event-name metadata for admin counting and must not include raw storage paths, signed URLs, prompt text, payment details, or Stripe secrets.

## Admin Read Surface

- `/admin/stats`
- `/admin/storage`
- `/api/admin/stats/global`
- `/api/admin/storage-economics`
- `get_admin_global_stats_v1()`
- `get_admin_growth_stats_v1()`

The stats workspace degrades safely when the growth RPC is missing, leaving Product analytics intact while Marketing/Sales fall back to empty states with an operator-facing warning. Storage is a sibling admin page and endpoint, not part of the product/growth stats RPC. It reports the latest service-role Supabase usage snapshot plus product-tracked storage and local capacity risk; it is not proof of provider invoices, live Stripe state, or customer-facing pricing readiness unless the snapshot source and freshness say so.

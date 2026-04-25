# Growth Analytics Admin Stats

Purpose: define the lean growth analytics contract layered onto `/admin/stats`.

## Scope

The stats workspace now has three lenses:

- `Product`: existing usage, model, workflow, asset, and project analytics.
- `Marketing`: signup, activation, time-to-value, retention, and source/campaign attribution.
- `Sales`: pricing intent, checkout behavior, paid conversion, and high-intent/PQL users.

This is intentionally not a full CDP or CRM pipeline. The current scope is admin-side product-growth visibility only.

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
- `Paid converted`: first non-free Stripe-backed `billing_subscription_contracts` row (`contract_source='stripe'`)

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

All of these remain telemetry-only rows in `app_error_events`; they do not open grouped incidents in `app_error_logs`.

## Admin Read Surface

- `/admin/stats`
- `/api/admin/stats/global`
- `get_admin_global_stats_v1()`
- `get_admin_growth_stats_v1()`

The route degrades safely when the growth RPC is missing, leaving Product analytics intact while Marketing/Sales fall back to empty states with an operator-facing warning.

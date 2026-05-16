# Product Docs

Purpose: product/domain source-of-truth documents used by engineering, product, and operations.

## What belongs here
- Pricing catalogs and model-pricing contracts.
- Product-level workflow definitions and source-of-truth behavior docs.
- Domain strategy docs that influence implementation.

## What does not belong here
- Step-by-step operational runbooks (use `docs/sops/`).
- Durable architecture decisions (use `docs/adr/`).
- Historical/deprecated planning artifacts (use `docs/archive/`).

## Active inventory
- `docs/product/ai-studio-pricing.md`
- `docs/product/billing-pricing-catalog.md`
- `docs/product/media-storage-save-blocking.md`
- `docs/product/shortpulse_ai_studio.md`
- `docs/product/shortflow_outlier_source_of_truth.md`
- `docs/product/shortpulse_top_performing_videos_source_of_truth.md`
- `docs/product/short_pulse_ideal_customer_profile_icp.md`

## Quality bar
- Clearly label source-of-truth vs conceptual guidance.
- Include update triggers (when this doc must change).
- Keep references to related SOP/API docs current.
- Move legacy product guides to `docs/archive/product/` when superseded.

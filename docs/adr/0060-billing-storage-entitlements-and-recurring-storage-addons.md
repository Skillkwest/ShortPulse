# 0060: Billing Storage Entitlements And Recurring Storage Add-Ons

## Status
Accepted - 2026-04-23

## Context
ShortPulse already supports versioned billing offers and subscriber contracts for recurring plan pricing, but media storage capacity was still a hard-coded `1 GB` UI placeholder and not a first-class entitlement.

The repo also has multiple media persistence lanes:
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/pages/api/media/copy-from-url.ts`
- `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`

That means storage enforcement cannot live only in the route page or one client flow.

There was also a product-policy ambiguity about what should count toward customer quota. Internal derivative assets such as posters, previews, and thumbs consume infrastructure storage, but they are implementation details rather than user-authored source media.

## Decision
1. Storage capacity is part of the billing entitlement model.
   - `billing_plans` stores shared tier storage limits.
   - `billing_plan_offers` stores versioned public storage limits.
   - `billing_subscription_contracts` stores locked subscriber storage limits.

2. Recurring storage add-ons are modeled as first-class recurring billing catalog items.
   - `billing_storage_addons` stores the shared add-on catalog.
   - `billing_storage_addon_offers` stores versioned public recurring add-on offers.
   - `billing_subscription_storage_addons` stores subscriber-specific recurring add-on contracts.

3. Customer-facing storage quota counts only canonical saved media represented by `media_files.file_size`.
   - Derived poster/thumb/preview assets do not count against customer quota.
   - Internal storage growth from derivatives remains an operator concern, not a customer billing concern.

4. Quota enforcement is database-authoritative on `media_files`.
   - A shared quota RPC resolves used bytes, base plan storage, add-on storage, total entitlement, remaining bytes, and over-limit status.
   - A `media_files` trigger blocks inserts/updates that would exceed the effective storage entitlement.
   - App code still performs best-effort cleanup of already-uploaded storage objects if the DB insert fails due to quota.

5. Recurring storage add-ons are synchronized from Stripe subscription items.
   - Base plan recurring contract remains synchronized from the plan subscription item.
   - Storage add-ons are synchronized from additional subscription items on the same Stripe subscription.

## Initial Product Ladder
- `free`: `1 GB`
- `media`: `25 GB`
- `studio`: `100 GB`
- `business`: `500 GB`

Initial recurring storage add-ons:
- `+25 GB` for `$5/month`
- `+100 GB` for `$15/month`
- `+500 GB` for `$49/month`

## Consequences
### Positive
- Storage limits are no longer hard-coded UI values.
- Grandfathered storage capacity can evolve the same way grandfathered pricing does.
- All canonical media write paths share one storage rule.
- Storage add-ons can be explained, sold, and reconciled as real subscription entitlements.

### Negative
- Billing synchronization becomes more complex because Stripe subscriptions may contain multiple item types.
- Upload flows need cleanup handling for quota-triggered DB rejections after storage upload already happened.
- Docs and support tooling must distinguish customer quota from raw infrastructure storage.

## Notes
- Over-limit policy remains fail-closed for new writes and fail-open for reads/deletes.
- Downgrades that place an account over limit do not delete existing files; they only block new writes until usage drops below entitlement or capacity is increased.

# ADR 0059: Billing Internal Comp Contracts and Admin Exempt Renewals

## Status
Accepted

## Context
ShortPulse already supports grandfathered recurring pricing through versioned offers and subscriber contracts, but recurring monthly credit renewals are still Stripe-owned in practice:

- Stripe-paid subscriptions renew through `frontend/pages/api/billing/stripe/webhook.ts`.
- Manual admin plan alignment in the database does not produce future monthly credit re-ups.
- Admin/support needs a non-public way to grant `media`, `studio`, or `business` access for internal testing, founder/admin accounts, and support comp scenarios without creating fake Stripe subscriptions.

The repo already has most of the structural primitives needed for this:

- `billing_plan_offers` supports hidden/non-acquisition offers and nullable `stripe_price_id`.
- `billing_subscription_contracts` already stores per-user plan, offer, recurring amount, monthly credits, and billing period boundaries.
- `/admin` already has user-level support actions, billing diagnostics, and manual credit adjustments.

What is missing is a first-class contract source for non-Stripe recurring access plus a renewal path that can mint monthly credits without waiting for a Stripe invoice.

## Decision
ShortPulse should treat internal exempt access as a billing contract source, not as a separate public plan tier.

The proposed model is:

1. Product tier stays unchanged.
   - `billing_plans` remains the tier identity surface: `free`, `media`, `studio`, `business`.

2. Subscriber contract gains an explicit source.
   - Add `contract_source` (or equivalent) to `billing_subscription_contracts`.
   - Initial values:
     - `stripe`
     - `internal_comp`

3. Internal exempt access uses hidden offer rows.
   - Add non-public offers such as:
     - `media__internal_comp`
     - `studio__internal_comp`
     - `business__internal_comp`
   - These offers should not be acquisition-enabled and should not require a Stripe price id.
   - They should store the recurring commercial snapshot used for support and entitlement reads:
     - `recurring_price_cents = 0`
     - tier monthly credits snapshot

4. Admin grant/revoke must flow through a trusted server path.
   - `/admin` should expose a manual internal-access control for privileged operators only.
   - The server mutation should upsert the runtime projection in `billing_profiles` and the current row in `billing_subscription_contracts`.

5. Internal exempt renewals should not depend on login-time side effects.
   - Add a dedicated internal renewal route that scans due `internal_comp` contracts, grants the monthly allocation idempotently, and advances `current_period_start` / `current_period_end`.
   - Stripe webhook renewal handling remains the only renewal path for `contract_source = 'stripe'`.

6. Diagnostics must understand valid non-Stripe paid access.
   - `/api/admin/billing-diagnostics` and related admin read models should distinguish `stripe` vs `internal_comp`.
   - Missing Stripe price ids or subscriptions should only be critical for Stripe-owned contracts.

Recommended first policy defaults:

- Internal exempt access is admin-managed only and not visible in public acquisition flows.
- Granting internal exempt access should seed the current billing period immediately so the account is usable for testing as soon as the override is applied.
- Revoking internal exempt access should fall the account back to `free` unless a trusted operator explicitly moves it to another contract source.
- Assigning internal exempt access to a user with an active Stripe contract should require explicit takeover behavior in the admin flow rather than silently coexisting.

## Consequences
- Positive:
  - Admin and internal test accounts can exercise paid tiers without fake Stripe subscriptions.
  - Monthly credit re-ups become possible for valid non-billed accounts.
  - The billing model stays coherent by keeping plan tier separate from billing source.
  - Support tooling can explain why an account has paid entitlements without a live Stripe subscription.
- Negative:
  - Billing renewal logic now has two ownership paths: Stripe and internal scheduler.
  - Admin UX and diagnostics need stronger guardrails to avoid accidental contract overrides.
  - Contract history and audit fields become more important because manual overrides are sensitive.
- Follow-ups:
  - Add contract audit metadata such as grant reason and operator identity.
  - Implement the admin mutation route and renewal runner.
  - Update SOP and product/billing docs once implementation lands.

## Alternatives considered
- Add a public `admin` plan:
  - Rejected because billing source should not be modeled as a public product tier.
- Keep using direct database edits for internal access:
  - Rejected because it does not renew monthly credits, does not produce an audit trail, and is too error-prone.
- Reuse Stripe test subscriptions for all internal accounts:
  - Rejected because it conflates internal comp access with paid recurring contracts and weakens support diagnostics.

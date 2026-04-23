# ADR 0058: Billing Grandfathered Offers and Subscriber Contracts

## Status
Accepted

## Context
ShortPulse needs billing that behaves like a normal SaaS subscription system:

- New customers buy from the current public offer catalog.
- Existing subscribers keep the price they originally bought in at while their subscription remains active.
- One plan tier can therefore have multiple subscriber prices over time.
- The account UI must show the user's actual recurring price, not just the latest public catalog price.

The current billing model stores recurring price on `billing_plans` and links the user to a tier through `billing_profiles.plan_id`. That is sufficient for "one global price per plan" but not for grandfathered pricing, price-version history, or auditability.

## Decision
ShortPulse will separate billing into three layers:

1. `billing_plans`
   - Product-tier identity and shared entitlement family (`free`, `media`, `studio`, `business`).
   - This is not the authoritative source for an individual subscriber's recurring price.

2. `billing_plan_offers`
   - Versioned acquisition offers for each plan tier.
   - Each offer stores its own Stripe price id, recurring price snapshot, and monthly credits snapshot.
   - Public pricing changes create a new offer row and a new Stripe Price instead of mutating historical offers in place.

3. `billing_subscription_contracts`
   - Per-subscriber contract rows tied to a user, plan, offer, and Stripe subscription/price identifiers.
   - Contracts store immutable commercial snapshots (`recurring_price_cents`, `monthly_credits_cents`) so historical subscriber terms remain auditable even if catalog rows later change.
   - The table allows historical rows; only one current contract row per user and one current row per Stripe subscription may remain open at a time.

Policy defaults for the first implementation:

- Grandfathered price:
  - Existing subscribers keep their current recurring price while the subscription remains continuously active.
- Grandfathered credits:
  - Included monthly credits are grandfathered with the offer and stored alongside recurring price.
- Upgrade or downgrade:
  - Changing to another plan moves the user onto the current public offer for the target plan unless an operator explicitly applies an exception.
- Cancel and restart:
  - Cancellation at period end keeps access through the paid term.
  - Restarting later uses the current public offer by default; prior grandfathered pricing is not automatically restored.
- Admin exceptions:
  - Operators may preserve or assign legacy pricing manually through trusted server/admin paths only.

## Consequences
- Positive:
  - Existing subscribers can keep legacy pricing without blocking future price changes.
  - The account UI can show a truthful "your subscription" contract separate from current public pricing.
  - Stripe price changes become additive and operationally safer.
  - Historical billing terms remain auditable.
- Negative:
  - Billing schema and webhook logic become more complex.
  - The app now needs to distinguish current acquisition offers from subscriber contracts in both backend and UI code.
  - Existing subscriber rows need backfill/migration into the new contract model.
- Follow-ups:
  - Refactor webhook settlement and account-page reads to use contract data.
  - Update the account UX to separate "your subscription" from "available plans".
  - Add admin/reconciliation tooling for contract drift and legacy pricing support.

## Alternatives considered
- Keep `billing_plans` as both catalog and subscriber-price source:
  - Rejected because it cannot support grandfathered pricing truthfully.
- Store only Stripe price id on the user and infer everything else dynamically:
  - Rejected because it weakens internal auditability and makes support/debugging harder.
- Store only one mutable contract row per user:
  - Rejected because it loses historical commercial terms after plan or offer changes.

# Nogo Handoff: Storage Pricing Catalog And Customer UI Update

Date: 2026-07-01
Repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Branch policy: pre-launch `production` only
Primary owner: Money Stuff / customer commerce billing
Source steward: Nogo / infrastructure-spend analytics
Task type: implementation handoff

## Goal

Update the actual product catalog, customer-facing UI, profile storage UX, admin pricing surfaces, docs, and tests so ShortPulse presents and sells the new storage plan limits and recurring storage add-on packages correctly.

This is the implementation packet for changing the numbers and wiring the package buttons. It should be paired with the separate no-stacking handoff:

- `docs/agents/nogo/workspace/handoffs/2026-07-01-storage-addon-no-stacking-limits-handoff.md`

Do not ship the UI/catalog changes without the no-stacking guardrails, or users may be able to combine add-ons in ways the pricing model does not support.

## Final Product Numbers

Base plan storage:

| Plan                   | Monthly price | Credits/mo | Storage | Concurrent generations |
| ---------------------- | ------------: | ---------: | ------: | ---------------------: |
| Hidden baseline access |            $0 |          0 |    0 GB |                      0 |
| Starter                |           $15 |        350 |    5 GB |                      1 |
| Media                  |           $49 |      1,200 |   25 GB |                      2 |
| Studio                 |          $129 |      3,200 |   75 GB |                      4 |
| Business               |          $299 |      7,500 |  150 GB |                      8 |

Recurring storage add-ons:

| Add-on id       | Display name | Storage |           Price | Public self-serve? | Availability            |
| --------------- | ------------ | ------: | --------------: | ------------------ | ----------------------- |
| `storage_10gb`  | Extra 10 GB  |   10 GB |           $7/mo | yes                | any paid plan           |
| `storage_50gb`  | Extra 50 GB  |   50 GB |          $29/mo | yes                | Media, Studio, Business |
| `storage_100gb` | Extra 100 GB |  100 GB |          $59/mo | yes                | Studio, Business        |
| `storage_250gb` | Extra 250 GB |  250 GB |         $149/mo | yes                | Business only           |
| `storage_500gb` | Extra 500 GB |  500 GB | $299/mo minimum | no                 | manual review only      |

Keep the public product rule plain:

- baseline access has no storage;
- storage begins with a paid subscription;
- users can add one eligible recurring storage package at a time;
- larger storage is available through higher plans or manual review.

## Current Surfaces To Read

Load:

- `AGENTS.md`
- `docs/agents/Money Stuff/README.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/product/billing-pricing-catalog.md`
- `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
- `frontend/features/billing/catalog.ts`
- `frontend/features/billing/storage.ts`
- `frontend/features/billing/components/SubscriptionPlanCard.tsx`
- `frontend/features/pricing/`
- `frontend/features/profile/components/ProfileStorageSection.tsx`
- `frontend/features/profile/components/ProfileSubscriptionSection.tsx`
- `frontend/pages/profile.tsx`
- `frontend/lib/server/api/billingCatalog.ts`
- `frontend/pages/api/billing/catalog.ts`
- `frontend/pages/api/admin/pricing/storage-offers/create.ts`
- `frontend/features/admin/PricingStorageAddonsSection.tsx`
- `sql/create_billing_credit_tables.sql`
- `sql/migrations/087_add_storage_entitlements_and_recurring_storage_addons.sql`
- `sql/migrations/116_add_atomic_admin_pricing_offer_activation_rpcs.sql`

Important current drift:

- `frontend/features/billing/catalog.ts` still has fallback storage values that should be updated if the DB is missing or degraded.
- `frontend/features/billing/storage.ts` was recently corrected so hidden baseline gets `0` storage and Starter has an explicit fallback. Verify the current worktree before editing.
- Live DB catalog currently has Starter 1 GB, Studio 100 GB, Business 500 GB, and add-ons 25/100/500 GB. The next agent must update the live-catalog path through migrations/admin offers/Stripe, not only UI constants.
- Business card copy may still imply `+500 bonus credits every month` while the live offer grants `7,500` credits. Do not solve that unless the user explicitly includes it in scope, but flag it in closeout if still present.

## Required Implementation Scope

### 1. Catalog Constants And Fallbacks

Update fallback plan storage values:

- `frontend/features/billing/catalog.ts`
- `frontend/features/billing/storage.ts`
- any pricing/profile fixtures or test factories

Expected fallback values:

```text
free: 0 GB
starter: 5 GB
media: 25 GB
studio: 75 GB
business: 150 GB
```

The DB/live catalog remains the commercial source of truth. Fallbacks are for degraded or local states only, but they must not lie.

### 2. Database Seed And Migration Path

Update seed/current migration path so fresh environments create:

Plans:

- Starter: 5 GB
- Media: 25 GB
- Studio: 75 GB
- Business: 150 GB
- hidden baseline/free: 0 GB

Storage add-ons:

- remove or retire the public `storage_25gb`, `storage_100gb`, `storage_500gb` ladder;
- add `storage_10gb`, `storage_50gb`, `storage_100gb`, `storage_250gb`;
- create `storage_500gb` only if it can stay non-public/manual-review;
- keep old historical rows safe for existing subscriber contracts if any exist.

Do not delete historical billing rows casually. Existing subscribers may reference old offer ids, Stripe price ids, or storage add-on ids.

Recommended migration posture:

- Insert new add-on metadata rows.
- Activate new public acquisition offers for 10/50/100/250 GB after Stripe price ids exist.
- End old public acquisition offers by setting `effective_end_at` and/or `acquisition_enabled = false`.
- Keep old add-on ids active only if needed for historical projection, or mark not acquisition-enabled while preserving subscriber compatibility.
- Keep `storage_500gb` acquisition disabled for self-serve.

If Stripe price ids are not available in the current session:

- create the migration or admin state with null/inactive Stripe ids only if the app already treats missing Stripe id as unavailable;
- otherwise stop with a clear "Stripe price creation required" note.

### 3. Stripe Product/Price Coordination

Stripe must have recurring monthly prices for public add-ons:

- `Extra 10 GB` at `$7/mo`
- `Extra 50 GB` at `$29/mo`
- `Extra 100 GB` at `$59/mo`
- `Extra 250 GB` at `$149/mo`

Manual review:

- `Extra 500 GB` at `$299/mo minimum` should not be public self-serve.
- If a Stripe price is created, keep it out of public catalog acquisition unless the user explicitly approves manual-review workflow buildout.

Do not mutate live Stripe without explicit user approval in the current thread.

### 4. Public Pricing UI

Update public plan cards and copy wherever storage is displayed.

Expected customer-facing storage labels:

- Starter: `5 GB of media storage`
- Media: `25 GB of media storage`
- Studio: `75 GB of media storage`
- Business: `150 GB of media storage`

Do not mention "baseline" as a customer plan. If a logged-in unpaid user sees storage state, they should see clear copy that storage requires a paid subscription.

If pricing cards mention add-ons:

- keep it compact;
- avoid implying unlimited or stackable storage;
- copy should say storage add-ons are available on eligible paid plans.

### 5. Profile Storage UX

Update `ProfileStorageSection` behavior:

- show only eligible self-serve add-ons for the user's current plan;
- show current active add-on clearly;
- do not show `storage_500gb` as a clickable self-serve option;
- prevent users from adding a second add-on if one is active;
- show a clear message for changing add-ons if replacement is not implemented yet;
- keep "remove" behavior clear about over-limit consequences.

Recommended copy:

```text
You can keep one recurring storage add-on active at a time.
```

For ineligible add-ons:

- either hide them from action rows or show them disabled with upgrade copy;
- do not create clutter. If disabled states become noisy, show a short "More storage is available on higher plans" line instead.

For manual 500 GB:

```text
Need 500 GB or more? Contact support for a storage review.
```

Only add contact/support CTA if a real support route exists or the product already has a support/report surface appropriate for this.

### 6. Admin Pricing UI

Update or verify:

- `frontend/features/admin/PricingStorageAddonsSection.tsx`
- `/admin/pricing` storage offer creation flow
- admin pricing state route
- admin confirmation copy
- any "Public storage add-ons" table or warnings

The admin page should make it clear which add-ons are public self-serve versus manual review or inactive.

If current admin storage-offer creation cannot represent plan eligibility or manual-review status, do not fake it with copy alone. Either:

- add the missing metadata/eligibility shape; or
- document the limitation and keep manual-review add-ons out of the public acquisition catalog.

### 7. Server Catalog Loader

Update `frontend/lib/server/api/billingCatalog.ts` so public catalog output does not include manual-review add-ons.

If eligibility is plan-specific, consider whether `/api/billing/catalog` should:

- return all public add-ons and let authenticated profile filter by plan; or
- return only add-ons eligible for the current authenticated user from a different account-summary endpoint.

Do not break public pricing route if it depends on anonymous catalog loading.

### 8. Docs

Update:

- `docs/product/billing-pricing-catalog.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/data-dictionary.md` if schema changes
- `docs/database-migrations.md` if migrations are added
- `docs/api/api-internal-routes.md` if route behavior changes
- `docs/routes.md` if route contract changes

Do not edit unrelated historical reports unless a docs check specifically requires an index update.

## Tests To Update Or Add

Expected touched tests may include:

- `frontend/features/billing/__tests__/catalog.test.ts`
- `frontend/features/billing/__tests__/storage.test.ts`
- `frontend/features/profile/components/__tests__/ProfileStorageSection.test.tsx`
- `frontend/tests/pages/profile.storage-actions.test.tsx`
- `frontend/tests/api/storage-addon-change.test.ts`
- admin pricing tests if storage add-on admin UI changes

Test cases:

- plan storage display uses 5/25/75/150 GB.
- hidden baseline/free displays 0 storage in fallback paths.
- public catalog excludes hidden baseline and manual-review 500 GB.
- profile shows eligible add-ons only.
- profile prevents a second add-on from being added.
- profile remove copy warns about over-limit blocking.
- admin pricing surface shows new add-ons and prices.
- API route rejects unavailable/ineligible/manual-review add-ons.

## Acceptance Criteria

The lane is complete when:

- all storage numbers in customer-facing UI match the final product decision;
- new add-on packages exist in the billing catalog shape;
- old 25/100/500 public package ladder no longer appears as the self-serve public offer set;
- buttons call the right `storageAddonId`;
- ineligible buttons cannot create checkout/subscription mutations;
- 500 GB is not public self-serve;
- docs and tests reflect the new product contract;
- no hidden baseline user can receive storage capacity.

## Proof Requirements

Minimum local proof:

- focused billing catalog tests;
- focused profile storage tests;
- focused storage add-on route tests;
- admin pricing tests if admin UI changes;
- `npm -C frontend run type-check:touched -- --path <touched frontend files>`;
- `git diff --check`.

Before production/live billing change:

- confirm Stripe recurring prices exist for public add-ons;
- confirm Supabase live catalog rows match Stripe price ids;
- confirm public `/pricing` and authenticated `/profile?section=storage` display the new values;
- confirm a paid account cannot stack add-ons;
- confirm a baseline/no-subscription account cannot add storage.

## Stop Conditions

Stop and ask the user before:

- changing live Stripe prices/products;
- applying production migrations;
- altering subscription prices beyond the storage values in this handoff;
- changing credits, plan names, or plan monthly prices;
- making 500 GB self-serve;
- deleting historical billing records;
- silently migrating existing subscribers to new storage prices.

## Known Risks

- UI changes without route/schema guards can create stackable storage.
- DB changes without Stripe prices can make packages visible but unpurchasable.
- Existing subscriber contracts may reference old add-on ids or price ids.
- Plan downgrade behavior may create incompatible add-on states unless paired with the no-stacking/eligibility handoff.
- Public and authenticated catalog loaders may need different filtering rules.

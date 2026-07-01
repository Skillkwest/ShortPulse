# Nogo Handoff: Storage Add-On No-Stacking And Eligibility Limits

Date: 2026-07-01
Repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Branch policy: pre-launch `production` only
Primary owner: Money Stuff / customer commerce billing
Source steward: Nogo / provider and infrastructure spending analytics
Task type: implementation handoff

## Goal

Implement the account-level limits that prevent users from stacking recurring media-storage add-ons into unintended storage bundles.

This handoff is not asking the next agent to change public prices or copy by itself. The goal is to enforce the business rule behind the new storage economics: a paid account may select one eligible recurring storage add-on at a time, with plan-specific maximum add-on tiers, and higher-capacity storage should be a deliberate plan or manual-review decision rather than a casual checkout side effect.

## Product Decision To Implement

Base plan storage:

| Plan                   | Storage |
| ---------------------- | ------: |
| Hidden baseline access |    0 GB |
| Starter                |    5 GB |
| Media                  |   25 GB |
| Studio                 |   75 GB |
| Business               |  150 GB |

Recurring add-on ladder:

| Add-on          |                       Price | Availability                              |
| --------------- | --------------------------: | ----------------------------------------- |
| `storage_10gb`  |            +10 GB for $7/mo | Any paid plan                             |
| `storage_50gb`  |           +50 GB for $29/mo | Media, Studio, Business                   |
| `storage_100gb` |          +100 GB for $59/mo | Studio, Business                          |
| `storage_250gb` |         +250 GB for $149/mo | Business only                             |
| `storage_500gb` | +500 GB for $299/mo minimum | Manual review only; not public self-serve |

No-stack rule:

- A user may have at most one active recurring storage add-on at a time.
- Add-on `quantity` must effectively be `1`; users must not buy two units of the same add-on.
- Adding a different add-on should be treated as a replacement/change flow, not a second concurrent subscription item.
- The public profile flow should not show or attempt self-serve purchase for manual-review add-ons.
- Server-side enforcement is required. UI hiding is not enough.

## Current Canonical Surfaces

Read these first:

- `AGENTS.md`
- `docs/agents/Money Stuff/README.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/product/billing-pricing-catalog.md`
- `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
- `frontend/pages/api/billing/storage-addon/change.ts`
- `frontend/lib/server/api/billingCatalog.ts`
- `frontend/pages/api/billing/stripe/webhook.ts`
- `frontend/features/profile/components/ProfileStorageSection.tsx`
- `frontend/pages/profile.tsx`
- `sql/create_billing_credit_tables.sql`
- `sql/migrations/087_add_storage_entitlements_and_recurring_storage_addons.sql`
- `sql/migrations/116_add_atomic_admin_pricing_offer_activation_rpcs.sql`

Current route behavior to watch:

- `frontend/pages/api/billing/storage-addon/change.ts` loads active rows only for the requested `storageAddonId`.
- That means a user can be blocked from buying the same add-on twice, but the current shape can still allow buying a different add-on if another active add-on exists.
- `billing_subscription_storage_addons.quantity` currently allows positive integers. Stripe update code sets `quantity: 1`, but webhook/runtime projection must still defend against external or future drift.
- The current DB has a unique active item index by `stripe_subscription_item_id`, not by active user add-on entitlement.

## Required Business Rules

### 1. Active Add-On Cardinality

At most one active storage add-on may exist per user.

Definition of active:

- `billing_subscription_storage_addons.ended_at is null`
- `status = 'active'`
- and the row is not merely historical, canceled, incomplete, or failed.

Recommended DB guard:

```sql
create unique index if not exists ux_billing_subscription_storage_addons_one_active_per_user
  on public.billing_subscription_storage_addons (user_id)
  where ended_at is null and status = 'active';
```

Before adding this index, audit production for existing violations. If violations exist, stop and produce a cleanup/reconciliation report instead of forcing the index.

### 2. Quantity Guard

Recurring storage add-ons should not be quantity-scaled. Every active row should represent exactly one package.

Recommended DB guard:

- Add or tighten a check constraint requiring `quantity = 1` for active rows.
- If historical rows contain other quantities, either allow historical rows or normalize only current rows with a constraint that does not break history.

Possible forward-safe shape:

```sql
alter table public.billing_subscription_storage_addons
  add constraint billing_subscription_storage_addons_quantity_one
  check (quantity = 1);
```

Only apply after checking existing data. If Stripe has ever projected quantity greater than `1`, stop and reconcile first.

### 3. Plan Eligibility

Plan eligibility must be enforced server-side.

Expected eligibility matrix:

| Active base plan                              | Self-serve add-ons allowed                                       |
| --------------------------------------------- | ---------------------------------------------------------------- |
| hidden baseline / no paid Stripe subscription | none                                                             |
| Starter                                       | `storage_10gb` only                                              |
| Media                                         | `storage_10gb`, `storage_50gb`                                   |
| Studio                                        | `storage_10gb`, `storage_50gb`, `storage_100gb`                  |
| Business                                      | `storage_10gb`, `storage_50gb`, `storage_100gb`, `storage_250gb` |

Manual review:

- `storage_500gb` should not be returned by the public catalog or accepted by the self-serve route.
- If it exists in the DB, keep its current public acquisition offer disabled or add a dedicated manual-review flag before exposing it.

Implementation options:

1. Short-term: centralize the eligibility map in a shared server helper.
2. Longer-term: add explicit eligibility metadata to the storage add-on catalog or offers.

Preferred short-term helper:

- Create something like `frontend/lib/billing/storageAddonEligibility.ts` or `frontend/lib/server/api/storageAddonEligibility.ts`.
- Export plan order, allowed add-on ids by plan, and manual-review detection.
- Reuse it from API, catalog shaping, and profile UI model tests.

Do not duplicate this matrix in the route and UI separately.

### 4. Replacement Behavior

The safest launch behavior is not "stack" and not silent "replace." It should be explicit:

- If the user has no active add-on and chooses an eligible add-on, add it.
- If the user already has an active add-on and clicks the same add-on, return an already-active message.
- If the user already has a different active add-on, the route should return a `409` explaining they must change/remove the current add-on before adding another, unless a full replacement flow is deliberately built.

Recommended first implementation:

- Block concurrent add-ons with a clear message.
- Do not implement cross-grade replacement in the first pass unless the product UI is also updated to show an explicit change confirmation.

Example user-facing route message:

```text
You already have an active storage add-on. Remove or change it before adding a different storage package.
```

Future replacement flow can be a separate lane:

- use one Stripe subscription update that deletes the current storage item and adds the new one with proration;
- show explicit "Change storage add-on" copy in the profile page;
- update tests for upgrade, downgrade, and over-limit outcomes.

### 5. Plan Downgrade And Incompatible Add-Ons

When a user downgrades to a plan that cannot carry the current add-on, fail closed.

Recommended launch posture:

- Block the downgrade route until the incompatible add-on is removed or changed.
- Do not silently remove a paid storage add-on during downgrade.
- Do not silently leave an incompatible add-on active on the lower plan.
- If Stripe portal allows direct changes that create incompatible local state, webhook/admin diagnostics should flag the account.

Surfaces to inspect:

- `frontend/pages/api/billing/subscription/change.ts`
- `frontend/pages/api/billing/stripe/webhook.ts`
- `frontend/lib/server/api/adminBillingDiagnostics.ts`
- profile subscription and storage sections

The next agent should decide whether to implement downgrade blocking in the same lane or create a follow-up handoff if the subscription route is complex. Do not ignore the downgrade case.

### 6. Over-Limit Storage State

If removing or changing an add-on leaves a user over their new limit:

- do not delete user media automatically;
- do block new uploads, autosaves, and generated-output saves if quota enforcement says the account is over limit;
- show clear profile/storage copy explaining that new saves may be blocked until usage drops or capacity increases.

Existing quota enforcement is based on:

- `get_media_storage_quota_summary`
- `enforce_media_storage_quota`
- `media_files.file_size`

Do not change quota counting in this lane unless needed to enforce add-on cardinality.

## Required Implementation Work

### Step 1. Data Audit

Before schema changes, run a read-only production-safe audit or create a SQL audit script that checks:

- active add-on rows per user,
- active rows with `quantity <> 1`,
- users with active Stripe storage subscription items that map to multiple local active rows,
- local rows that are active but missing Stripe item ids,
- Stripe items that webhook would project into multiple storage add-ons.

Do not paste raw user ids, Stripe ids, or customer identifiers into chat or tracked docs. Aggregate counts are enough.

### Step 2. Server Eligibility Helper

Create one shared eligibility helper that answers:

- is the base plan paid?
- which add-ons are self-serve for the plan?
- is an add-on manual review only?
- is the requested add-on eligible for the user's current plan?
- what is the user's maximum self-serve add-on capacity?

This helper should be covered by unit tests.

### Step 3. Storage Add-On Change Route

Update `frontend/pages/api/billing/storage-addon/change.ts`:

- load all active storage add-on rows for the user, not just rows matching the requested add-on id;
- reject add requests when any different active storage add-on exists;
- reject add requests for ineligible plan/add-on combinations;
- reject add requests for manual-review add-ons;
- reject if live Stripe already has any active storage add-on price, not only the target price;
- keep removal scoped and safe.

Important: Stripe live-item checks should use the set of current public and historical storage add-on Stripe price ids, not just the requested offer's current price id. Otherwise old active offer prices can bypass no-stack logic.

### Step 4. Webhook Projection Guard

Inspect `frontend/pages/api/billing/stripe/webhook.ts` and add diagnostics or reconciliation behavior so webhook projection cannot silently normalize multiple active storage items as valid.

Preferred launch behavior:

- If Stripe sends multiple active storage add-on items, project what is needed for support truth, but emit an admin/billing diagnostic warning.
- Do not grant stacked effective capacity by summing multiple active add-ons unless the product decision changes.
- If the current quota summary sums add-ons, adjust it only after a clear migration plan. The DB guard should prevent the bad state first.

### Step 5. Admin Billing Diagnostics

Update `frontend/lib/server/api/adminBillingDiagnostics.ts` so support/admin can see:

- multiple active storage add-ons for one account,
- quantity greater than `1`,
- add-on not eligible for current plan,
- manual-review add-on active without admin/manual flag,
- live Stripe item mismatch.

This is important because Stripe is external state. Even with server guards, admin diagnostics should catch drift.

### Step 6. Tests

Minimum tests:

- baseline/free user cannot add storage.
- Starter can add `storage_10gb` only.
- Media can add `storage_10gb` and `storage_50gb`, not `storage_100gb`.
- Studio can add through `storage_100gb`, not `storage_250gb`.
- Business can add through `storage_250gb`.
- `storage_500gb` is rejected by self-serve route.
- user with an existing active add-on cannot add a different add-on.
- same add-on duplicate returns already-active.
- Stripe live item with old storage price blocks new add-on stacking.
- quantity greater than `1` is rejected or diagnosed.
- downgrade incompatibility is blocked or at least diagnosed, depending on chosen scope.

Likely test files:

- `frontend/tests/api/storage-addon-change.test.ts`
- `frontend/tests/pages/profile.storage-actions.test.tsx`
- billing diagnostics tests if present or new focused tests.

## Acceptance Criteria

The lane is complete when:

- one active storage add-on per user is enforced in server logic;
- DB/index/constraint protection is added or a production-data blocker is documented;
- plan eligibility is centralized and tested;
- self-serve route rejects manual-review `500 GB`;
- UI can no longer create stacked add-ons through repeated button actions;
- Stripe live-item drift cannot bypass the rule silently;
- admin diagnostics report incompatible or stacked storage state;
- docs mention the no-stack policy and eligibility matrix;
- all touched tests pass.

## Proof Requirements

Minimum local proof:

- focused route tests for `storage-addon/change`;
- focused profile storage UI tests if UI behavior changes;
- any new eligibility helper tests;
- `npm -C frontend run type-check:touched -- --path <touched frontend files>`;
- `git diff --check`.

If schema changes are made:

- update `docs/database-migrations.md`;
- update `docs/data-dictionary.md`;
- run migration-doc parity checks if available;
- include a rollback migration if repo convention requires one for the migration class.

Production proof before live catalog changes:

- aggregate-only audit proves no existing active stacked storage add-on rows or records required cleanup;
- Stripe test-mode or non-destructive live read proves storage subscription item shape is understood;
- no raw user ids, Stripe ids, API keys, customer emails, or env values are exposed.

## Stop Conditions

Stop and ask the user before:

- mutating live Stripe products, prices, subscription items, or customer subscriptions;
- applying production migrations;
- changing real public prices;
- silently deleting or downgrading a paid add-on;
- allowing multiple active add-ons as a product exception;
- making `storage_500gb` self-serve.

## Known Risks

- Existing route checks only target the requested add-on id; that is the likely stacking gap.
- Existing schema supports `quantity > 1`; Stripe may also send quantities.
- Existing quota summary sums active add-ons; if stacked rows exist, effective storage may already be inflated.
- Old Stripe price ids can bypass naive current-offer-only checks.
- Subscription downgrades can create incompatible storage/add-on combinations unless handled deliberately.

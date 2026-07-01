# Nogo Handoff: Admin Storage Economics Analytics Lens

Date: 2026-07-01
Repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Branch policy: pre-launch `production` only
Primary owner: Gottspan / admin subsystem stewardship
Source steward: Nogo / provider and infrastructure spending analytics
Adjacent owner: Money Stuff / billing catalog and Stripe truth
Task type: implementation handoff

## Goal

Create a real analytics space inside the admin stats area that lets ShortPulse measure storage economics, add-on conversion, quota pressure, and storage/egress risk after the new plan and add-on numbers launch.

This handoff is not asking for a separate marketing-style dashboard. Build into the existing admin stats/lens pattern so the solo owner can answer practical operator questions:

- Are users hitting storage limits?
- Which plan tiers create the most storage pressure?
- Are add-ons converting when users approach limits?
- Are add-ons priced high enough for real media behavior?
- Which users/accounts are storage-risk outliers?
- Are storage limits causing failed saves, uploads, or churn risk?
- Is egress or media preview behavior making add-ons less profitable than expected?

## Current Product Decision To Measure

Base plan storage:

| Plan                   | Storage |
| ---------------------- | ------: |
| Hidden baseline access |    0 GB |
| Starter                |    5 GB |
| Media                  |   25 GB |
| Studio                 |   75 GB |
| Business               |  150 GB |

Recurring add-ons:

| Add-on  |           Price | Availability       |
| ------- | --------------: | ------------------ |
| +10 GB  |           $7/mo | any paid plan      |
| +50 GB  |          $29/mo | Media+             |
| +100 GB |          $59/mo | Studio+            |
| +250 GB |         $149/mo | Business only      |
| +500 GB | $299/mo minimum | manual review only |

Business model assumptions to expose in analytics:

- Supabase production compute target: Medium, about $60/mo.
- Supabase storage overage assumption: about $0.0213/GB-month.
- Supabase egress stress assumption for add-on margin: use 2x uncached egress as the conservative model until real egress data exists.
- Stripe fee assumption: 2.9% + $0.30 for domestic card transactions.
- Gross margin target for add-ons: at least 60% under conservative media behavior.

The analytics UI should make assumptions visible as estimates, not invoice truth, unless the data comes from actual provider invoices or Supabase usage exports.

## Current Admin Stats Surfaces

Read:

- `AGENTS.md`
- `docs/agents/gottspan-the-admin/README.md`
- `docs/agents/nogo/README.md`
- `docs/agents/nogo/standard-operating-procedure.md`
- `frontend/pages/admin/stats.tsx`
- `frontend/features/admin/components/AdminStatsWorkspace.tsx`
- `frontend/features/admin/components/AdminGlobalStatsPanel.tsx`
- `frontend/features/admin/logic/adminGlobalStatsApi.ts`
- `frontend/features/admin/logic/useAdminGlobalStatsController.ts`
- `frontend/features/admin/types.ts`
- API route backing `/admin/stats`
- `frontend/lib/server/api/adminBillingDiagnostics.ts`
- `frontend/pages/api/admin/billing-diagnostics.ts`
- `frontend/pages/api/admin/generation-trace.ts`
- `frontend/pages/api/admin/pricing/state.ts`
- `sql/migrations/087_add_storage_entitlements_and_recurring_storage_addons.sql`

Current admin stats shape:

- `AdminStatsWorkspace` has `product`, `marketing`, and `sales` lenses.
- The new work should add a focused storage/economics lens or a clearly scoped section inside an existing monetization lens.
- Preferred: add a new `storage` or `economics` lens rather than overloading Sales.

## Recommended UX Shape

Add a new admin stats lens:

```text
Storage
```

or:

```text
Economics
```

Preferred label: `Storage`.

Why: the first version is specifically about media storage economics and add-on conversion. A broader `Economics` lens can come later when provider spend and credit gross margin are also wired in.

High-level layout:

1. Storage overview cards.
2. Plan-tier storage pressure.
3. Add-on funnel and conversion.
4. Risk queue.
5. Economics assumptions and estimated margin.
6. Data freshness and gaps.

Keep the UI dense, admin-native, and scan-friendly. Do not build a marketing page. Avoid giant hero sections.

## Metrics To Capture

### Storage Overview Cards

Cards:

- Total tracked media storage.
- Product-tracked media rows.
- Users with media.
- Accounts over 80% quota.
- Accounts over quota.
- Add-on MRR.
- Estimated storage+egress cost.
- Estimated add-on gross margin.

Definitions:

- Product-tracked media storage should use `media_files.file_size`, because that is the current quota-enforcement source.
- Label it as product-tracked, not total Supabase Storage, until object-level billing aggregates are wired.

### Plan-Tier Storage Pressure

Group by current active billing plan:

- account count;
- users with any media;
- total tracked GiB;
- median GiB per account;
- p90 GiB per account;
- accounts over 50%, 80%, 95%, and 100% quota;
- accounts with zero paid storage but nonzero media, which should be investigated;
- average monthly storage growth if historical data is available.

Important:

- Hidden baseline/no paid subscription should have `0 GB` entitlement.
- If baseline users have media, the panel should flag the count as a launch-risk diagnostic.

### Add-On Funnel

Track:

- storage add-on impressions in profile storage section;
- add-on CTA clicks;
- add-on checkout/subscription-change attempts;
- successful add-on activation;
- failed add-on activation;
- add-on removals;
- add-on downgrade/removal while over quota;
- time from first 80% quota threshold to add-on purchase.

If event tracking does not currently exist, the next agent should add a minimal telemetry/event shape rather than trying to infer every funnel step from Stripe.

Recommended event names:

- `storage_addon_impression`
- `storage_addon_click`
- `storage_addon_request_started`
- `storage_addon_request_succeeded`
- `storage_addon_request_failed`
- `storage_addon_removed`
- `storage_quota_warning_shown`
- `storage_quota_blocked_save`

Do not include raw file paths, signed URLs, customer payment details, or provider secrets in telemetry.

### Quota Pressure Events

Capture or aggregate:

- user reaches 50% quota;
- user reaches 80% quota;
- user reaches 95% quota;
- upload/autosave/generation save blocked by quota;
- media deleted after warning;
- storage add-on purchased after warning;
- support/report issue mentioning storage.

The core business question:

```text
Are storage limits causing healthy paid upgrades or just blocking productive users?
```

### Storage Economics

Compute estimates:

- add-on MRR by package;
- estimated Supabase storage cost from add-on capacity sold;
- estimated storage cost from actual tracked bytes;
- estimated egress stress cost at 1x and 2x storage size;
- Stripe fee estimate on add-on MRR;
- estimated gross margin by package and total;
- break-even egress multiple by package.

Use these assumptions initially:

```text
storageCostPerGbMonth = 0.0213
uncachedEgressCostPerGb = 0.09
stripePercent = 0.029
stripeFixedCents = 30
targetGrossMarginPct = 60
computePlan = Supabase Medium
computeMonthlyCost = 60
```

Compute cost allocation:

- Do not allocate the full Supabase compute bill to storage add-ons by default.
- Show compute as an infrastructure floor in an assumption strip.
- Optional: include a toggle or note for "margin before shared compute" vs "after allocated compute" only if the allocation rule is clear.

### Risk Queue

Show accounts that need operator attention:

- over quota;
- above 95% and generating/uploading actively;
- baseline/no paid subscription with storage usage;
- high egress/storage-heavy behavior if available;
- add-on active but incompatible with current plan;
- multiple active add-ons or quantity greater than 1;
- manual-review 500 GB add-on active;
- local add-on row missing live Stripe subscription item;
- Stripe item present but local add-on row missing.

Privacy:

- Admin can use account ids/emails if existing admin surfaces already permit it, but avoid raw storage paths or signed URLs.
- If email display is sensitive, show user id hash plus link to existing billing diagnostics.

## Backend Data Sources

Use existing sources first:

- `media_files.file_size`
- `media_files.user_id`
- `media_files.created_at`
- `billing_subscription_contracts`
- `billing_profiles`
- `billing_plans`
- `billing_plan_offers`
- `billing_storage_addons`
- `billing_storage_addon_offers`
- `billing_subscription_storage_addons`
- existing admin billing diagnostics
- storage quota summary RPCs if available

Potential future source:

- `storage.objects` aggregate by bucket/path class, but only through aggregate server-side admin code. Do not expose raw paths.

Do not use temporary env/text copies as source of truth.

## Suggested API Shape

Add or extend an admin-only API route:

Option A:

- `frontend/pages/api/admin/storage-economics.ts`

Option B:

- extend the existing `/api/admin/stats` payload if that is the current route design.

Prefer the repo's existing admin stats architecture after inspection.

Suggested response shape:

```ts
type AdminStorageEconomicsResponse = {
  generatedAt: string;
  assumptions: {
    storageCostPerGbMonth: number;
    uncachedEgressCostPerGb: number;
    stripePercent: number;
    stripeFixedCents: number;
    targetGrossMarginPct: number;
    computePlan: "medium";
    computeMonthlyCostCents: number;
    source: "configured_estimate";
  };
  overview: {
    trackedStorageBytes: number;
    mediaRows: number;
    usersWithMedia: number;
    accountsOver80Pct: number;
    accountsOverQuota: number;
    addonMrrCents: number;
    estimatedVariableCostCents: number;
    estimatedGrossMarginPct: number;
  };
  byPlan: Array<{
    planId: string;
    accountCount: number;
    usersWithMedia: number;
    trackedStorageBytes: number;
    medianStorageBytes: number;
    p90StorageBytes: number;
    over50PctCount: number;
    over80PctCount: number;
    over95PctCount: number;
    overQuotaCount: number;
  }>;
  addonPackages: Array<{
    storageAddonId: string;
    activeSubscribers: number;
    mrrCents: number;
    soldCapacityBytes: number;
    trackedUsageBytes: number;
    estimatedCost1xEgressCents: number;
    estimatedCost2xEgressCents: number;
    estimatedMargin1xPct: number;
    estimatedMargin2xPct: number;
  }>;
  funnel: {
    impressions: number;
    clicks: number;
    requestsStarted: number;
    requestsSucceeded: number;
    requestsFailed: number;
    removals: number;
    warningToPurchaseCount: number;
  };
  riskQueue: Array<{
    userId: string;
    planId: string;
    riskType: string;
    storageUsedBytes: number;
    storageLimitBytes: number;
    addonStorageBytes: number;
    details: string;
  }>;
  dataGaps: string[];
};
```

Keep it smaller if the first implementation cannot safely support all fields. Do not fake metrics.

## Telemetry Buildout

If add-on conversion tracking is not present, add a small durable event surface.

Possible table:

```sql
create table public.storage_addon_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_name text not null,
  storage_addon_id text,
  plan_id text,
  storage_used_bytes bigint,
  storage_limit_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Constraints:

- no raw file paths;
- no signed URLs;
- no Stripe payment method data;
- no provider secrets;
- no prompt text unless there is a separate privacy review.

If a generic product event table already exists, prefer using it instead of adding a new table.

## Frontend UX Requirements

Inside `AdminStatsWorkspace`:

- add a segmented lens option for `Storage`;
- keep table/card dimensions stable;
- use existing admin styles in `frontend/styles/admin.module.css`;
- do not create nested cards;
- use compact headings and dense tables;
- show loading/error/degraded states;
- include a "Refresh" action consistent with other lenses.

Recommended sections:

1. `Storage overview`
2. `Plan pressure`
3. `Add-on economics`
4. `Conversion funnel`
5. `Risk queue`
6. `Data gaps`

Use tooltips or compact helper text sparingly. Do not write an in-app essay.

## Acceptance Criteria

The lane is complete when:

- `/admin/stats` has a storage-focused lens or section;
- the lens displays real aggregate storage usage from product-tracked data;
- plan pressure is grouped by plan;
- add-on MRR and package adoption are visible;
- estimated margin is calculated from documented assumptions;
- funnel metrics are real or explicitly marked unavailable;
- risk queue includes over-quota and incompatible add-on states;
- data freshness and gaps are visible;
- no raw storage paths, signed URLs, secrets, or payment details are exposed;
- tests cover API shaping and UI rendering.

## Suggested Tests

Backend:

- storage economics API returns aggregate metrics;
- baseline accounts with nonzero media are flagged;
- over-quota accounts are counted;
- active add-on MRR is calculated;
- incompatible/multiple add-on states appear in risk queue;
- data gaps are returned when funnel events are unavailable.

Frontend:

- Storage lens tab renders;
- overview cards render;
- plan pressure table handles empty and non-empty states;
- add-on economics table renders margin values;
- risk queue renders with no raw path fields;
- degraded data message appears when funnel telemetry is missing.

Likely test surfaces:

- admin stats component tests;
- admin API tests;
- billing diagnostics tests if shared helper is reused.

## Proof Requirements

Minimum local proof:

- targeted API tests;
- targeted admin stats UI tests;
- `npm -C frontend run type-check:touched -- --path <touched frontend files>`;
- `git diff --check`;
- docs updated if new routes/tables are added.

If adding a migration:

- update `docs/database-migrations.md`;
- update `docs/data-dictionary.md`;
- update route/API docs if a new admin API route is added;
- include RLS/service-role posture in the migration or route docs.

Production-safe proof before using for decisions:

- compare aggregate tracked media total against a read-only production query;
- confirm add-on MRR matches billing catalog/subscriber rows;
- confirm no raw storage paths or signed URLs appear in API response;
- confirm the data gap list accurately marks estimates versus real telemetry.

## Stop Conditions

Stop and ask the user before:

- adding invasive tracking of user behavior beyond storage/add-on conversion;
- exposing customer-private media paths or signed URLs;
- mutating live billing, Stripe, or Supabase data;
- changing actual prices or plan limits from the analytics lane;
- making production-readiness claims from local-only analytics;
- allocating full Supabase compute cost to add-ons without a documented business rule.

## Known Risks

- Product quota uses `media_files.file_size`; Supabase bills actual storage objects. Orphaned objects can create billing cost not reflected in product quota.
- Supabase egress may not be available per user without additional instrumentation.
- Add-on conversion requires event tracking; Stripe success alone does not explain failed intent.
- Manual-review 500 GB flow may not exist yet, so analytics should treat it as a risk/manual state.
- If storage stacking is not fixed, analytics must flag stacked add-ons rather than assuming add-on rows are valid.

/**
 * Admin API: storage economics snapshot for the /admin/storage workspace.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  BYTES_PER_GIB,
  isCurrentBillableStorageAddonStatus,
  isManualReviewStorageAddon,
} from "../../../lib/billing/storageAddonEligibility";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  buildAdminStorageProviderUsage,
  type AdminStorageUsageSnapshotRow,
} from "../../../lib/server/api/adminStorageProviderUsage";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import type {
  AdminStatsCountWindow,
  AdminStorageEconomicsAddonPackageRow,
  AdminStorageEconomicsAssumptions,
  AdminStorageEconomicsFunnel,
  AdminStorageEconomicsOverview,
  AdminStorageEconomicsPlanRow,
  AdminStorageProviderUsage,
  AdminStorageEconomicsResponse,
  AdminStorageEconomicsRiskRow,
  AdminStorageEconomicsRiskType,
} from "../../../features/admin/types";

const STORAGE_ADDON_TELEMETRY_SOURCE = "telemetry.storage.addon";

const ASSUMPTIONS: AdminStorageEconomicsAssumptions = {
  storageCostPerGbMonth: 0.021,
  uncachedEgressCostPerGb: 0.09,
  cachedEgressCostPerGb: 0.03,
  stripePercent: 0.029,
  stripeFixedCents: 30,
  targetGrossMarginPct: 60,
  computePlan: "medium",
  computeMonthlyCostCents: 6000,
  source: "configured_estimate",
};

type MediaFileRow = {
  user_id: string | null;
  file_size: number | null;
  created_at: string | null;
};

type BillingContractRow = {
  user_id: string | null;
  plan_id: string | null;
  storage_limit_bytes: number | null;
  contract_source: string | null;
  stripe_subscription_id: string | null;
  recurring_price_cents: number | null;
  billing_interval: string | null;
  status: string | null;
};

type BillingProfileRow = {
  user_id: string | null;
  plan_id: string | null;
};

type BillingPlanRow = {
  id: string;
  display_name: string | null;
  monthly_price_cents: number | null;
  storage_limit_bytes: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type BillingPlanOfferRow = {
  id: string;
  plan_id: string | null;
  recurring_price_cents: number | null;
  billing_interval: string | null;
  acquisition_enabled: boolean | null;
  is_active: boolean | null;
  effective_start_at: string | null;
  effective_end_at: string | null;
  created_at: string | null;
};

type BillingStorageAddonRow = {
  id: string;
  display_name: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type BillingStorageAddonOfferRow = {
  id: string;
  storage_addon_id: string | null;
  storage_limit_bytes: number | null;
  recurring_price_cents: number | null;
  acquisition_enabled: boolean | null;
  is_active: boolean | null;
  effective_start_at: string | null;
  effective_end_at: string | null;
  created_at: string | null;
};

type BillingSubscriptionStorageAddonRow = {
  user_id: string | null;
  storage_addon_id: string | null;
  offer_id: string | null;
  stripe_subscription_item_id: string | null;
  stripe_price_id: string | null;
  storage_limit_bytes: number | null;
  quantity: number | null;
  recurring_price_cents: number | null;
  status: string | null;
};

type AppErrorEventRow = {
  message: string | null;
  occurred_at: string | null;
  metadata: Record<string, unknown> | null;
};

type AccountStorageState = {
  userId: string;
  planId: string;
  displayName: string;
  baseLimitBytes: number;
  addonLimitBytes: number;
  trackedBytes: number;
  mediaCount: number;
  lastMediaAt: string | null;
  activeAddons: BillingSubscriptionStorageAddonRow[];
  contract: BillingContractRow | null;
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

const emptyWindow = (): AdminStatsCountWindow => ({
  total: 0,
  last24h: 0,
  last7d: 0,
});

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const toPositiveQuantity = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
};

const toPlanId = (value: unknown): string => {
  if (typeof value !== "string") return "free";
  const normalized = value.trim().toLowerCase();
  return normalized || "free";
};

const toIsoStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const sortNumbers = (values: number[]) => [...values].sort((left, right) => left - right);

const percentile = (values: number[], pct: number): number => {
  if (!values.length) return 0;
  const sorted = sortNumbers(values);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1)
  );
  return sorted[index] ?? 0;
};

const median = (values: number[]): number => percentile(values, 50);

const bytesToGb = (bytes: number): number => bytes / BYTES_PER_GIB;

const estimateStorageCostCents = (bytes: number): number =>
  Math.round(bytesToGb(bytes) * ASSUMPTIONS.storageCostPerGbMonth * 100);

const estimateEgressCostCents = (bytes: number, multiplier: 1 | 2): number =>
  Math.round(bytesToGb(bytes) * multiplier * ASSUMPTIONS.uncachedEgressCostPerGb * 100);

const estimateStripeFeeCents = (mrrCents: number, transactions: number): number =>
  Math.round(mrrCents * ASSUMPTIONS.stripePercent + transactions * ASSUMPTIONS.stripeFixedCents);

const estimateMarginPct = (mrrCents: number, costCents: number): number | null => {
  if (mrrCents <= 0) return null;
  return ((mrrCents - costCents) / mrrCents) * 100;
};

const CURRENT_BILLABLE_CONTRACT_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

const isCurrentStripeContract = (contract: BillingContractRow | null): boolean => {
  if (!contract) return false;
  if (contract.contract_source !== "stripe") return false;
  return CURRENT_BILLABLE_CONTRACT_STATUSES.has(String(contract.status ?? "").toLowerCase());
};

const recurringToMonthlyCents = (
  recurringPriceCents: number | null | undefined,
  billingInterval: string | null | undefined
): number => {
  const priceCents = toCount(recurringPriceCents);
  const interval = String(billingInterval ?? "month").toLowerCase();
  return interval === "year" || interval === "annual" ? Math.round(priceCents / 12) : priceCents;
};

const usagePct = (trackedBytes: number, limitBytes: number): number | null => {
  if (limitBytes <= 0) return trackedBytes > 0 ? null : 0;
  return (trackedBytes / limitBytes) * 100;
};

const countAbovePct = (accounts: AccountStorageState[], thresholdPct: number): number =>
  accounts.filter((account) => {
    const limitBytes = account.baseLimitBytes + account.addonLimitBytes;
    if (limitBytes <= 0) return false;
    return (account.trackedBytes / limitBytes) * 100 >= thresholdPct;
  }).length;

const assertQueryOk = <T>(label: string, result: QueryResult<T>): T[] => {
  if (result.error) {
    throw new Error(result.error.message || `Unable to load ${label}.`);
  }
  return Array.isArray(result.data) ? result.data : [];
};

const isActiveAddon = (row: BillingSubscriptionStorageAddonRow): boolean =>
  isCurrentBillableStorageAddonStatus(row.status);

const getLatestPublicOffer = (
  offers: BillingStorageAddonOfferRow[],
  storageAddonId: string
): BillingStorageAddonOfferRow | null => {
  const now = Date.now();
  const candidates = offers
    .filter((offer) => {
      if (offer.storage_addon_id !== storageAddonId) return false;
      if (!offer.is_active) return false;
      if (offer.effective_end_at && Date.parse(offer.effective_end_at) <= now) return false;
      return true;
    })
    .sort((left, right) => {
      const rightStart = right.effective_start_at ? Date.parse(right.effective_start_at) : 0;
      const leftStart = left.effective_start_at ? Date.parse(left.effective_start_at) : 0;
      if (rightStart !== leftStart) return rightStart - leftStart;
      const rightCreated = right.created_at ? Date.parse(right.created_at) : 0;
      const leftCreated = left.created_at ? Date.parse(left.created_at) : 0;
      return rightCreated - leftCreated;
    });
  return candidates[0] ?? null;
};

const getLatestPublicPlanOffer = (
  offers: BillingPlanOfferRow[],
  planId: string
): BillingPlanOfferRow | null => {
  const now = Date.now();
  const candidates = offers
    .filter((offer) => {
      if (toPlanId(offer.plan_id) !== planId) return false;
      if (!offer.is_active) return false;
      if (String(offer.billing_interval ?? "month").toLowerCase() !== "month") return false;
      if (offer.effective_end_at && Date.parse(offer.effective_end_at) <= now) return false;
      return true;
    })
    .sort((left, right) => {
      const rightStart = right.effective_start_at ? Date.parse(right.effective_start_at) : 0;
      const leftStart = left.effective_start_at ? Date.parse(left.effective_start_at) : 0;
      if (rightStart !== leftStart) return rightStart - leftStart;
      const rightCreated = right.created_at ? Date.parse(right.created_at) : 0;
      const leftCreated = left.created_at ? Date.parse(left.created_at) : 0;
      return rightCreated - leftCreated;
    });
  return candidates[0] ?? null;
};

const addTelemetryCount = (
  windows: AdminStatsCountWindow,
  occurredAt: string | null,
  nowMs: number
) => {
  windows.total += 1;
  const parsed = occurredAt ? Date.parse(occurredAt) : Number.NaN;
  if (!Number.isFinite(parsed)) return;
  if (nowMs - parsed <= 24 * 60 * 60 * 1000) windows.last24h += 1;
  if (nowMs - parsed <= 7 * 24 * 60 * 60 * 1000) windows.last7d += 1;
};

const normalizeTelemetryName = (event: AppErrorEventRow): string => {
  const metadataEvent = event.metadata?.event_name;
  if (typeof metadataEvent === "string" && metadataEvent.trim()) return metadataEvent.trim();
  return String(event.message ?? "").trim();
};

const buildFunnel = (events: AppErrorEventRow[]): AdminStorageEconomicsFunnel => {
  const funnel: AdminStorageEconomicsFunnel = {
    impressions: emptyWindow(),
    addClicks: emptyWindow(),
    warningViews: emptyWindow(),
    addRequests: emptyWindow(),
    addSuccesses: emptyWindow(),
    addFailures: emptyWindow(),
    removals: emptyWindow(),
    source: events.length ? "app_error_events" : "unavailable",
  };
  const nowMs = Date.now();

  events.forEach((event) => {
    const name = normalizeTelemetryName(event);
    if (name === "storage_addon_impression") {
      addTelemetryCount(funnel.impressions, event.occurred_at, nowMs);
    } else if (name === "storage_addon_add_clicked") {
      addTelemetryCount(funnel.addClicks, event.occurred_at, nowMs);
    } else if (name === "storage_addon_warning_viewed") {
      addTelemetryCount(funnel.warningViews, event.occurred_at, nowMs);
    } else if (name === "storage_addon_request_started") {
      addTelemetryCount(funnel.addRequests, event.occurred_at, nowMs);
    } else if (name === "storage_addon_request_succeeded") {
      addTelemetryCount(funnel.addSuccesses, event.occurred_at, nowMs);
    } else if (name === "storage_addon_request_failed") {
      addTelemetryCount(funnel.addFailures, event.occurred_at, nowMs);
    } else if (name === "storage_addon_removed") {
      addTelemetryCount(funnel.removals, event.occurred_at, nowMs);
    }
  });

  return funnel;
};

const buildAccountStates = (params: {
  mediaRows: MediaFileRow[];
  contracts: BillingContractRow[];
  profiles: BillingProfileRow[];
  plansById: Map<string, BillingPlanRow>;
  activeAddonsByUser: Map<string, BillingSubscriptionStorageAddonRow[]>;
}): AccountStorageState[] => {
  const usedBytesByUser = new Map<string, number>();
  const mediaCountByUser = new Map<string, number>();
  const lastMediaAtByUser = new Map<string, string | null>();
  const contractsByUser = new Map<string, BillingContractRow>();
  const profilesByUser = new Map<string, BillingProfileRow>();
  const userIds = new Set<string>();

  params.mediaRows.forEach((row) => {
    if (!row.user_id) return;
    userIds.add(row.user_id);
    usedBytesByUser.set(
      row.user_id,
      (usedBytesByUser.get(row.user_id) ?? 0) + toCount(row.file_size)
    );
    mediaCountByUser.set(row.user_id, (mediaCountByUser.get(row.user_id) ?? 0) + 1);
    const nextIso = toIsoStringOrNull(row.created_at);
    const currentIso = lastMediaAtByUser.get(row.user_id) ?? null;
    if (!currentIso || (nextIso && Date.parse(nextIso) > Date.parse(currentIso))) {
      lastMediaAtByUser.set(row.user_id, nextIso);
    }
  });

  params.contracts.forEach((row) => {
    if (!row.user_id) return;
    userIds.add(row.user_id);
    contractsByUser.set(row.user_id, row);
  });

  params.profiles.forEach((row) => {
    if (!row.user_id) return;
    userIds.add(row.user_id);
    profilesByUser.set(row.user_id, row);
  });

  params.activeAddonsByUser.forEach((_rows, userId) => {
    userIds.add(userId);
  });

  return [...userIds].map((userId) => {
    const contract = contractsByUser.get(userId) ?? null;
    const profile = profilesByUser.get(userId) ?? null;
    const planId = toPlanId(contract?.plan_id ?? profile?.plan_id);
    const plan = params.plansById.get(planId);
    const baseLimitBytes =
      contract?.storage_limit_bytes !== null && contract?.storage_limit_bytes !== undefined
        ? toCount(contract.storage_limit_bytes)
        : planId === "free"
          ? 0
          : toCount(plan?.storage_limit_bytes);
    const activeAddons = params.activeAddonsByUser.get(userId) ?? [];
    const addonLimitBytes = activeAddons.reduce(
      (sum, row) => sum + toCount(row.storage_limit_bytes) * toPositiveQuantity(row.quantity),
      0
    );

    return {
      userId,
      planId,
      displayName: plan?.display_name?.trim() || planId,
      baseLimitBytes,
      addonLimitBytes,
      trackedBytes: usedBytesByUser.get(userId) ?? 0,
      mediaCount: mediaCountByUser.get(userId) ?? 0,
      lastMediaAt: lastMediaAtByUser.get(userId) ?? null,
      activeAddons,
      contract,
    };
  });
};

const buildPlanRows = (
  accounts: AccountStorageState[],
  plans: BillingPlanRow[],
  planOffers: BillingPlanOfferRow[]
): AdminStorageEconomicsPlanRow[] => {
  const byPlan = new Map<string, AccountStorageState[]>();
  accounts.forEach((account) => {
    const rows = byPlan.get(account.planId) ?? [];
    rows.push(account);
    byPlan.set(account.planId, rows);
  });

  const planIds = new Set<string>([
    ...plans.map((plan) => toPlanId(plan.id)),
    ...accounts.map((account) => account.planId),
  ]);
  const planCatalogById = new Map(plans.map((plan) => [toPlanId(plan.id), plan]));

  return [...planIds]
    .map((planId) => {
      const rows = byPlan.get(planId) ?? [];
      const plan = planCatalogById.get(planId) ?? null;
      const offer = getLatestPublicPlanOffer(planOffers, planId);
      const currentStripeRows = rows.filter((row) => isCurrentStripeContract(row.contract));
      const trackedValues = rows.map((row) => row.trackedBytes);
      return {
        planId,
        displayName: plan?.display_name?.trim() || rows[0]?.displayName || planId,
        isActive: Boolean(plan?.is_active),
        sortOrder: toCount(plan?.sort_order),
        catalogStorageLimitBytes: toCount(plan?.storage_limit_bytes),
        catalogRecurringPriceCents: toCount(
          offer?.recurring_price_cents ?? plan?.monthly_price_cents
        ),
        catalogAcquisitionEnabled: Boolean(offer?.acquisition_enabled),
        activeStripeContracts: currentStripeRows.length,
        contractMrrCents: currentStripeRows.reduce(
          (sum, row) =>
            sum +
            recurringToMonthlyCents(
              row.contract?.recurring_price_cents,
              row.contract?.billing_interval
            ),
          0
        ),
        accountCount: rows.length,
        usersWithMedia: rows.filter((row) => row.mediaCount > 0).length,
        totalTrackedBytes: rows.reduce((sum, row) => sum + row.trackedBytes, 0),
        medianTrackedBytes: median(trackedValues),
        p90TrackedBytes: percentile(trackedValues, 90),
        baseLimitBytes: rows.reduce((sum, row) => sum + row.baseLimitBytes, 0),
        addonLimitBytes: rows.reduce((sum, row) => sum + row.addonLimitBytes, 0),
        monthlyStorageGrowthBytes: null,
        accountsOver50Pct: countAbovePct(rows, 50),
        accountsOver80Pct: countAbovePct(rows, 80),
        accountsOver95Pct: countAbovePct(rows, 95),
        accountsOverQuota: rows.filter((row) => {
          const limitBytes = row.baseLimitBytes + row.addonLimitBytes;
          return limitBytes > 0 && row.trackedBytes > limitBytes;
        }).length,
        baselineStorageUsers: rows.filter(
          (row) => row.baseLimitBytes <= 0 && row.addonLimitBytes <= 0 && row.trackedBytes > 0
        ).length,
      };
    })
    .sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      if (right.accountCount !== left.accountCount) return right.accountCount - left.accountCount;
      return right.totalTrackedBytes - left.totalTrackedBytes;
    });
};

const buildAddonPackageRows = (params: {
  activeAddons: BillingSubscriptionStorageAddonRow[];
  addonCatalogById: Map<string, BillingStorageAddonRow>;
  publicOffers: BillingStorageAddonOfferRow[];
  usageByUser: Map<string, number>;
}): AdminStorageEconomicsAddonPackageRow[] => {
  const grouped = new Map<string, BillingSubscriptionStorageAddonRow[]>();
  params.activeAddons.forEach((row) => {
    if (!row.storage_addon_id) return;
    const rows = grouped.get(row.storage_addon_id) ?? [];
    rows.push(row);
    grouped.set(row.storage_addon_id, rows);
  });

  const storageAddonIds = new Set<string>([...params.addonCatalogById.keys(), ...grouped.keys()]);

  return [...storageAddonIds]
    .map((storageAddonId) => {
      const rows = grouped.get(storageAddonId) ?? [];
      const catalog = params.addonCatalogById.get(storageAddonId);
      const offer = getLatestPublicOffer(params.publicOffers, storageAddonId);
      const subscribers = new Set(rows.map((row) => row.user_id).filter(Boolean));
      const activeQuantity = rows.reduce((sum, row) => sum + toPositiveQuantity(row.quantity), 0);
      const mrrCents = rows.reduce((sum, row) => {
        const priceCents = toCount(row.recurring_price_cents ?? offer?.recurring_price_cents);
        return sum + priceCents * toPositiveQuantity(row.quantity);
      }, 0);
      const soldCapacityBytes = rows.reduce((sum, row) => {
        const capacityBytes = toCount(row.storage_limit_bytes ?? offer?.storage_limit_bytes);
        return sum + capacityBytes * toPositiveQuantity(row.quantity);
      }, 0);
      const trackedUsageBytes = [...subscribers].reduce(
        (sum, userId) => sum + (params.usageByUser.get(String(userId)) ?? 0),
        0
      );
      const estimatedStorageCostCents = estimateStorageCostCents(soldCapacityBytes);
      const estimatedEgressCost1xCents = estimateEgressCostCents(soldCapacityBytes, 1);
      const estimatedEgressCost2xCents = estimateEgressCostCents(soldCapacityBytes, 2);
      const estimatedStripeFeeCents = estimateStripeFeeCents(mrrCents, subscribers.size);

      return {
        storageAddonId,
        displayName: catalog?.display_name?.trim() || storageAddonId,
        isActive: Boolean(catalog?.is_active),
        sortOrder: toCount(catalog?.sort_order),
        acquisitionEnabled: Boolean(offer?.acquisition_enabled),
        catalogStorageLimitBytes: toCount(offer?.storage_limit_bytes),
        catalogRecurringPriceCents: toCount(offer?.recurring_price_cents),
        activeSubscribers: subscribers.size,
        activeQuantity,
        mrrCents,
        soldCapacityBytes,
        trackedUsageBytes,
        estimatedStorageCostCents,
        estimatedEgressCost1xCents,
        estimatedEgressCost2xCents,
        estimatedStripeFeeCents,
        estimatedMargin1xPct: estimateMarginPct(
          mrrCents,
          estimatedStorageCostCents + estimatedEgressCost1xCents + estimatedStripeFeeCents
        ),
        estimatedMargin2xPct: estimateMarginPct(
          mrrCents,
          estimatedStorageCostCents + estimatedEgressCost2xCents + estimatedStripeFeeCents
        ),
      };
    })
    .sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      if (right.activeSubscribers !== left.activeSubscribers) {
        return right.activeSubscribers - left.activeSubscribers;
      }
      return right.mrrCents - left.mrrCents;
    });
};

const buildRiskQueue = (accounts: AccountStorageState[]): AdminStorageEconomicsRiskRow[] =>
  accounts
    .map((account) => {
      const limitBytes = account.baseLimitBytes + account.addonLimitBytes;
      const pct = usagePct(account.trackedBytes, limitBytes);
      const riskTypes: AdminStorageEconomicsRiskType[] = [];
      if (limitBytes <= 0 && account.trackedBytes > 0) riskTypes.push("baseline_storage_usage");
      if (limitBytes > 0 && account.trackedBytes > limitBytes) riskTypes.push("over_quota");
      if (pct !== null && pct >= 80 && account.trackedBytes <= limitBytes)
        riskTypes.push("near_quota");
      if (account.planId === "free" && account.activeAddons.length > 0) {
        riskTypes.push("addon_without_paid_plan");
      }
      if (account.activeAddons.length > 1) riskTypes.push("multiple_active_addons");
      if (account.activeAddons.some((row) => toPositiveQuantity(row.quantity) > 1)) {
        riskTypes.push("stacked_addon_quantity");
      }
      if (account.activeAddons.some((row) => isManualReviewStorageAddon(row.storage_addon_id))) {
        riskTypes.push("manual_review_addon");
      }
      if (account.activeAddons.some((row) => !row.stripe_subscription_item_id)) {
        riskTypes.push("local_addon_missing_stripe_item");
      }

      return {
        userId: account.userId,
        planId: account.planId,
        trackedBytes: account.trackedBytes,
        totalLimitBytes: limitBytes,
        usagePct: pct,
        activeAddonCount: account.activeAddons.length,
        riskTypes,
        details: riskTypes.length
          ? riskTypes.map((riskType) => riskType.replaceAll("_", " ")).join(", ")
          : "No storage economics risk detected.",
      };
    })
    .filter((row) => row.riskTypes.length > 0)
    .sort((left, right) => {
      if (right.riskTypes.length !== left.riskTypes.length) {
        return right.riskTypes.length - left.riskTypes.length;
      }
      return right.trackedBytes - left.trackedBytes;
    })
    .slice(0, 50);

const buildOverview = (params: {
  accounts: AccountStorageState[];
  addonPackages: AdminStorageEconomicsAddonPackageRow[];
  providerUsage: AdminStorageProviderUsage;
}): AdminStorageEconomicsOverview => {
  const trackedValues = params.accounts.map((account) => account.trackedBytes);
  const activeAddonSubscribers = new Set(
    params.accounts.flatMap((account) => (account.activeAddons.length > 0 ? [account.userId] : []))
  ).size;
  const currentStripeContracts = params.accounts.filter((account) =>
    isCurrentStripeContract(account.contract)
  );
  const estimatedPlanMrrCents = currentStripeContracts.reduce(
    (sum, row) =>
      sum +
      recurringToMonthlyCents(row.contract?.recurring_price_cents, row.contract?.billing_interval),
    0
  );
  const activeAddonMrrCents = params.addonPackages.reduce((sum, row) => sum + row.mrrCents, 0);
  const activeAddonSoldCapacityBytes = params.addonPackages.reduce(
    (sum, row) => sum + row.soldCapacityBytes,
    0
  );
  const estimatedStorageCostCents = estimateStorageCostCents(activeAddonSoldCapacityBytes);
  const estimatedEgressCost1xCents = estimateEgressCostCents(activeAddonSoldCapacityBytes, 1);
  const estimatedEgressCost2xCents = estimateEgressCostCents(activeAddonSoldCapacityBytes, 2);
  const estimatedStripeFeeCents = estimateStripeFeeCents(
    activeAddonMrrCents,
    activeAddonSubscribers
  );
  const estimatedPlanStripeFeeCents = estimateStripeFeeCents(
    estimatedPlanMrrCents,
    currentStripeContracts.length
  );
  const estimatedAddonCost1xCents =
    estimatedStorageCostCents + estimatedEgressCost1xCents + estimatedStripeFeeCents;
  const estimatedAddonCost2xCents =
    estimatedStorageCostCents + estimatedEgressCost2xCents + estimatedStripeFeeCents;
  const estimatedComputeCostCents = params.providerUsage.computeMonthlyCostCents;
  const providerOverageCostCents =
    params.providerUsage.observedTotalOverageCostCents ??
    params.providerUsage.estimatedTotalOverageCostCents;
  const estimatedBusinessStorageCostCents =
    estimatedComputeCostCents +
    providerOverageCostCents +
    estimatedPlanStripeFeeCents +
    estimatedStripeFeeCents;
  const estimatedTotalStorageRevenueCents = estimatedPlanMrrCents + activeAddonMrrCents;

  return {
    trackedAccounts: params.accounts.length,
    accountsWithMedia: params.accounts.filter((account) => account.mediaCount > 0).length,
    totalTrackedBytes: params.accounts.reduce((sum, account) => sum + account.trackedBytes, 0),
    medianTrackedBytes: median(trackedValues),
    p90TrackedBytes: percentile(trackedValues, 90),
    accountsOver80Pct: countAbovePct(params.accounts, 80),
    accountsOverQuota: params.accounts.filter((account) => {
      const limitBytes = account.baseLimitBytes + account.addonLimitBytes;
      return limitBytes > 0 && account.trackedBytes > limitBytes;
    }).length,
    baselineStorageUsers: params.accounts.filter(
      (account) =>
        account.baseLimitBytes <= 0 && account.addonLimitBytes <= 0 && account.trackedBytes > 0
    ).length,
    activeAddonSubscribers,
    activeAddonMrrCents,
    activeAddonSoldCapacityBytes,
    estimatedStorageCostCents,
    estimatedEgressCost1xCents,
    estimatedEgressCost2xCents,
    estimatedStripeFeeCents,
    estimatedComputeCostCents,
    estimatedAddonCost1xCents,
    estimatedAddonCost2xCents,
    estimatedAddonGrossMargin1xPct: estimateMarginPct(
      activeAddonMrrCents,
      estimatedAddonCost1xCents
    ),
    estimatedAddonGrossMargin2xPct: estimateMarginPct(
      activeAddonMrrCents,
      estimatedAddonCost2xCents
    ),
    estimatedPlanMrrCents,
    estimatedTotalStorageRevenueCents,
    estimatedBusinessStorageCostCents,
    estimatedBusinessStorageMarginPct: estimateMarginPct(
      estimatedTotalStorageRevenueCents,
      estimatedBusinessStorageCostCents
    ),
    estimatedVariableCost1xCents: estimatedAddonCost1xCents,
    estimatedVariableCost2xCents: estimatedAddonCost2xCents,
    estimatedGrossMargin1xPct: estimateMarginPct(activeAddonMrrCents, estimatedAddonCost1xCents),
    estimatedGrossMargin2xPct: estimateMarginPct(activeAddonMrrCents, estimatedAddonCost2xCents),
  };
};

const buildDataGaps = (
  funnel: AdminStorageEconomicsFunnel,
  providerUsage: AdminStorageProviderUsage
): string[] => {
  const gaps = [
    "Product-tracked storage uses media_files.file_size, not provider invoice/object-storage metering.",
    "Average monthly storage growth is unavailable until durable historical storage snapshots exist.",
    "Risk rows use local billing rows only; use Admin Billing Diagnostics for per-user live Stripe proof.",
  ];
  if (providerUsage.status === "unavailable") {
    gaps.push(
      "Supabase provider usage snapshot is unavailable; bill-pressure cards use empty provider evidence."
    );
  } else if (providerUsage.status === "stale") {
    gaps.push("Supabase provider usage snapshot is stale; refresh it before pricing decisions.");
  }
  if (funnel.source === "unavailable") {
    gaps.push(
      "Storage add-on impression, click, warning, request, success, failure, and removal telemetry is not available yet."
    );
  } else if (
    funnel.impressions.total === 0 ||
    funnel.addClicks.total === 0 ||
    funnel.warningViews.total === 0
  ) {
    gaps.push(
      "Client-side storage add-on impression, click, and warning telemetry is incomplete; route mutation telemetry may still be present."
    );
  }
  return gaps;
};

const buildPayload = async (): Promise<AdminStorageEconomicsResponse> => {
  const supabaseAdmin = getSupabaseAdmin();
  const [
    mediaResult,
    contractsResult,
    profilesResult,
    plansResult,
    planOffersResult,
    addonsResult,
    addonOffersResult,
    subscriptionAddonsResult,
    providerUsageResult,
    telemetryResult,
  ] = await Promise.all([
    supabaseAdmin.from("media_files").select("user_id, file_size, created_at"),
    supabaseAdmin
      .from("billing_subscription_contracts")
      .select(
        "user_id, plan_id, storage_limit_bytes, contract_source, stripe_subscription_id, recurring_price_cents, billing_interval, status"
      )
      .is("ended_at", null),
    supabaseAdmin.from("billing_profiles").select("user_id, plan_id"),
    supabaseAdmin
      .from("billing_plans")
      .select("id, display_name, monthly_price_cents, storage_limit_bytes, sort_order, is_active"),
    supabaseAdmin
      .from("billing_plan_offers")
      .select(
        "id, plan_id, recurring_price_cents, billing_interval, acquisition_enabled, is_active, effective_start_at, effective_end_at, created_at"
      ),
    supabaseAdmin.from("billing_storage_addons").select("id, display_name, sort_order, is_active"),
    supabaseAdmin
      .from("billing_storage_addon_offers")
      .select(
        "id, storage_addon_id, storage_limit_bytes, recurring_price_cents, acquisition_enabled, is_active, effective_start_at, effective_end_at, created_at"
      ),
    supabaseAdmin
      .from("billing_subscription_storage_addons")
      .select(
        "user_id, storage_addon_id, offer_id, stripe_subscription_item_id, stripe_price_id, storage_limit_bytes, quantity, recurring_price_cents, status"
      )
      .is("ended_at", null),
    supabaseAdmin
      .from("admin_storage_usage_snapshots")
      .select(
        "snapshot_month, captured_at, source, supabase_plan, compute_plan, compute_monthly_cost_cents, storage_used_gb, storage_included_gb, uncached_egress_gb, cached_egress_gb, uncached_egress_included_gb, cached_egress_included_gb, observed_storage_overage_cost_cents, observed_uncached_egress_overage_cost_cents, observed_cached_egress_overage_cost_cents, notes"
      )
      .order("snapshot_month", { ascending: false })
      .order("captured_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("app_error_events")
      .select("message, occurred_at, metadata")
      .eq("source", STORAGE_ADDON_TELEMETRY_SOURCE)
      .order("occurred_at", { ascending: false })
      .limit(5000),
  ]);

  const mediaRows = assertQueryOk<MediaFileRow>("media rows", mediaResult);
  const contracts = assertQueryOk<BillingContractRow>("billing contracts", contractsResult);
  const profiles = assertQueryOk<BillingProfileRow>("billing profiles", profilesResult);
  const plans = assertQueryOk<BillingPlanRow>("billing plans", plansResult);
  const planOffers = assertQueryOk<BillingPlanOfferRow>("billing plan offers", planOffersResult);
  const addonCatalog = assertQueryOk<BillingStorageAddonRow>(
    "storage add-on catalog",
    addonsResult
  );
  const addonOffers = assertQueryOk<BillingStorageAddonOfferRow>(
    "storage add-on offers",
    addonOffersResult
  );
  const subscriptionAddons = assertQueryOk<BillingSubscriptionStorageAddonRow>(
    "subscription storage add-ons",
    subscriptionAddonsResult
  );
  const providerUsageRows = assertQueryOk<AdminStorageUsageSnapshotRow>(
    "admin storage usage snapshots",
    providerUsageResult
  );
  const telemetryEvents = telemetryResult.error
    ? []
    : Array.isArray(telemetryResult.data)
      ? (telemetryResult.data as AppErrorEventRow[])
      : [];

  const activeAddons = subscriptionAddons.filter(isActiveAddon);
  const activeAddonsByUser = new Map<string, BillingSubscriptionStorageAddonRow[]>();
  activeAddons.forEach((row) => {
    if (!row.user_id) return;
    const rows = activeAddonsByUser.get(row.user_id) ?? [];
    rows.push(row);
    activeAddonsByUser.set(row.user_id, rows);
  });

  const plansById = new Map(plans.map((plan) => [toPlanId(plan.id), plan]));
  const addonCatalogById = new Map(addonCatalog.map((addon) => [addon.id, addon]));
  const accounts = buildAccountStates({
    mediaRows,
    contracts,
    profiles,
    plansById,
    activeAddonsByUser,
  });
  const usageByUser = new Map(accounts.map((account) => [account.userId, account.trackedBytes]));
  const totalTrackedBytes = accounts.reduce((sum, account) => sum + account.trackedBytes, 0);
  const providerUsage = buildAdminStorageProviderUsage({
    row: providerUsageRows[0] ?? null,
    assumptions: ASSUMPTIONS,
    productTrackedBytes: totalTrackedBytes,
  });
  const addonPackages = buildAddonPackageRows({
    activeAddons,
    addonCatalogById,
    publicOffers: addonOffers,
    usageByUser,
  });
  const funnel = buildFunnel(telemetryEvents);

  return {
    assumptions: ASSUMPTIONS,
    overview: buildOverview({ accounts, addonPackages, providerUsage }),
    providerUsage,
    byPlan: buildPlanRows(accounts, plans, planOffers),
    addonPackages,
    funnel,
    riskQueue: buildRiskQueue(accounts),
    dataGaps: buildDataGaps(funnel, providerUsage),
    health: {
      degraded: false,
      reason: null,
      storageSource: "live_query",
      funnelSource: funnel.source,
    },
    generatedAt: new Date().toISOString(),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/storage-economics.auth",
    });
    return res.status(500).json({ error: "Unable to load admin storage economics." });
  }

  try {
    const payload = await buildPayload();
    return res.status(200).json(payload);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/storage-economics",
    });
    return res.status(500).json({ error: "Unable to load admin storage economics." });
  }
}

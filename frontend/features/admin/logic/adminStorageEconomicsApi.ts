/**
 * Helpers for the admin storage-economics API contract.
 */
import { DEFAULT_ADMIN_STATS_COUNT_WINDOW } from "./adminGlobalStatsApi";
import type {
  AdminStatsCountWindow,
  AdminStorageEconomicsAddonPackageRow,
  AdminStorageEconomicsAssumptions,
  AdminStorageEconomicsFunnel,
  AdminStorageEconomicsHealth,
  AdminStorageEconomicsOverview,
  AdminStorageAccountHealth,
  AdminStorageAccountOpportunityType,
  AdminStorageEvidenceRow,
  AdminStorageEvidenceSource,
  AdminStorageEvidenceStatus,
  AdminStorageEconomicsPlanRow,
  AdminStorageProviderUsage,
  AdminStorageEconomicsResponse,
  AdminStorageEconomicsRiskRow,
  AdminStorageEconomicsRiskType,
  AdminStorageLifecycleAction,
  AdminStorageLifecycleHealth,
  AdminStorageTrend,
} from "../types";

export const DEFAULT_ADMIN_STORAGE_ECONOMICS_ASSUMPTIONS: AdminStorageEconomicsAssumptions = {
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

export const DEFAULT_ADMIN_STORAGE_ECONOMICS_OVERVIEW: AdminStorageEconomicsOverview = {
  trackedAccounts: 0,
  accountsWithMedia: 0,
  totalTrackedBytes: 0,
  medianTrackedBytes: 0,
  p90TrackedBytes: 0,
  accountsOver80Pct: 0,
  accountsOverQuota: 0,
  baselineStorageUsers: 0,
  activeAddonSubscribers: 0,
  activeAddonMrrCents: 0,
  activeAddonSoldCapacityBytes: 0,
  estimatedStorageCostCents: 0,
  estimatedEgressCost1xCents: 0,
  estimatedEgressCost2xCents: 0,
  estimatedStripeFeeCents: 0,
  estimatedComputeCostCents: 0,
  estimatedAddonCost1xCents: 0,
  estimatedAddonCost2xCents: 0,
  estimatedAddonGrossMargin1xPct: null,
  estimatedAddonGrossMargin2xPct: null,
  estimatedPlanMrrCents: 0,
  estimatedTotalStorageRevenueCents: 0,
  estimatedBusinessStorageCostCents: 0,
  estimatedBusinessStorageMarginPct: null,
  estimatedVariableCost1xCents: 0,
  estimatedVariableCost2xCents: 0,
  estimatedGrossMargin1xPct: null,
  estimatedGrossMargin2xPct: null,
};

export const DEFAULT_ADMIN_STORAGE_PROVIDER_USAGE: AdminStorageProviderUsage = {
  status: "unavailable",
  source: "unavailable",
  snapshotMonth: null,
  capturedAt: null,
  supabasePlan: null,
  computePlan: DEFAULT_ADMIN_STORAGE_ECONOMICS_ASSUMPTIONS.computePlan,
  computeMonthlyCostCents: DEFAULT_ADMIN_STORAGE_ECONOMICS_ASSUMPTIONS.computeMonthlyCostCents,
  storageUsedGb: 0,
  storageIncludedGb: 0,
  storageQuotaUsedPct: null,
  projectedStorageUsedGb: null,
  uncachedEgressGb: 0,
  cachedEgressGb: 0,
  totalEgressGb: 0,
  uncachedEgressIncludedGb: 0,
  cachedEgressIncludedGb: 0,
  uncachedEgressQuotaUsedPct: null,
  cachedEgressQuotaUsedPct: null,
  projectedUncachedEgressGb: null,
  projectedCachedEgressGb: null,
  egressMultiple: null,
  estimatedStorageOverageCostCents: 0,
  estimatedUncachedEgressOverageCostCents: 0,
  estimatedCachedEgressOverageCostCents: 0,
  estimatedTotalOverageCostCents: 0,
  observedTotalOverageCostCents: null,
  notes: null,
};

export const DEFAULT_ADMIN_STORAGE_ECONOMICS_FUNNEL: AdminStorageEconomicsFunnel = {
  impressions: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  addClicks: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  warningViews: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  addRequests: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  addSuccesses: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  addFailures: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  removals: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  source: "unavailable",
};

export const DEFAULT_ADMIN_STORAGE_ECONOMICS_HEALTH: AdminStorageEconomicsHealth = {
  degraded: false,
  reason: null,
  storageSource: "unavailable",
  funnelSource: "unavailable",
};

export const DEFAULT_ADMIN_STORAGE_ACCOUNT_HEALTH: AdminStorageAccountHealth = {
  topStorageAccounts: [],
  quotaPressureAccounts: [],
  addonOpportunityAccounts: [],
};

export const DEFAULT_ADMIN_STORAGE_LIFECYCLE_HEALTH: AdminStorageLifecycleHealth = {
  source: "unavailable",
  status: "unavailable",
  cleanupTtlDays: null,
  totalObjectCount: 0,
  totalMb: 0,
  protectedObjectCount: 0,
  protectedMb: 0,
  deleteCandidateObjectCount: 0,
  deleteCandidateMb: 0,
  manualReviewObjectCount: 0,
  manualReviewMb: 0,
  integrityProblemObjectCount: 0,
  integrityProblemMb: 0,
  rows: [],
  reason: null,
};

export const DEFAULT_ADMIN_STORAGE_TREND: AdminStorageTrend = {
  source: "unavailable",
  status: "unavailable",
  snapshots: [],
  reason: null,
};

export const DEFAULT_ADMIN_STORAGE_ECONOMICS_RESPONSE: AdminStorageEconomicsResponse = {
  assumptions: DEFAULT_ADMIN_STORAGE_ECONOMICS_ASSUMPTIONS,
  overview: DEFAULT_ADMIN_STORAGE_ECONOMICS_OVERVIEW,
  providerUsage: DEFAULT_ADMIN_STORAGE_PROVIDER_USAGE,
  byPlan: [],
  addonPackages: [],
  funnel: DEFAULT_ADMIN_STORAGE_ECONOMICS_FUNNEL,
  riskQueue: [],
  accountHealth: DEFAULT_ADMIN_STORAGE_ACCOUNT_HEALTH,
  lifecycleHealth: DEFAULT_ADMIN_STORAGE_LIFECYCLE_HEALTH,
  trend: DEFAULT_ADMIN_STORAGE_TREND,
  evidence: [],
  dataGaps: [],
  health: DEFAULT_ADMIN_STORAGE_ECONOMICS_HEALTH,
  generatedAt: null,
};

const VALID_RISK_TYPES = new Set<AdminStorageEconomicsRiskType>([
  "baseline_storage_usage",
  "over_quota",
  "near_quota",
  "addon_without_paid_plan",
  "multiple_active_addons",
  "stacked_addon_quantity",
  "manual_review_addon",
  "local_addon_missing_stripe_item",
]);

const VALID_ACCOUNT_OPPORTUNITY_TYPES = new Set<AdminStorageAccountOpportunityType>([
  "top_storage",
  "near_quota",
  "over_quota",
  "addon_opportunity",
  "addon_underused",
  "baseline_usage",
]);

const VALID_EVIDENCE_SOURCES = new Set<AdminStorageEvidenceSource>([
  "product_tracked",
  "live_storage_metadata",
  "provider_snapshot",
  "configured_estimate",
  "local_billing_rows",
  "app_error_events",
  "lifecycle_rpc",
  "unavailable",
]);

const VALID_EVIDENCE_STATUSES = new Set<AdminStorageEvidenceStatus>([
  "current",
  "stale",
  "estimated",
  "unavailable",
]);

const VALID_LIFECYCLE_ACTIONS = new Set<AdminStorageLifecycleAction>([
  "protected",
  "delete_candidate",
  "manual_review_required",
  "integrity_problem",
  "unknown",
]);

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumberWithFallback = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const toTextOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

const normalizeEvidenceStatus = (value: unknown): AdminStorageEvidenceStatus =>
  typeof value === "string" && VALID_EVIDENCE_STATUSES.has(value as AdminStorageEvidenceStatus)
    ? (value as AdminStorageEvidenceStatus)
    : "unavailable";

const normalizeEvidenceSource = (value: unknown): AdminStorageEvidenceSource =>
  typeof value === "string" && VALID_EVIDENCE_SOURCES.has(value as AdminStorageEvidenceSource)
    ? (value as AdminStorageEvidenceSource)
    : "unavailable";

const normalizeCountWindow = (value: unknown): AdminStatsCountWindow => {
  const row = toObject(value);
  return {
    total: toCount(row.total),
    last24h: toCount(row.last24h),
    last7d: toCount(row.last7d),
  };
};

const normalizeAssumptions = (value: unknown): AdminStorageEconomicsAssumptions => {
  const row = toObject(value);
  return {
    storageCostPerGbMonth: toNumber(row.storageCostPerGbMonth),
    uncachedEgressCostPerGb: toNumber(row.uncachedEgressCostPerGb),
    cachedEgressCostPerGb: toNumberWithFallback(
      row.cachedEgressCostPerGb,
      DEFAULT_ADMIN_STORAGE_ECONOMICS_ASSUMPTIONS.cachedEgressCostPerGb
    ),
    stripePercent: toNumber(row.stripePercent),
    stripeFixedCents: toCount(row.stripeFixedCents),
    targetGrossMarginPct: toNumber(row.targetGrossMarginPct),
    computePlan: toText(row.computePlan, DEFAULT_ADMIN_STORAGE_ECONOMICS_ASSUMPTIONS.computePlan),
    computeMonthlyCostCents: toCount(row.computeMonthlyCostCents),
    source: "configured_estimate",
  };
};

const normalizeOverview = (value: unknown): AdminStorageEconomicsOverview => {
  const row = toObject(value);
  return {
    trackedAccounts: toCount(row.trackedAccounts),
    accountsWithMedia: toCount(row.accountsWithMedia),
    totalTrackedBytes: toCount(row.totalTrackedBytes),
    medianTrackedBytes: toCount(row.medianTrackedBytes),
    p90TrackedBytes: toCount(row.p90TrackedBytes),
    accountsOver80Pct: toCount(row.accountsOver80Pct),
    accountsOverQuota: toCount(row.accountsOverQuota),
    baselineStorageUsers: toCount(row.baselineStorageUsers),
    activeAddonSubscribers: toCount(row.activeAddonSubscribers),
    activeAddonMrrCents: toCount(row.activeAddonMrrCents),
    activeAddonSoldCapacityBytes: toCount(row.activeAddonSoldCapacityBytes),
    estimatedStorageCostCents: toCount(row.estimatedStorageCostCents),
    estimatedEgressCost1xCents: toCount(row.estimatedEgressCost1xCents),
    estimatedEgressCost2xCents: toCount(row.estimatedEgressCost2xCents),
    estimatedStripeFeeCents: toCount(row.estimatedStripeFeeCents),
    estimatedComputeCostCents: toCount(row.estimatedComputeCostCents),
    estimatedAddonCost1xCents: toCount(row.estimatedAddonCost1xCents),
    estimatedAddonCost2xCents: toCount(row.estimatedAddonCost2xCents),
    estimatedAddonGrossMargin1xPct: toNullableNumber(row.estimatedAddonGrossMargin1xPct),
    estimatedAddonGrossMargin2xPct: toNullableNumber(row.estimatedAddonGrossMargin2xPct),
    estimatedPlanMrrCents: toCount(row.estimatedPlanMrrCents),
    estimatedTotalStorageRevenueCents: toCount(row.estimatedTotalStorageRevenueCents),
    estimatedBusinessStorageCostCents: toCount(row.estimatedBusinessStorageCostCents),
    estimatedBusinessStorageMarginPct: toNullableNumber(row.estimatedBusinessStorageMarginPct),
    estimatedVariableCost1xCents: toCount(row.estimatedVariableCost1xCents),
    estimatedVariableCost2xCents: toCount(row.estimatedVariableCost2xCents),
    estimatedGrossMargin1xPct: toNullableNumber(row.estimatedGrossMargin1xPct),
    estimatedGrossMargin2xPct: toNullableNumber(row.estimatedGrossMargin2xPct),
  };
};

const normalizeProviderUsage = (value: unknown): AdminStorageProviderUsage => {
  const row = toObject(value);
  const source =
    row.source === "manual" ||
    row.source === "supabase_usage_page" ||
    row.source === "supabase_export" ||
    row.source === "api_import"
      ? row.source
      : "unavailable";
  const status =
    row.status === "current" || row.status === "stale" || row.status === "unavailable"
      ? row.status
      : "unavailable";
  return {
    status,
    source,
    snapshotMonth: toTextOrNull(row.snapshotMonth),
    capturedAt: toTextOrNull(row.capturedAt),
    supabasePlan: toTextOrNull(row.supabasePlan),
    computePlan: toText(row.computePlan, DEFAULT_ADMIN_STORAGE_PROVIDER_USAGE.computePlan),
    computeMonthlyCostCents: toCount(row.computeMonthlyCostCents),
    storageUsedGb: toNumber(row.storageUsedGb),
    storageIncludedGb: toNumber(row.storageIncludedGb),
    storageQuotaUsedPct: toNullableNumber(row.storageQuotaUsedPct),
    projectedStorageUsedGb: toNullableNumber(row.projectedStorageUsedGb),
    uncachedEgressGb: toNumber(row.uncachedEgressGb),
    cachedEgressGb: toNumber(row.cachedEgressGb),
    totalEgressGb: toNumber(row.totalEgressGb),
    uncachedEgressIncludedGb: toNumber(row.uncachedEgressIncludedGb),
    cachedEgressIncludedGb: toNumber(row.cachedEgressIncludedGb),
    uncachedEgressQuotaUsedPct: toNullableNumber(row.uncachedEgressQuotaUsedPct),
    cachedEgressQuotaUsedPct: toNullableNumber(row.cachedEgressQuotaUsedPct),
    projectedUncachedEgressGb: toNullableNumber(row.projectedUncachedEgressGb),
    projectedCachedEgressGb: toNullableNumber(row.projectedCachedEgressGb),
    egressMultiple: toNullableNumber(row.egressMultiple),
    estimatedStorageOverageCostCents: toCount(row.estimatedStorageOverageCostCents),
    estimatedUncachedEgressOverageCostCents: toCount(row.estimatedUncachedEgressOverageCostCents),
    estimatedCachedEgressOverageCostCents: toCount(row.estimatedCachedEgressOverageCostCents),
    estimatedTotalOverageCostCents: toCount(row.estimatedTotalOverageCostCents),
    observedTotalOverageCostCents: toNullableNumber(row.observedTotalOverageCostCents),
    notes: toTextOrNull(row.notes),
  };
};

const normalizePlanRows = (value: unknown): AdminStorageEconomicsPlanRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      planId: toText(row.planId, "unknown"),
      displayName: toText(row.displayName, toText(row.planId, "Unknown")),
      isActive: Boolean(row.isActive),
      visibilityLabel: toText(row.visibilityLabel, row.isActive ? "active" : "inactive"),
      sortOrder: toCount(row.sortOrder),
      catalogStorageLimitBytes: toCount(row.catalogStorageLimitBytes),
      catalogRecurringPriceCents: toCount(row.catalogRecurringPriceCents),
      catalogAcquisitionEnabled: Boolean(row.catalogAcquisitionEnabled),
      activeStripeContracts: toCount(row.activeStripeContracts),
      contractMrrCents: toCount(row.contractMrrCents),
      accountCount: toCount(row.accountCount),
      usersWithMedia: toCount(row.usersWithMedia),
      totalTrackedBytes: toCount(row.totalTrackedBytes),
      medianTrackedBytes: toCount(row.medianTrackedBytes),
      p90TrackedBytes: toCount(row.p90TrackedBytes),
      baseLimitBytes: toCount(row.baseLimitBytes),
      addonLimitBytes: toCount(row.addonLimitBytes),
      monthlyStorageGrowthBytes: toNullableNumber(row.monthlyStorageGrowthBytes),
      accountsOver50Pct: toCount(row.accountsOver50Pct),
      accountsOver80Pct: toCount(row.accountsOver80Pct),
      accountsOver95Pct: toCount(row.accountsOver95Pct),
      accountsOverQuota: toCount(row.accountsOverQuota),
      baselineStorageUsers: toCount(row.baselineStorageUsers),
    };
  });
};

const normalizeAddonPackageRows = (value: unknown): AdminStorageEconomicsAddonPackageRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      storageAddonId: toText(row.storageAddonId, "unknown"),
      displayName: toText(row.displayName, toText(row.storageAddonId, "Unknown")),
      isActive: Boolean(row.isActive),
      sortOrder: toCount(row.sortOrder),
      acquisitionEnabled: Boolean(row.acquisitionEnabled),
      catalogStorageLimitBytes: toCount(row.catalogStorageLimitBytes),
      catalogRecurringPriceCents: toCount(row.catalogRecurringPriceCents),
      activeSubscribers: toCount(row.activeSubscribers),
      activeQuantity: toCount(row.activeQuantity),
      mrrCents: toCount(row.mrrCents),
      soldCapacityBytes: toCount(row.soldCapacityBytes),
      trackedUsageBytes: toCount(row.trackedUsageBytes),
      estimatedStorageCostCents: toCount(row.estimatedStorageCostCents),
      estimatedEgressCost1xCents: toCount(row.estimatedEgressCost1xCents),
      estimatedEgressCost2xCents: toCount(row.estimatedEgressCost2xCents),
      estimatedStripeFeeCents: toCount(row.estimatedStripeFeeCents),
      estimatedMargin1xPct: toNullableNumber(row.estimatedMargin1xPct),
      estimatedMargin2xPct: toNullableNumber(row.estimatedMargin2xPct),
    };
  });
};

const normalizeFunnel = (value: unknown): AdminStorageEconomicsFunnel => {
  const row = toObject(value);
  const source = row.source === "app_error_events" ? "app_error_events" : "unavailable";
  return {
    impressions: normalizeCountWindow(row.impressions),
    addClicks: normalizeCountWindow(row.addClicks),
    warningViews: normalizeCountWindow(row.warningViews),
    addRequests: normalizeCountWindow(row.addRequests),
    addSuccesses: normalizeCountWindow(row.addSuccesses),
    addFailures: normalizeCountWindow(row.addFailures),
    removals: normalizeCountWindow(row.removals),
    source,
  };
};

const normalizeRiskRows = (value: unknown): AdminStorageEconomicsRiskRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    const riskTypes = Array.isArray(row.riskTypes)
      ? row.riskTypes.filter(
          (riskType): riskType is AdminStorageEconomicsRiskType =>
            typeof riskType === "string" &&
            VALID_RISK_TYPES.has(riskType as AdminStorageEconomicsRiskType)
        )
      : [];
    return {
      userId: toText(row.userId, "unknown"),
      userEmail: toTextOrNull(row.userEmail),
      planId: toText(row.planId, "unknown"),
      trackedBytes: toCount(row.trackedBytes),
      totalLimitBytes: toCount(row.totalLimitBytes),
      usagePct: toNullableNumber(row.usagePct),
      activeAddonCount: toCount(row.activeAddonCount),
      riskTypes,
      details: toText(row.details, "Review storage economics state."),
    };
  });
};

const normalizeAccountHealthRows = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    const opportunityTypes = Array.isArray(row.opportunityTypes)
      ? row.opportunityTypes.filter(
          (type): type is AdminStorageAccountOpportunityType =>
            typeof type === "string" &&
            VALID_ACCOUNT_OPPORTUNITY_TYPES.has(type as AdminStorageAccountOpportunityType)
        )
      : [];
    return {
      userId: toText(row.userId, "unknown"),
      userEmail: toTextOrNull(row.userEmail),
      planId: toText(row.planId, "unknown"),
      trackedBytes: toCount(row.trackedBytes),
      totalLimitBytes: toCount(row.totalLimitBytes),
      usagePct: toNullableNumber(row.usagePct),
      activeAddonCount: toCount(row.activeAddonCount),
      opportunityTypes,
      details: toText(row.details, "Review storage account state."),
    };
  });
};

const normalizeAccountHealth = (value: unknown): AdminStorageAccountHealth => {
  const row = toObject(value);
  return {
    topStorageAccounts: normalizeAccountHealthRows(row.topStorageAccounts),
    quotaPressureAccounts: normalizeAccountHealthRows(row.quotaPressureAccounts),
    addonOpportunityAccounts: normalizeAccountHealthRows(row.addonOpportunityAccounts),
  };
};

const normalizeLifecycleRows = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    const rawAction = row.manifestAction;
    const manifestAction =
      typeof rawAction === "string" &&
      VALID_LIFECYCLE_ACTIONS.has(rawAction as AdminStorageLifecycleAction)
        ? (rawAction as AdminStorageLifecycleAction)
        : "unknown";
    return {
      manifestAction,
      manifestReason: toText(row.manifestReason, "unknown"),
      safePathClass: toText(row.safePathClass, "unknown"),
      objectCount: toCount(row.objectCount),
      objectsMissingSizeMetadata: toCount(row.objectsMissingSizeMetadata),
      totalMb: toNumber(row.totalMb),
      oldestObjectCreatedAt: toTextOrNull(row.oldestObjectCreatedAt),
      newestObjectCreatedAt: toTextOrNull(row.newestObjectCreatedAt),
      youngestAgeDays: toNullableNumber(row.youngestAgeDays),
      oldestAgeDays: toNullableNumber(row.oldestAgeDays),
    };
  });
};

const normalizeLifecycleHealth = (value: unknown): AdminStorageLifecycleHealth => {
  const row = toObject(value);
  return {
    source: row.source === "lifecycle_rpc" ? "lifecycle_rpc" : "unavailable",
    status: normalizeEvidenceStatus(row.status),
    cleanupTtlDays: toNullableNumber(row.cleanupTtlDays),
    totalObjectCount: toCount(row.totalObjectCount),
    totalMb: toNumber(row.totalMb),
    protectedObjectCount: toCount(row.protectedObjectCount),
    protectedMb: toNumber(row.protectedMb),
    deleteCandidateObjectCount: toCount(row.deleteCandidateObjectCount),
    deleteCandidateMb: toNumber(row.deleteCandidateMb),
    manualReviewObjectCount: toCount(row.manualReviewObjectCount),
    manualReviewMb: toNumber(row.manualReviewMb),
    integrityProblemObjectCount: toCount(row.integrityProblemObjectCount),
    integrityProblemMb: toNumber(row.integrityProblemMb),
    rows: normalizeLifecycleRows(row.rows),
    reason: toTextOrNull(row.reason),
  };
};

const normalizeTrend = (value: unknown): AdminStorageTrend => {
  const row = toObject(value);
  const snapshots = Array.isArray(row.snapshots)
    ? row.snapshots.map((item) => {
        const snapshot = toObject(item);
        return {
          capturedAt: toText(snapshot.capturedAt, ""),
          productTrackedBytes: toCount(snapshot.productTrackedBytes),
          providerStorageGb: toNullableNumber(snapshot.providerStorageGb),
          addonMrrCents: toCount(snapshot.addonMrrCents),
          activeAddonSoldCapacityBytes: toCount(snapshot.activeAddonSoldCapacityBytes),
        };
      })
    : [];
  return {
    source: row.source === "historical_snapshots" ? "historical_snapshots" : "unavailable",
    status: normalizeEvidenceStatus(row.status),
    snapshots: snapshots.filter((snapshot) => snapshot.capturedAt.length > 0),
    reason: toTextOrNull(row.reason),
  };
};

const normalizeEvidence = (value: unknown): AdminStorageEvidenceRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      metricKey: toText(row.metricKey, "unknown"),
      label: toText(row.label, "Unknown"),
      source: normalizeEvidenceSource(row.source),
      status: normalizeEvidenceStatus(row.status),
      capturedAt: toTextOrNull(row.capturedAt),
      details: toText(row.details, "No source details available."),
    };
  });
};

const normalizeHealth = (value: unknown): AdminStorageEconomicsHealth => {
  const row = toObject(value);
  return {
    degraded: Boolean(row.degraded),
    reason: toTextOrNull(row.reason),
    storageSource: row.storageSource === "live_query" ? "live_query" : "unavailable",
    funnelSource: row.funnelSource === "app_error_events" ? "app_error_events" : "unavailable",
  };
};

export const normalizeAdminStorageEconomicsResponse = (
  value: unknown
): AdminStorageEconomicsResponse => {
  const row = toObject(value);
  return {
    assumptions: normalizeAssumptions(row.assumptions),
    overview: normalizeOverview(row.overview),
    providerUsage: normalizeProviderUsage(row.providerUsage),
    byPlan: normalizePlanRows(row.byPlan),
    addonPackages: normalizeAddonPackageRows(row.addonPackages),
    funnel: normalizeFunnel(row.funnel),
    riskQueue: normalizeRiskRows(row.riskQueue),
    accountHealth: normalizeAccountHealth(row.accountHealth),
    lifecycleHealth: normalizeLifecycleHealth(row.lifecycleHealth),
    trend: normalizeTrend(row.trend),
    evidence: normalizeEvidence(row.evidence),
    dataGaps: toStringArray(row.dataGaps),
    health: normalizeHealth(row.health),
    generatedAt: toTextOrNull(row.generatedAt),
  };
};

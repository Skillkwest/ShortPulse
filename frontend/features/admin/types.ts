/**
 * Shared types for admin dashboard data contracts.
 */
import type { AdminPricingCustomRowsDocument } from "../../lib/model-runtime/adminPricingCustomRows";
import type { ModelPricingPolicySnapshot } from "../../lib/model-runtime/pricingPolicy";
import type { AdminModelWorkflowType } from "../../lib/model-runtime/modelWorkflowType";
import type { IssueReportStatus } from "../../lib/issueReports";
import type { TesterReportStatus } from "../../lib/testerReports";

export type AdminUserRow = {
  id: string;
  email: string | null;
  planId: string | null;
  offerId: string | null;
  stripePriceId: string | null;
  contractSource: "stripe" | "internal_comp" | null;
  recurringPriceCents: number | null;
  monthlyCreditsCents: number | null;
  billingSource: "billing_profile" | "subscription_contract";
  subscriptionStatus: string | null;
  credits: number;
  availableCredits: number;
  reservedCredits: number;
  spendableCredits: number;
  createdAt: string | null;
};

export type AdminDeleteUserRequest = {
  confirmationText: string;
};

export type AdminDeleteUserResponse = {
  ok: true;
  userId: string;
  email: string | null;
};

export type AdminBillingProfileSnapshot = {
  planId: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
};

export type AdminBillingContractSnapshot = {
  id: string;
  planId: string | null;
  offerId: string | null;
  billingInterval: "month" | "year" | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  stripeSubscriptionId: string | null;
  contractSource: "stripe" | "internal_comp" | null;
  recurringPriceCents: number | null;
  monthlyCreditsCents: number | null;
  storageLimitBytes: number | null;
  status: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  lastCreditGrantAt: string | null;
  nextCreditGrantAt: string | null;
};

export type AdminBillingOfferSnapshot = {
  id: string;
  planId: string | null;
  offerName: string | null;
  stripePriceId: string | null;
  recurringPriceCents: number | null;
  monthlyCreditsCents: number | null;
  storageLimitBytes: number | null;
  acquisitionEnabled: boolean;
  isActive: boolean;
};

export type AdminBillingStorageAddonSnapshot = {
  id: string;
  storageAddonId: string | null;
  offerId: string | null;
  stripeSubscriptionItemId: string | null;
  stripePriceId: string | null;
  storageLimitBytes: number | null;
  quantity: number;
  recurringPriceCents: number | null;
  status: string | null;
};

export type AdminBillingStorageSummarySnapshot = {
  usedBytes: number;
  baseLimitBytes: number;
  addonLimitBytes: number;
  totalLimitBytes: number;
  remainingBytes: number;
  isOverLimit: boolean;
};

export type AdminAuthIdentitySnapshot = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

export type AdminStripeCustomerSnapshot = {
  configured: boolean;
  customerId: string | null;
  deleted: boolean;
  email: string | null;
  name: string | null;
};

export type AdminStripeSubscriptionSnapshot = {
  configured: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  status: string | null;
  priceId: string | null;
  recurringPriceCents: number | null;
  currency: string | null;
  currentPeriodEnd: string | null;
};

export type AdminPricingObservabilityEventSnapshot = {
  sourceType: "reservation" | "ledger";
  rowId: string | null;
  sourceRef: string | null;
  requestId: string | null;
  observedAt: string | null;
  displayedBilledCredits: number | null;
  actualBilledCredits: number | null;
  deltaCredits: number | null;
  mismatch: boolean | null;
  pricingDisplaySource: string | null;
  pricingPolicyReady: boolean | null;
};

export type AdminPricingObservabilitySnapshot = {
  rowsScanned: {
    reservations: number;
    ledgerEntries: number;
  };
  observedRows: {
    reservations: number;
    ledgerEntries: number;
  };
  mismatchCount: number;
  lastObservedAt: string | null;
  latestEvents: AdminPricingObservabilityEventSnapshot[];
};

export type AdminBillingRecurringGrantHealthSnapshot = {
  latestSubscriptionGrantAt: string | null;
  latestAnnualAllocationAt: string | null;
  recentPaidAllocationInvoices: number;
  unmatchedPaidAllocationInvoices: string[];
};

export type AdminBillingHistoricalStorageAddonSnapshot = {
  id: string;
  storageAddonId: string | null;
  stripeSubscriptionItemId: string | null;
  status: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string | null;
};

export type AdminBillingDiagnosticsResponse = {
  target: {
    userId: string;
    email: string | null;
  };
  authIdentity: AdminAuthIdentitySnapshot;
  billingProfile: AdminBillingProfileSnapshot | null;
  currentContract: AdminBillingContractSnapshot | null;
  linkedOffer: AdminBillingOfferSnapshot | null;
  currentPublicOffer: AdminBillingOfferSnapshot | null;
  activeStorageAddons: AdminBillingStorageAddonSnapshot[];
  storageSummary: AdminBillingStorageSummarySnapshot | null;
  stripeCustomer: AdminStripeCustomerSnapshot;
  stripeSubscription: AdminStripeSubscriptionSnapshot;
  pricingObservability: AdminPricingObservabilitySnapshot;
  recurringGrantHealth: AdminBillingRecurringGrantHealthSnapshot;
  historicalStorageAddons: AdminBillingHistoricalStorageAddonSnapshot[];
  findings: AdminHealthFinding[];
};

export type AdminErrorStatus = "open" | "ignored" | "resolved";

export type AdminErrorLogRow = {
  id: string;
  fingerprint: string;
  source: string;
  scope: "app" | "generation";
  severity: "low" | "medium" | "high";
  status: AdminErrorStatus;
  message: string;
  stack: string | null;
  route: string | null;
  endpoint: string | null;
  requestId: string | null;
  httpStatus: number | null;
  userId: string | null;
  userEmail: string | null;
  metadata: Record<string, unknown> | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  occurrencesCount: number;
};

export type AdminErrorSummary = {
  openCount: number;
  highSeverityOpenCount: number;
  last24hCount: number;
  appOpenCount: number;
  generationOpenCount: number;
};

export type AdminErrorEventRow = {
  id: string;
  incidentId: string | null;
  incidentStatus: AdminErrorStatus | null;
  fingerprint: string;
  source: string;
  scope: "app" | "generation";
  severity: "low" | "medium" | "high";
  message: string;
  stack: string | null;
  route: string | null;
  endpoint: string | null;
  requestId: string | null;
  httpStatus: number | null;
  userId: string | null;
  userEmail: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string | null;
  createdAt: string | null;
};

export type AdminErrorEventSummary = {
  admissionDeniedTelemetry: {
    last15m: {
      total: number;
      byTier: Record<string, number>;
      byReason: Record<string, number>;
      byScope: Record<string, number>;
    };
    lastHour: {
      total: number;
      byTier: Record<string, number>;
      byReason: Record<string, number>;
      byScope: Record<string, number>;
    };
    last24h: {
      total: number;
      byTier: Record<string, number>;
      byReason: Record<string, number>;
      byScope: Record<string, number>;
    };
  };
  last15mCount: number;
  high15mCount: number;
  generation15mCount: number;
  providerRunningTimeout15mCount: number;
  lastHourCount: number;
  last24hCount: number;
  app24hCount: number;
  generation24hCount: number;
  high24hCount: number;
  characterModeReferenceRefreshEmptyLastHourCount: number;
  characterModeReferenceRefreshEmptyLast24hCount: number;
  characterModeBundleUnavailableFallbackLastHourCount: number;
  characterModeBundleUnavailableFallbackLast24hCount: number;
  projectWorkspaceRepairPendingLastHourCount: number;
  projectWorkspaceRepairPendingLast24hCount: number;
  total15mThreshold: number;
  high15mThreshold: number;
  generation15mThreshold: number;
  providerRunningTimeout15mThreshold: number;
  total15mBreached: boolean;
  high15mBreached: boolean;
  generation15mBreached: boolean;
  providerRunningTimeout15mBreached: boolean;
};

export type AdminErrorEventSignalFilter =
  | "all"
  | "character_mode_reference_refresh_empty"
  | "character_mode_bundle_unavailable_fallback"
  | "provider_running_timeout"
  | "project_workspace_repair_pending";

export type AdminErrorEventIncidentFilter =
  | "all"
  | "actionable"
  | "open"
  | "resolved"
  | "ignored"
  | "unlinked";

export type AdminErrorEventsHealth = {
  eventsTableAvailable: boolean;
  degraded: boolean;
  reason: string | null;
};

export type AdminIssueReportRow = {
  id: string;
  userId: string | null;
  submitterEmail: string;
  message: string;
  adminNotes: string;
  status: IssueReportStatus;
  sourcePath: string | null;
  userAgent: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminIssueReportSummary = {
  totalCount: number;
  newCount: number;
  reviewingCount: number;
  resolvedCount: number;
};

export type AdminTesterReportRunRow = {
  id: string;
  externalRunId: string;
  testerSlug: string;
  testerDisplayName: string;
  shortpulseUserId: string | null;
  shortpulseUserEmail: string | null;
  scenario: string;
  status: TesterReportStatus;
  runStartedAt: string | null;
  runFinishedAt: string | null;
  durationMinutes: number | null;
  creditsSpent: number | null;
  productionSurface: string | null;
  personaReportTitle: string;
  personaReportBody: string;
  engineeringReportTitle: string;
  engineeringReportBody: string;
  reportArtifactPaths: string[];
  evidence: Record<string, unknown>;
  createdBySource: "tester_agent" | "automation" | "admin";
  createdByUserId: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTesterReportSummary = {
  totalCount: number;
  completedCount: number;
  blockedCount: number;
  failedCount: number;
  partialCount: number;
};

export type AdminPagination = {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type AdminCrashSessionStatus =
  | "active"
  | "clean_closed"
  | "possible_ungraceful_exit"
  | "probable_freeze_or_crash"
  | "confirmed_crash";

export type AdminCrashSessionConfidence = "none" | "low" | "medium" | "high";
export type AdminCrashSessionReviewStatus = "open" | "resolved" | "ignored";

export type AdminCrashSessionRow = {
  id: string;
  browserSessionId: string;
  userId: string | null;
  userEmail: string | null;
  status: AdminCrashSessionStatus;
  confidence: AdminCrashSessionConfidence;
  effectiveStatus: AdminCrashSessionStatus;
  effectiveConfidence: AdminCrashSessionConfidence;
  isStale: boolean;
  lastEvent: string;
  route: string | null;
  buildId: string | null;
  clientRelease: string | null;
  clientEnvironment: string | null;
  userAgent: string | null;
  host: string | null;
  vercelId: string | null;
  metadata: Record<string, unknown>;
  reviewStatus: AdminCrashSessionReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedByEmail: string | null;
  reviewNote: string | null;
  startedAt: string | null;
  lastSeenAt: string | null;
  endedAt: string | null;
  suspectedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminCreditPricingBreakdown = {
  usdRaw: number | null;
  rawCredits: number | null;
  billedCredits: number | null;
  billedUsd: number | null;
};

export type AdminCreditLedgerRow = {
  id: string;
  userId: string;
  changeCents: number;
  reason: string;
  source: string;
  sourceRef: string | null;
  pricingBreakdown: AdminCreditPricingBreakdown | null;
  createdAt: string | null;
};

export type AdminAccessVia = "role" | "none";

export type AdminStatsCountWindow = {
  total: number;
  last24h: number;
  last7d: number;
};

export type AdminGlobalStatsOverview = {
  generateClicks: AdminStatsCountWindow;
  acceptedGenerations: AdminStatsCountWindow;
  successfulGenerations: AdminStatsCountWindow;
  failedGenerations: AdminStatsCountWindow;
  savedGenerations: AdminStatsCountWindow;
  projectAttachedGenerations: AdminStatsCountWindow;
  pendingGenerations: number;
  runningGenerations: number;
  uniqueModels: number;
  uniqueGenerationUsers: number;
  uniqueClickUsers: number;
  uniqueSavingUsers: number;
  lastGenerateClickAt: string | null;
  lastGenerationAt: string | null;
  lastSavedGenerationAt: string | null;
};

export type AdminGlobalModelUsageRow = {
  modelId: string;
  generateClicks: AdminStatsCountWindow;
  acceptedGenerations: AdminStatsCountWindow;
  successfulGenerations: AdminStatsCountWindow;
  failedGenerations: AdminStatsCountWindow;
  savedGenerations: AdminStatsCountWindow;
  pendingGenerations: number;
  runningGenerations: number;
  uniqueGenerationUsers: number;
  uniqueClickUsers: number;
  uniqueSavingUsers: number;
  lastGenerateClickAt: string | null;
  lastGenerationAt: string | null;
  lastSavedGenerationAt: string | null;
};

export type AdminWorkflowToolUsageRow = {
  toolKey: string;
  generateClicks: AdminStatsCountWindow;
  styleClicks: AdminStatsCountWindow;
  characterModeClicks: AdminStatsCountWindow;
  referenceAssistedClicks: AdminStatsCountWindow;
  uniqueClickUsers: number;
  lastGenerateClickAt: string | null;
};

export type AdminWorkflowModeUsageRow = {
  modeKey: string;
  generateClicks: AdminStatsCountWindow;
  acceptedGenerations: AdminStatsCountWindow;
  successfulGenerations: AdminStatsCountWindow;
  failedGenerations: AdminStatsCountWindow;
  styleAppliedGenerations: AdminStatsCountWindow;
  characterModeGenerations: AdminStatsCountWindow;
  referenceAssistedGenerations: AdminStatsCountWindow;
  lastGenerationAt: string | null;
};

export type AdminWorkflowHighlights = {
  styleAppliedGenerations: AdminStatsCountWindow;
  characterModeGenerations: AdminStatsCountWindow;
  referenceAssistedGenerations: AdminStatsCountWindow;
  styleClicks: AdminStatsCountWindow;
  characterModeClicks: AdminStatsCountWindow;
  referenceAssistedClicks: AdminStatsCountWindow;
};

export type AdminGlobalStatsWorkflows = {
  byTool: AdminWorkflowToolUsageRow[];
  byMode: AdminWorkflowModeUsageRow[];
  highlights: AdminWorkflowHighlights;
};

export type AdminAssetEventUsageRow = {
  eventType: string;
  count: AdminStatsCountWindow;
  uniqueUsers: number;
  lastEventAt: string | null;
};

export type AdminAssetAutosaveSummary = {
  autoPersisted: AdminStatsCountWindow;
  autosaveSkipped: AdminStatsCountWindow;
};

export type AdminGlobalStatsAssets = {
  events: AdminAssetEventUsageRow[];
  autosave: AdminAssetAutosaveSummary;
};

export type AdminProjectUsageSummary = {
  projectsCreated: AdminStatsCountWindow;
  activeProjectsWithGenerations: AdminStatsCountWindow;
  attachedGenerations: AdminStatsCountWindow;
  attachedMedia: AdminStatsCountWindow;
  attachedPrompts: AdminStatsCountWindow;
};

export type AdminProjectLeaderboardRow = {
  projectId: string;
  title: string;
  generationCount: AdminStatsCountWindow;
  mediaCount: AdminStatsCountWindow;
  promptCount: AdminStatsCountWindow;
  updatedAt: string | null;
  lastActivityAt: string | null;
};

export type AdminGlobalStatsProjects = {
  summary: AdminProjectUsageSummary;
  leaderboard: AdminProjectLeaderboardRow[];
};

export type AdminGlobalStatsHealth = {
  degraded: boolean;
  reason: string | null;
  overviewSource: "rpc" | "legacy_fallback";
  modelsSource: "rpc" | "legacy_fallback" | "unavailable";
  workflowsSource: "rpc" | "unavailable";
  assetsSource: "rpc" | "unavailable";
  projectsSource: "rpc" | "unavailable";
};

export type AdminStatsRateWindow = {
  total: number;
  last24h: number;
  last7d: number;
};

export type AdminGrowthDurationSummary = {
  signupToGenerate: number | null;
  signupToSuccess: number | null;
  signupToActivation: number | null;
  generateToActivation: number | null;
};

export type AdminGrowthRetentionSummary = {
  cohortSize: number;
  eligibleD1: number;
  retainedD1: number;
  d1RatePct: number;
  eligibleD7: number;
  retainedD7: number;
  d7RatePct: number;
  eligibleD30: number;
  retainedD30: number;
  d30RatePct: number;
};

export type AdminGrowthAttributionSourceRow = {
  sourceKey: string;
  signups: number;
  activatedUsers: number;
  activationRatePct: number;
  pqlUsers: number;
  paidUsers: number;
};

export type AdminGrowthAttributionCampaignRow = {
  campaignKey: string;
  signups: number;
  activatedUsers: number;
  activationRatePct: number;
  pqlUsers: number;
  paidUsers: number;
};

export type AdminMarketingStats = {
  summary: {
    signups: AdminStatsCountWindow;
    activatedUsers: AdminStatsCountWindow;
    activationRatePct: AdminStatsRateWindow;
    medianHours: AdminGrowthDurationSummary;
  };
  retention: {
    activated: AdminGrowthRetentionSummary;
    nonActivated: AdminGrowthRetentionSummary;
  };
  attribution: {
    sources: AdminGrowthAttributionSourceRow[];
    campaigns: AdminGrowthAttributionCampaignRow[];
  };
};

export type AdminSalesHighIntentUserRow = {
  userId: string;
  email: string;
  sourceKey: string;
  campaignKey: string;
  activatedAt: string | null;
  pqlScore: number;
  isPql: boolean;
  savedOutputs: number;
  successfulGenerations: number;
  activeDays: number;
  projectsCreated: number;
  projectAttachedGenerations: number;
  creditSpendCents: number;
  pricingViewedAt: string | null;
  upgradeClickedAt: string | null;
  checkoutStartedAt: string | null;
  checkoutCompletedAt: string | null;
  paidConvertedAt: string | null;
};

export type AdminSalesStats = {
  summary: {
    pricingViewedUsers: AdminStatsCountWindow;
    upgradeClickedUsers: AdminStatsCountWindow;
    checkoutStartedUsers: AdminStatsCountWindow;
    checkoutCompletedUsers: AdminStatsCountWindow;
    paidConvertedUsers: AdminStatsCountWindow;
    pqlUsers: AdminStatsCountWindow;
    activatedToPqlRatePct: number;
    pqlToPaidRatePct: number;
  };
  highIntentUsers: AdminSalesHighIntentUserRow[];
};

export type AdminGrowthStatsHealth = {
  degraded: boolean;
  reason: string | null;
  marketingSource: "rpc" | "unavailable";
  salesSource: "rpc" | "unavailable";
};

export type AdminGrowthStatsResponse = {
  marketing: AdminMarketingStats;
  sales: AdminSalesStats;
  health: AdminGrowthStatsHealth;
};

export type AdminGlobalStatsResponse = {
  overview: AdminGlobalStatsOverview;
  models: AdminGlobalModelUsageRow[];
  workflows: AdminGlobalStatsWorkflows;
  assets: AdminGlobalStatsAssets;
  projects: AdminGlobalStatsProjects;
  health: AdminGlobalStatsHealth;
  growth: AdminGrowthStatsResponse;
  generatedAt: string | null;
};

export type AdminStorageEconomicsAssumptions = {
  storageCostPerGbMonth: number;
  uncachedEgressCostPerGb: number;
  cachedEgressCostPerGb: number;
  stripePercent: number;
  stripeFixedCents: number;
  targetGrossMarginPct: number;
  computePlan: string;
  computeMonthlyCostCents: number;
  source: "configured_estimate";
};

export type AdminStorageEconomicsOverview = {
  trackedAccounts: number;
  accountsWithMedia: number;
  totalTrackedBytes: number;
  medianTrackedBytes: number;
  p90TrackedBytes: number;
  accountsOver80Pct: number;
  accountsOverQuota: number;
  baselineStorageUsers: number;
  activeAddonSubscribers: number;
  activeAddonMrrCents: number;
  activeAddonSoldCapacityBytes: number;
  estimatedStorageCostCents: number;
  estimatedEgressCost1xCents: number;
  estimatedEgressCost2xCents: number;
  estimatedStripeFeeCents: number;
  estimatedComputeCostCents: number;
  estimatedAddonCost1xCents: number;
  estimatedAddonCost2xCents: number;
  estimatedAddonGrossMargin1xPct: number | null;
  estimatedAddonGrossMargin2xPct: number | null;
  estimatedPlanMrrCents: number;
  estimatedTotalStorageRevenueCents: number;
  estimatedBusinessStorageCostCents: number;
  estimatedBusinessStorageMarginPct: number | null;
  estimatedVariableCost1xCents: number;
  estimatedVariableCost2xCents: number;
  estimatedGrossMargin1xPct: number | null;
  estimatedGrossMargin2xPct: number | null;
};

export type AdminStorageProviderUsageStatus = "current" | "stale" | "unavailable";

export type AdminStorageProviderUsage = {
  status: AdminStorageProviderUsageStatus;
  source: "manual" | "supabase_usage_page" | "supabase_export" | "api_import" | "unavailable";
  snapshotMonth: string | null;
  capturedAt: string | null;
  supabasePlan: string | null;
  computePlan: string;
  computeMonthlyCostCents: number;
  storageUsedGb: number;
  storageIncludedGb: number;
  storageQuotaUsedPct: number | null;
  projectedStorageUsedGb: number | null;
  uncachedEgressGb: number;
  cachedEgressGb: number;
  totalEgressGb: number;
  uncachedEgressIncludedGb: number;
  cachedEgressIncludedGb: number;
  uncachedEgressQuotaUsedPct: number | null;
  cachedEgressQuotaUsedPct: number | null;
  projectedUncachedEgressGb: number | null;
  projectedCachedEgressGb: number | null;
  egressMultiple: number | null;
  estimatedStorageOverageCostCents: number;
  estimatedUncachedEgressOverageCostCents: number;
  estimatedCachedEgressOverageCostCents: number;
  estimatedTotalOverageCostCents: number;
  observedTotalOverageCostCents: number | null;
  notes: string | null;
};

export type AdminStorageEconomicsPlanRow = {
  planId: string;
  displayName: string;
  isActive: boolean;
  visibilityLabel: string;
  sortOrder: number;
  catalogStorageLimitBytes: number;
  catalogRecurringPriceCents: number;
  catalogAcquisitionEnabled: boolean;
  activeStripeContracts: number;
  contractMrrCents: number;
  accountCount: number;
  usersWithMedia: number;
  totalTrackedBytes: number;
  medianTrackedBytes: number;
  p90TrackedBytes: number;
  baseLimitBytes: number;
  addonLimitBytes: number;
  monthlyStorageGrowthBytes: number | null;
  accountsOver50Pct: number;
  accountsOver80Pct: number;
  accountsOver95Pct: number;
  accountsOverQuota: number;
  baselineStorageUsers: number;
};

export type AdminStorageEconomicsAddonPackageRow = {
  storageAddonId: string;
  displayName: string;
  isActive: boolean;
  sortOrder: number;
  acquisitionEnabled: boolean;
  catalogStorageLimitBytes: number;
  catalogRecurringPriceCents: number;
  activeSubscribers: number;
  activeQuantity: number;
  mrrCents: number;
  soldCapacityBytes: number;
  trackedUsageBytes: number;
  estimatedStorageCostCents: number;
  estimatedEgressCost1xCents: number;
  estimatedEgressCost2xCents: number;
  estimatedStripeFeeCents: number;
  estimatedMargin1xPct: number | null;
  estimatedMargin2xPct: number | null;
};

export type AdminStorageEconomicsFunnel = {
  impressions: AdminStatsCountWindow;
  addClicks: AdminStatsCountWindow;
  warningViews: AdminStatsCountWindow;
  addRequests: AdminStatsCountWindow;
  addSuccesses: AdminStatsCountWindow;
  addFailures: AdminStatsCountWindow;
  removals: AdminStatsCountWindow;
  source: "app_error_events" | "unavailable";
};

export type AdminStorageEconomicsRiskType =
  | "baseline_storage_usage"
  | "over_quota"
  | "near_quota"
  | "addon_without_paid_plan"
  | "multiple_active_addons"
  | "stacked_addon_quantity"
  | "manual_review_addon"
  | "local_addon_missing_stripe_item";

export type AdminStorageEconomicsRiskRow = {
  userId: string;
  planId: string;
  trackedBytes: number;
  totalLimitBytes: number;
  usagePct: number | null;
  activeAddonCount: number;
  riskTypes: AdminStorageEconomicsRiskType[];
  details: string;
};

export type AdminStorageEconomicsHealth = {
  degraded: boolean;
  reason: string | null;
  storageSource: "live_query" | "unavailable";
  funnelSource: "app_error_events" | "unavailable";
};

export type AdminStorageEconomicsResponse = {
  assumptions: AdminStorageEconomicsAssumptions;
  overview: AdminStorageEconomicsOverview;
  providerUsage: AdminStorageProviderUsage;
  byPlan: AdminStorageEconomicsPlanRow[];
  addonPackages: AdminStorageEconomicsAddonPackageRow[];
  funnel: AdminStorageEconomicsFunnel;
  riskQueue: AdminStorageEconomicsRiskRow[];
  dataGaps: string[];
  health: AdminStorageEconomicsHealth;
  generatedAt: string | null;
};

export type AdminAccessResponse =
  | {
      ok: true;
      isAdmin: true;
      accessVia: Exclude<AdminAccessVia, "none">;
      user: {
        id: string;
        email: string | null;
      };
    }
  | {
      ok: true;
      isAdmin: false;
      accessVia: "none";
    };

export type AdminDashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type AdminDashboardOfferKind =
  | "model_pricing"
  | "plan"
  | "credit_package"
  | "storage_addon"
  | "custom";

export type AdminDashboardOffer = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  offerKind: AdminDashboardOfferKind;
  discountLabel: string;
  targetLabel: string;
  ctaLabel: string;
  ctaHref: string;
  displayOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminDashboardTutorial = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  thumbnailStoragePath: string | null;
  thumbnailFileSizeBytes: number | null;
  thumbnailContentType: string | null;
  thumbnailMediaType: "image" | "video";
  thumbnailDisplayStoragePath: string | null;
  thumbnailDisplayFileSizeBytes: number | null;
  thumbnailDisplayContentType: string | null;
  thumbnailDisplayMediaType: "image" | "video" | null;
  thumbnailPosterUrl: string | null;
  thumbnailPosterStoragePath: string | null;
  thumbnailPosterFileSizeBytes: number | null;
  thumbnailPosterContentType: string | null;
  thumbnailAlt: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminPricingPolicySnapshot = ModelPricingPolicySnapshot;

export type AdminPricingPreviewVariant = {
  id: string;
  label: string;
  aspect?: string | null;
  resolution?: string | null;
  audio?: boolean | null;
  videoInput?: boolean | null;
  breakdown: AdminCreditPricingBreakdown;
};

export type AdminPricingModelRow = {
  id: string;
  label: string;
  provider: "fal" | "kie" | "openai" | "elevenlabs" | "other";
  sourceUrl: string;
  workflowType: AdminModelWorkflowType;
  pricingStrategy: string;
  pricingStrategyLabel: string;
  lifecycle?: "active" | "deprecated" | "disabled" | "retired" | null;
  surfaces?: string[];
  displayFamily?: string | null;
  pricingFamily?: string | null;
  surfaceNote?: string | null;
  defaultAspect: string;
  allowedAspects: string[];
  defaultResolution: string | null;
  allowedResolutions: string[];
  defaultDurationSeconds: number | null;
  defaultSourceDurationSeconds: number | null;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  allowedDurations: number[];
  defaultAudio: boolean | null;
  roundingIncrement: number;
  pricingAuthority: "shared_policy" | "local_pricing" | "metadata_only";
  pricingPreview: AdminCreditPricingBreakdown | null;
  pricingPreviewVariants: AdminPricingPreviewVariant[];
};

export type AdminPricingPlanRow = {
  planId: string;
  displayName: string;
  offerId: string;
  sortOrder: number;
  accountCount: number;
  status: "active" | "baseline_access" | "payment_exempt" | "legacy" | "inactive";
  recurringPriceCents: number;
  monthlyCreditsCents: number;
  storageLimitBytes: number;
  maxConcurrentGenerations: number;
  stripeProductId: string | null;
  stripePriceId: string | null;
  acquisitionEnabled: boolean;
  isActive: boolean;
  effectiveStartAt: string | null;
  monthlyOffer: {
    offerId: string | null;
    recurringPriceCents: number;
    monthlyCreditsCents: number;
    storageLimitBytes: number;
    maxConcurrentGenerations: number;
    stripePriceId: string | null;
    acquisitionEnabled: boolean;
    isActive: boolean;
    effectiveStartAt: string | null;
  } | null;
  annualOffer: {
    offerId: string | null;
    recurringPriceCents: number;
    monthlyCreditsCents: number;
    storageLimitBytes: number;
    maxConcurrentGenerations: number;
    stripePriceId: string | null;
    acquisitionEnabled: boolean;
    isActive: boolean;
    effectiveStartAt: string | null;
  } | null;
};

export type AdminPricingCreditPackageRow = {
  id: string;
  displayName: string;
  creditAmountCents: number;
  priceCents: number;
  stripePriceId: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type AdminPricingStorageAddonRow = {
  storageAddonId: string;
  displayName: string;
  offerId: string | null;
  storageLimitBytes: number;
  recurringPriceCents: number;
  stripePriceId: string | null;
  acquisitionEnabled: boolean;
  isActive: boolean;
  effectiveStartAt: string | null;
  sortOrder: number;
};

export type AdminPricingHealthSummary = {
  planOffersMissingStripePriceIds: number;
  storageOffersMissingStripePriceIds: number;
  creditPackagesMissingStripePriceIds: number;
  totalWarnings: number;
  warnings: string[];
};

export type AdminPricingStateResponse = {
  generatedAt: string;
  modelPolicy: AdminPricingPolicySnapshot;
  customRows: AdminPricingCustomRowsDocument;
  models: AdminPricingModelRow[];
  plans: AdminPricingPlanRow[];
  creditPackages: AdminPricingCreditPackageRow[];
  storageAddons: AdminPricingStorageAddonRow[];
  health: AdminPricingHealthSummary;
};

export type AdminHealthFindingSeverity = "info" | "warning" | "critical";
export type AdminHealthFindingConfidence = "high" | "medium" | "low";

export type AdminHealthFinding = {
  code: string;
  severity: AdminHealthFindingSeverity;
  confidence: AdminHealthFindingConfidence;
  summary: string;
  details: string;
  recommendedActions: string[];
};

export type AdminHealthWindowSummary = {
  window: "24h" | "7d" | "30d";
  totalDebitCents: number;
  generationDebitCents: number;
  nonGenerationDebitCents: number;
  avgPerDayCents: number;
};

export type AdminUserHealthResponse = {
  generatedAt: string;
  lookbackDays: number;
  target: {
    lookup: string;
    lookupMode: "auto" | "email" | "user_id";
    userId: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  compatibility: {
    generationsSelectUsed: string;
    reservationsSupported: boolean;
    ledgerLegacySchema: boolean;
    warnings: string[];
  };
  credits: {
    availableCents: number;
    reservedCents: number;
    spendableCents: number;
    balanceUpdatedAt: string | null;
    totalGrantsCents: number;
    totalDebitsCentsAbs: number;
    generationDebitsCentsAbs: number;
  };
  drainage: {
    windows: AdminHealthWindowSummary[];
    dailyDebits: Array<{
      day: string;
      totalDebitCents: number;
      generationDebitCents: number;
    }>;
    topDebitSources: Array<{ source: string; cents: number }>;
    costWithoutSuccessfulGeneration: {
      debitCents: number;
      rowCount: number;
      sample: Array<{
        sourceRef: string | null;
        amountCents: number;
        reason: string;
        generationStatus: string | null;
        bucket: "linked_non_success_generation" | "missing_linkage_data";
      }>;
      linkedNonSuccessGeneration: {
        debitCents: number;
        rowCount: number;
        sample: Array<{
          sourceRef: string | null;
          amountCents: number;
          reason: string;
          generationStatus: string | null;
        }>;
      };
      missingLinkageData: {
        debitCents: number;
        rowCount: number;
        sample: Array<{
          sourceRef: string | null;
          amountCents: number;
          reason: string;
          generationStatus: string | null;
        }>;
      };
    };
  };
  generations: {
    total: number;
    byStatus: Record<string, number>;
    last24h: { total: number; success: number; fail: number; failRatePercent: number };
    last7d: { total: number; success: number; fail: number; failRatePercent: number };
    last30d: { total: number; success: number; fail: number; failRatePercent: number };
    topFailReasonsLookback: Array<{ reason: string; count: number }>;
    stuckOver1hCount: number;
    stuckOver1hSample: Array<{
      id: string;
      status: string | null;
      recoveryState: string | null;
      requestId: string | null;
      modelId: string | null;
      createdAt: string | null;
      ageHours: number | null;
      nextRecoveryAt: string | null;
    }>;
    successWithoutOutputCount: number;
    successWithoutOutputSample: Array<{
      id: string;
      requestId: string | null;
      modelId: string | null;
      completedAt: string | null;
    }>;
    projectScopedSuccessMissingAssociationCount: number;
    projectScopedSuccessMissingAssociationSample: Array<{
      id: string;
      projectId: string;
      requestId: string | null;
      modelId: string | null;
      completedAt: string | null;
    }>;
  };
  reservations: {
    total: number;
    byStatus: Record<string, number>;
    reservedWithProviderOver1hCount: number;
    reservedWithoutProviderOver15mCount: number;
    reservedLinkedTerminalGenerationCount: number;
    topCapturedModels: Array<{ modelId: string; cents: number }>;
  };
  findings: AdminHealthFinding[];
  nextSteps: string[];
};

export type AdminUserHealthFleetRiskBand = "low" | "medium" | "high";

export type AdminUserHealthFleetRun = {
  id: string;
  triggerSource: "scheduled" | "manual";
  status: "running" | "completed" | "partial" | "failed";
  lookbackDays: number;
  activeWindowDays: number;
  retentionDays: number;
  targetCount: number;
  processedCount: number;
  failedCount: number;
  partialData: boolean;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorSummary: string | null;
  metadata: Record<string, unknown> | null;
  drainage: {
    enabled: boolean;
    scanned: number;
    released: number;
    errors: number;
  };
  drainageTrend: {
    previousRunId: string | null;
    scannedDelta: number | null;
    releasedDelta: number | null;
    errorsDelta: number | null;
  };
};

export type AdminUserHealthFleetSnapshot = {
  id: string;
  userId: string;
  userEmail: string | null;
  generatedAt: string;
  highestSeverity: AdminHealthFindingSeverity;
  riskScore: number;
  riskBand: AdminUserHealthFleetRiskBand;
  spendableCents: number;
  reservedCents: number;
  failRate24hPercent: number;
  failCount24h: number;
  totalCount24h: number;
  stuckGenerationsCount: number;
  costWithoutSuccessCents: number;
  costWithoutSuccessLinkedCents: number;
  costWithoutSuccessMissingLinkageCents: number;
  partialData: boolean;
  findingCount: number;
  findings: AdminHealthFinding[];
};

export type AdminUserHealthFleetSummary = {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalCostWithoutSuccessCents: number;
  totalStuckGenerations: number;
};

export type AdminUserHealthFleetResponse = {
  run: AdminUserHealthFleetRun | null;
  summary: AdminUserHealthFleetSummary;
  snapshots: AdminUserHealthFleetSnapshot[];
  pagination: AdminPagination;
  health: {
    degraded: boolean;
    reason: string | null;
  };
  filters: {
    runId: string | null;
    severity: "all" | "critical" | "warning" | "info";
    findingCode: string;
    riskBand: "all" | AdminUserHealthFleetRiskBand;
    search: string;
  };
};

/**
 * Shared types for admin dashboard data contracts.
 */
import type { ModelPricingPolicySnapshot } from "../../lib/model-runtime/pricingPolicy";
import type { AdminModelWorkflowType } from "../../lib/model-runtime/modelWorkflowType";

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
  stripePriceId: string | null;
  stripeSubscriptionId: string | null;
  contractSource: "stripe" | "internal_comp" | null;
  recurringPriceCents: number | null;
  monthlyCreditsCents: number | null;
  storageLimitBytes: number | null;
  status: string | null;
  currentPeriodEnd: string | null;
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

export type AdminBillingDiagnosticsResponse = {
  target: {
    userId: string;
    email: string | null;
  };
  billingProfile: AdminBillingProfileSnapshot | null;
  currentContract: AdminBillingContractSnapshot | null;
  linkedOffer: AdminBillingOfferSnapshot | null;
  currentPublicOffer: AdminBillingOfferSnapshot | null;
  activeStorageAddons: AdminBillingStorageAddonSnapshot[];
  storageSummary: AdminBillingStorageSummarySnapshot | null;
  stripeSubscription: AdminStripeSubscriptionSnapshot;
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
  | "provider_running_timeout";

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

export type AdminPagination = {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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

export type AdminAccessVia = "role" | "allowlist" | "none";

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

export type AdminPricingPolicySnapshot = ModelPricingPolicySnapshot;

export type AdminPricingModelRow = {
  id: string;
  label: string;
  provider: "fal" | "kie" | "openai" | "other";
  workflowType: AdminModelWorkflowType;
  pricingStrategy: string;
  pricingStrategyLabel: string;
  defaultAspect: string;
  defaultResolution: string | null;
  defaultDurationSeconds: number | null;
  roundingIncrement: number;
  pricingPreview: AdminCreditPricingBreakdown | null;
};

export type AdminPricingPlanRow = {
  planId: string;
  displayName: string;
  offerId: string;
  sortOrder: number;
  accountCount: number;
  status: "active" | "legacy" | "inactive";
  recurringPriceCents: number;
  monthlyCreditsCents: number;
  storageLimitBytes: number;
  stripeProductId: string | null;
  stripePriceId: string | null;
  acquisitionEnabled: boolean;
  isActive: boolean;
  effectiveStartAt: string | null;
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
  offerId: string;
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
    queueSupported: boolean;
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
  };
  reservations: {
    total: number;
    byStatus: Record<string, number>;
    reservedWithProviderOver1hCount: number;
    reservedWithoutProviderOver15mCount: number;
    topCapturedModels: Array<{ modelId: string; cents: number }>;
  };
  queue: {
    total: number;
    byStatus: Record<string, number>;
    exhaustedCount: number;
    exhaustedWithReleasedReservationCount: number;
    exhaustedWithChargeCount: number;
    oldestCreatedAt: string | null;
    recentExhaustedSample: Array<{
      queueId: string;
      sourceRef: string | null;
      modelId: string | null;
      errorCode: string | null;
      generationStatus: string | null;
      reservationStatus: string | null;
      chargeCount: number;
      createdAt: string | null;
    }>;
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
  exhaustedQueueCount: number;
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
  totalExhaustedQueueRows: number;
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

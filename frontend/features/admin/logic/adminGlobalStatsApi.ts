/**
 * Helpers for the admin global-stats API contract.
 */
import type {
  AdminAssetAutosaveSummary,
  AdminAssetEventUsageRow,
  AdminGrowthAttributionCampaignRow,
  AdminGrowthAttributionSourceRow,
  AdminGrowthDurationSummary,
  AdminGrowthRetentionSummary,
  AdminGrowthStatsHealth,
  AdminGrowthStatsResponse,
  AdminGlobalModelUsageRow,
  AdminGlobalStatsAssets,
  AdminGlobalStatsHealth,
  AdminGlobalStatsOverview,
  AdminGlobalStatsProjects,
  AdminGlobalStatsResponse,
  AdminGlobalStatsWorkflows,
  AdminMarketingStats,
  AdminProjectLeaderboardRow,
  AdminProjectUsageSummary,
  AdminSalesHighIntentUserRow,
  AdminSalesStats,
  AdminStatsCountWindow,
  AdminStatsRateWindow,
  AdminWorkflowHighlights,
  AdminWorkflowModeUsageRow,
  AdminWorkflowToolUsageRow,
} from "../types";

export const DEFAULT_ADMIN_STATS_COUNT_WINDOW: AdminStatsCountWindow = {
  total: 0,
  last24h: 0,
  last7d: 0,
};

export const DEFAULT_ADMIN_GLOBAL_STATS_OVERVIEW: AdminGlobalStatsOverview = {
  generateClicks: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  acceptedGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  successfulGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  failedGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  savedGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  projectAttachedGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  pendingGenerations: 0,
  runningGenerations: 0,
  uniqueModels: 0,
  uniqueGenerationUsers: 0,
  uniqueClickUsers: 0,
  uniqueSavingUsers: 0,
  lastGenerateClickAt: null,
  lastGenerationAt: null,
  lastSavedGenerationAt: null,
};

export const DEFAULT_ADMIN_GLOBAL_STATS_WORKFLOW_HIGHLIGHTS: AdminWorkflowHighlights = {
  styleAppliedGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  characterModeGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  referenceAssistedGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  styleClicks: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  characterModeClicks: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  referenceAssistedClicks: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
};

export const DEFAULT_ADMIN_GLOBAL_STATS_WORKFLOWS: AdminGlobalStatsWorkflows = {
  byTool: [],
  byMode: [],
  highlights: DEFAULT_ADMIN_GLOBAL_STATS_WORKFLOW_HIGHLIGHTS,
};

export const DEFAULT_ADMIN_GLOBAL_STATS_ASSETS: AdminGlobalStatsAssets = {
  events: [],
  autosave: {
    autoPersisted: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    autosaveSkipped: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  },
};

export const DEFAULT_ADMIN_GLOBAL_STATS_PROJECTS: AdminGlobalStatsProjects = {
  summary: {
    projectsCreated: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    activeProjectsWithGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    attachedGenerations: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    attachedMedia: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    attachedPrompts: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
  },
  leaderboard: [],
};

export const DEFAULT_ADMIN_GLOBAL_STATS_HEALTH: AdminGlobalStatsHealth = {
  degraded: false,
  reason: null,
  overviewSource: "legacy_fallback",
  modelsSource: "unavailable",
  workflowsSource: "unavailable",
  assetsSource: "unavailable",
  projectsSource: "unavailable",
};

export const DEFAULT_ADMIN_STATS_RATE_WINDOW: AdminStatsRateWindow = {
  total: 0,
  last24h: 0,
  last7d: 0,
};

export const DEFAULT_ADMIN_GROWTH_DURATION_SUMMARY: AdminGrowthDurationSummary = {
  signupToGenerate: null,
  signupToSuccess: null,
  signupToActivation: null,
  generateToActivation: null,
};

export const DEFAULT_ADMIN_GROWTH_RETENTION_SUMMARY: AdminGrowthRetentionSummary = {
  cohortSize: 0,
  eligibleD1: 0,
  retainedD1: 0,
  d1RatePct: 0,
  eligibleD7: 0,
  retainedD7: 0,
  d7RatePct: 0,
  eligibleD30: 0,
  retainedD30: 0,
  d30RatePct: 0,
};

export const DEFAULT_ADMIN_MARKETING_STATS: AdminMarketingStats = {
  summary: {
    signups: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    activatedUsers: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    activationRatePct: { ...DEFAULT_ADMIN_STATS_RATE_WINDOW },
    medianHours: { ...DEFAULT_ADMIN_GROWTH_DURATION_SUMMARY },
  },
  retention: {
    activated: { ...DEFAULT_ADMIN_GROWTH_RETENTION_SUMMARY },
    nonActivated: { ...DEFAULT_ADMIN_GROWTH_RETENTION_SUMMARY },
  },
  attribution: {
    sources: [],
    campaigns: [],
  },
};

export const DEFAULT_ADMIN_SALES_STATS: AdminSalesStats = {
  summary: {
    pricingViewedUsers: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    upgradeClickedUsers: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    checkoutStartedUsers: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    checkoutCompletedUsers: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    paidConvertedUsers: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    pqlUsers: { ...DEFAULT_ADMIN_STATS_COUNT_WINDOW },
    activatedToPqlRatePct: 0,
    pqlToPaidRatePct: 0,
  },
  highIntentUsers: [],
};

export const DEFAULT_ADMIN_GROWTH_STATS_HEALTH: AdminGrowthStatsHealth = {
  degraded: false,
  reason: null,
  marketingSource: "unavailable",
  salesSource: "unavailable",
};

export const DEFAULT_ADMIN_GROWTH_STATS_RESPONSE: AdminGrowthStatsResponse = {
  marketing: DEFAULT_ADMIN_MARKETING_STATS,
  sales: DEFAULT_ADMIN_SALES_STATS,
  health: DEFAULT_ADMIN_GROWTH_STATS_HEALTH,
};

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const toTextOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length ? value : null;

const normalizeCountWindow = (value: unknown): AdminStatsCountWindow => {
  const row = toObject(value);
  return {
    total: toCount(row.total),
    last24h: toCount(row.last24h),
    last7d: toCount(row.last7d),
  };
};

const normalizeRateWindow = (value: unknown): AdminStatsRateWindow => {
  const row = toObject(value);
  return {
    total: Number(row.total ?? 0) || 0,
    last24h: Number(row.last24h ?? 0) || 0,
    last7d: Number(row.last7d ?? 0) || 0,
  };
};

const normalizeOverview = (value: unknown): AdminGlobalStatsOverview => {
  const row = toObject(value);
  return {
    generateClicks: normalizeCountWindow(row.generateClicks),
    acceptedGenerations: normalizeCountWindow(row.acceptedGenerations),
    successfulGenerations: normalizeCountWindow(row.successfulGenerations),
    failedGenerations: normalizeCountWindow(row.failedGenerations),
    savedGenerations: normalizeCountWindow(row.savedGenerations),
    projectAttachedGenerations: normalizeCountWindow(row.projectAttachedGenerations),
    pendingGenerations: toCount(row.pendingGenerations),
    runningGenerations: toCount(row.runningGenerations),
    uniqueModels: toCount(row.uniqueModels),
    uniqueGenerationUsers: toCount(row.uniqueGenerationUsers),
    uniqueClickUsers: toCount(row.uniqueClickUsers),
    uniqueSavingUsers: toCount(row.uniqueSavingUsers),
    lastGenerateClickAt: toTextOrNull(row.lastGenerateClickAt),
    lastGenerationAt: toTextOrNull(row.lastGenerationAt),
    lastSavedGenerationAt: toTextOrNull(row.lastSavedGenerationAt),
  };
};

const normalizeModels = (value: unknown): AdminGlobalModelUsageRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      modelId: String(row.modelId ?? "unknown"),
      generateClicks: normalizeCountWindow(row.generateClicks),
      acceptedGenerations: normalizeCountWindow(row.acceptedGenerations),
      successfulGenerations: normalizeCountWindow(row.successfulGenerations),
      failedGenerations: normalizeCountWindow(row.failedGenerations),
      savedGenerations: normalizeCountWindow(row.savedGenerations),
      pendingGenerations: toCount(row.pendingGenerations),
      runningGenerations: toCount(row.runningGenerations),
      uniqueGenerationUsers: toCount(row.uniqueGenerationUsers),
      uniqueClickUsers: toCount(row.uniqueClickUsers),
      uniqueSavingUsers: toCount(row.uniqueSavingUsers),
      lastGenerateClickAt: toTextOrNull(row.lastGenerateClickAt),
      lastGenerationAt: toTextOrNull(row.lastGenerationAt),
      lastSavedGenerationAt: toTextOrNull(row.lastSavedGenerationAt),
    };
  });
};

const normalizeWorkflowToolRows = (value: unknown): AdminWorkflowToolUsageRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      toolKey: String(row.toolKey ?? "unknown"),
      generateClicks: normalizeCountWindow(row.generateClicks),
      styleClicks: normalizeCountWindow(row.styleClicks),
      characterModeClicks: normalizeCountWindow(row.characterModeClicks),
      referenceAssistedClicks: normalizeCountWindow(row.referenceAssistedClicks),
      uniqueClickUsers: toCount(row.uniqueClickUsers),
      lastGenerateClickAt: toTextOrNull(row.lastGenerateClickAt),
    };
  });
};

const normalizeWorkflowModeRows = (value: unknown): AdminWorkflowModeUsageRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      modeKey: String(row.modeKey ?? "unknown"),
      generateClicks: normalizeCountWindow(row.generateClicks),
      acceptedGenerations: normalizeCountWindow(row.acceptedGenerations),
      successfulGenerations: normalizeCountWindow(row.successfulGenerations),
      failedGenerations: normalizeCountWindow(row.failedGenerations),
      styleAppliedGenerations: normalizeCountWindow(row.styleAppliedGenerations),
      characterModeGenerations: normalizeCountWindow(row.characterModeGenerations),
      referenceAssistedGenerations: normalizeCountWindow(row.referenceAssistedGenerations),
      lastGenerationAt: toTextOrNull(row.lastGenerationAt),
    };
  });
};

const normalizeWorkflowHighlights = (value: unknown): AdminWorkflowHighlights => {
  const row = toObject(value);
  return {
    styleAppliedGenerations: normalizeCountWindow(row.styleAppliedGenerations),
    characterModeGenerations: normalizeCountWindow(row.characterModeGenerations),
    referenceAssistedGenerations: normalizeCountWindow(row.referenceAssistedGenerations),
    styleClicks: normalizeCountWindow(row.styleClicks),
    characterModeClicks: normalizeCountWindow(row.characterModeClicks),
    referenceAssistedClicks: normalizeCountWindow(row.referenceAssistedClicks),
  };
};

const normalizeWorkflows = (value: unknown): AdminGlobalStatsWorkflows => {
  const row = toObject(value);
  return {
    byTool: normalizeWorkflowToolRows(row.byTool),
    byMode: normalizeWorkflowModeRows(row.byMode),
    highlights: normalizeWorkflowHighlights(row.highlights),
  };
};

const normalizeAssetEventRows = (value: unknown): AdminAssetEventUsageRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      eventType: String(row.eventType ?? "unknown"),
      count: normalizeCountWindow(row.count),
      uniqueUsers: toCount(row.uniqueUsers),
      lastEventAt: toTextOrNull(row.lastEventAt),
    };
  });
};

const normalizeAutosaveSummary = (value: unknown): AdminAssetAutosaveSummary => {
  const row = toObject(value);
  return {
    autoPersisted: normalizeCountWindow(row.autoPersisted),
    autosaveSkipped: normalizeCountWindow(row.autosaveSkipped),
  };
};

const normalizeAssets = (value: unknown): AdminGlobalStatsAssets => {
  const row = toObject(value);
  return {
    events: normalizeAssetEventRows(row.events),
    autosave: normalizeAutosaveSummary(row.autosave),
  };
};

const normalizeProjectSummary = (value: unknown): AdminProjectUsageSummary => {
  const row = toObject(value);
  return {
    projectsCreated: normalizeCountWindow(row.projectsCreated),
    activeProjectsWithGenerations: normalizeCountWindow(row.activeProjectsWithGenerations),
    attachedGenerations: normalizeCountWindow(row.attachedGenerations),
    attachedMedia: normalizeCountWindow(row.attachedMedia),
    attachedPrompts: normalizeCountWindow(row.attachedPrompts),
  };
};

const normalizeProjectLeaderboard = (value: unknown): AdminProjectLeaderboardRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      projectId: String(row.projectId ?? "unknown"),
      title: toTextOrNull(row.title) ?? "Untitled project",
      generationCount: normalizeCountWindow(row.generationCount),
      mediaCount: normalizeCountWindow(row.mediaCount),
      promptCount: normalizeCountWindow(row.promptCount),
      updatedAt: toTextOrNull(row.updatedAt),
      lastActivityAt: toTextOrNull(row.lastActivityAt),
    };
  });
};

const normalizeProjects = (value: unknown): AdminGlobalStatsProjects => {
  const row = toObject(value);
  return {
    summary: normalizeProjectSummary(row.summary),
    leaderboard: normalizeProjectLeaderboard(row.leaderboard),
  };
};

const normalizeDurationSummary = (value: unknown): AdminGrowthDurationSummary => {
  const row = toObject(value);
  const toNullableNumber = (nextValue: unknown): number | null => {
    const parsed = Number(nextValue);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    signupToGenerate: toNullableNumber(row.signupToGenerate),
    signupToSuccess: toNullableNumber(row.signupToSuccess),
    signupToActivation: toNullableNumber(row.signupToActivation),
    generateToActivation: toNullableNumber(row.generateToActivation),
  };
};

const normalizeRetentionSummary = (value: unknown): AdminGrowthRetentionSummary => {
  const row = toObject(value);
  return {
    cohortSize: toCount(row.cohortSize),
    eligibleD1: toCount(row.eligibleD1),
    retainedD1: toCount(row.retainedD1),
    d1RatePct: Number(row.d1RatePct ?? 0) || 0,
    eligibleD7: toCount(row.eligibleD7),
    retainedD7: toCount(row.retainedD7),
    d7RatePct: Number(row.d7RatePct ?? 0) || 0,
    eligibleD30: toCount(row.eligibleD30),
    retainedD30: toCount(row.retainedD30),
    d30RatePct: Number(row.d30RatePct ?? 0) || 0,
  };
};

const normalizeGrowthAttributionSources = (value: unknown): AdminGrowthAttributionSourceRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      sourceKey: String(row.sourceKey ?? "direct"),
      signups: toCount(row.signups),
      activatedUsers: toCount(row.activatedUsers),
      activationRatePct: Number(row.activationRatePct ?? 0) || 0,
      pqlUsers: toCount(row.pqlUsers),
      paidUsers: toCount(row.paidUsers),
    };
  });
};

const normalizeGrowthAttributionCampaigns = (
  value: unknown
): AdminGrowthAttributionCampaignRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      campaignKey: String(row.campaignKey ?? "none"),
      signups: toCount(row.signups),
      activatedUsers: toCount(row.activatedUsers),
      activationRatePct: Number(row.activationRatePct ?? 0) || 0,
      pqlUsers: toCount(row.pqlUsers),
      paidUsers: toCount(row.paidUsers),
    };
  });
};

const normalizeMarketingStats = (value: unknown): AdminMarketingStats => {
  const row = toObject(value);
  const summary = toObject(row.summary);
  const retention = toObject(row.retention);
  const attribution = toObject(row.attribution);
  return {
    summary: {
      signups: normalizeCountWindow(summary.signups),
      activatedUsers: normalizeCountWindow(summary.activatedUsers),
      activationRatePct: normalizeRateWindow(summary.activationRatePct),
      medianHours: normalizeDurationSummary(summary.medianHours),
    },
    retention: {
      activated: normalizeRetentionSummary(retention.activated),
      nonActivated: normalizeRetentionSummary(retention.nonActivated),
    },
    attribution: {
      sources: normalizeGrowthAttributionSources(attribution.sources),
      campaigns: normalizeGrowthAttributionCampaigns(attribution.campaigns),
    },
  };
};

const normalizeSalesHighIntentUsers = (value: unknown): AdminSalesHighIntentUserRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObject(item);
    return {
      userId: String(row.userId ?? "unknown"),
      email: String(row.email ?? "Unknown user"),
      sourceKey: String(row.sourceKey ?? "direct"),
      campaignKey: String(row.campaignKey ?? "none"),
      activatedAt: toTextOrNull(row.activatedAt),
      pqlScore: toCount(row.pqlScore),
      isPql: Boolean(row.isPql),
      savedOutputs: toCount(row.savedOutputs),
      successfulGenerations: toCount(row.successfulGenerations),
      activeDays: toCount(row.activeDays),
      projectsCreated: toCount(row.projectsCreated),
      projectAttachedGenerations: toCount(row.projectAttachedGenerations),
      creditSpendCents: toCount(row.creditSpendCents),
      pricingViewedAt: toTextOrNull(row.pricingViewedAt),
      upgradeClickedAt: toTextOrNull(row.upgradeClickedAt),
      checkoutStartedAt: toTextOrNull(row.checkoutStartedAt),
      checkoutCompletedAt: toTextOrNull(row.checkoutCompletedAt),
      paidConvertedAt: toTextOrNull(row.paidConvertedAt),
    };
  });
};

const normalizeSalesStats = (value: unknown): AdminSalesStats => {
  const row = toObject(value);
  const summary = toObject(row.summary);
  return {
    summary: {
      pricingViewedUsers: normalizeCountWindow(summary.pricingViewedUsers),
      upgradeClickedUsers: normalizeCountWindow(summary.upgradeClickedUsers),
      checkoutStartedUsers: normalizeCountWindow(summary.checkoutStartedUsers),
      checkoutCompletedUsers: normalizeCountWindow(summary.checkoutCompletedUsers),
      paidConvertedUsers: normalizeCountWindow(summary.paidConvertedUsers),
      pqlUsers: normalizeCountWindow(summary.pqlUsers),
      activatedToPqlRatePct: Number(summary.activatedToPqlRatePct ?? 0) || 0,
      pqlToPaidRatePct: Number(summary.pqlToPaidRatePct ?? 0) || 0,
    },
    highIntentUsers: normalizeSalesHighIntentUsers(row.highIntentUsers),
  };
};

const normalizeGrowth = (value: unknown): AdminGrowthStatsResponse => {
  const row = toObject(value);
  const health = toObject(row.health);
  return {
    marketing: normalizeMarketingStats(row.marketing),
    sales: normalizeSalesStats(row.sales),
    health: {
      degraded: Boolean(health.degraded),
      reason: toTextOrNull(health.reason),
      marketingSource: health.marketingSource === "rpc" ? "rpc" : "unavailable",
      salesSource: health.salesSource === "rpc" ? "rpc" : "unavailable",
    },
  };
};

/**
 * Normalizes the admin global-stats response into route-safe defaults.
 */
export const normalizeAdminGlobalStatsResponse = (value: unknown): AdminGlobalStatsResponse => {
  const data = toObject(value);
  const health = toObject(data.health);
  return {
    overview: normalizeOverview(data.overview),
    models: normalizeModels(data.models),
    workflows: normalizeWorkflows(data.workflows),
    assets: normalizeAssets(data.assets),
    projects: normalizeProjects(data.projects),
    health: {
      degraded: Boolean(health.degraded),
      reason: toTextOrNull(health.reason),
      overviewSource: health.overviewSource === "rpc" ? "rpc" : "legacy_fallback",
      modelsSource:
        health.modelsSource === "rpc"
          ? "rpc"
          : health.modelsSource === "legacy_fallback"
            ? "legacy_fallback"
            : "unavailable",
      workflowsSource: health.workflowsSource === "rpc" ? "rpc" : "unavailable",
      assetsSource: health.assetsSource === "rpc" ? "rpc" : "unavailable",
      projectsSource: health.projectsSource === "rpc" ? "rpc" : "unavailable",
    },
    growth: normalizeGrowth(data.growth),
    generatedAt: toTextOrNull(data.generatedAt),
  };
};

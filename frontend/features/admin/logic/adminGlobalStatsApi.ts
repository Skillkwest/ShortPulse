/**
 * Helpers for the admin global-stats API contract.
 */
import type {
  AdminAssetAutosaveSummary,
  AdminAssetEventUsageRow,
  AdminGlobalModelUsageRow,
  AdminGlobalStatsAssets,
  AdminGlobalStatsHealth,
  AdminGlobalStatsOverview,
  AdminGlobalStatsProjects,
  AdminGlobalStatsResponse,
  AdminGlobalStatsWorkflows,
  AdminProjectLeaderboardRow,
  AdminProjectUsageSummary,
  AdminStatsCountWindow,
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
    generatedAt: toTextOrNull(data.generatedAt),
  };
};

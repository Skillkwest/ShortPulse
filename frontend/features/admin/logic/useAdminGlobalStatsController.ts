/**
 * Admin global-stats controller.
 * Loads and refreshes the shared stats snapshot for the admin stats page.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  DEFAULT_ADMIN_GLOBAL_STATS_ASSETS,
  DEFAULT_ADMIN_GLOBAL_STATS_HEALTH,
  DEFAULT_ADMIN_GLOBAL_STATS_OVERVIEW,
  DEFAULT_ADMIN_GLOBAL_STATS_PROJECTS,
  DEFAULT_ADMIN_GLOBAL_STATS_WORKFLOWS,
  normalizeAdminGlobalStatsResponse,
} from "./adminGlobalStatsApi";
import type {
  AdminGlobalModelUsageRow,
  AdminGlobalStatsAssets,
  AdminGlobalStatsHealth,
  AdminGlobalStatsOverview,
  AdminGlobalStatsProjects,
  AdminGlobalStatsWorkflows,
} from "../types";

const GLOBAL_STATS_REFRESH_INTERVAL_MS = 60000;

type UseAdminGlobalStatsControllerParams = {
  enabled: boolean;
};

type UseAdminGlobalStatsControllerResult = {
  overview: AdminGlobalStatsOverview;
  models: AdminGlobalModelUsageRow[];
  workflows: AdminGlobalStatsWorkflows;
  assets: AdminGlobalStatsAssets;
  projects: AdminGlobalStatsProjects;
  health: AdminGlobalStatsHealth;
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Provides data loading and refresh behavior for the admin global-stats route.
 */
export const useAdminGlobalStatsController = ({
  enabled,
}: UseAdminGlobalStatsControllerParams): UseAdminGlobalStatsControllerResult => {
  const [overview, setOverview] = React.useState(DEFAULT_ADMIN_GLOBAL_STATS_OVERVIEW);
  const [models, setModels] = React.useState<AdminGlobalModelUsageRow[]>([]);
  const [workflows, setWorkflows] = React.useState(DEFAULT_ADMIN_GLOBAL_STATS_WORKFLOWS);
  const [assets, setAssets] = React.useState(DEFAULT_ADMIN_GLOBAL_STATS_ASSETS);
  const [projects, setProjects] = React.useState(DEFAULT_ADMIN_GLOBAL_STATS_PROJECTS);
  const [health, setHealth] = React.useState(DEFAULT_ADMIN_GLOBAL_STATS_HEALTH);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/admin/stats/global", {
        method: "GET",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load admin global stats.");
      }
      const normalized = normalizeAdminGlobalStatsResponse(data);
      setOverview(normalized.overview);
      setModels(normalized.models);
      setWorkflows(normalized.workflows);
      setAssets(normalized.assets);
      setProjects(normalized.projects);
      setHealth(normalized.health);
      setGeneratedAt(normalized.generatedAt);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load admin global stats."
      );
      setOverview(DEFAULT_ADMIN_GLOBAL_STATS_OVERVIEW);
      setModels([]);
      setWorkflows(DEFAULT_ADMIN_GLOBAL_STATS_WORKFLOWS);
      setAssets(DEFAULT_ADMIN_GLOBAL_STATS_ASSETS);
      setProjects(DEFAULT_ADMIN_GLOBAL_STATS_PROJECTS);
      setHealth(DEFAULT_ADMIN_GLOBAL_STATS_HEALTH);
      setGeneratedAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  React.useEffect(() => {
    if (!enabled) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, GLOBAL_STATS_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, refresh]);

  return {
    overview,
    models,
    workflows,
    assets,
    projects,
    health,
    generatedAt,
    loading,
    error,
    refresh,
  };
};

/**
 * Admin API: fetch the admin stats workspace payload for overview, model, workflow,
 * asset, and project analytics.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type LegacySummaryRow = {
  total_generate_clicks?: unknown;
  generate_clicks_last_24h?: unknown;
  generate_clicks_last_7d?: unknown;
  total_generations?: unknown;
  generations_last_24h?: unknown;
  generations_last_7d?: unknown;
  successful_generations?: unknown;
  failed_generations?: unknown;
  pending_generations?: unknown;
  running_generations?: unknown;
  unique_models?: unknown;
  unique_generation_users?: unknown;
  unique_click_users?: unknown;
  last_generate_click_at?: unknown;
  last_generation_at?: unknown;
};

type LegacyModelRow = {
  model_id?: unknown;
  generate_clicks?: unknown;
  generate_clicks_last_24h?: unknown;
  generate_clicks_last_7d?: unknown;
  generations_started?: unknown;
  generations_last_24h?: unknown;
  generations_last_7d?: unknown;
  successful_generations?: unknown;
  failed_generations?: unknown;
  pending_generations?: unknown;
  running_generations?: unknown;
  unique_generation_users?: unknown;
  unique_click_users?: unknown;
  last_generate_click_at?: unknown;
  last_generation_at?: unknown;
};

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
};

const toIsoStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toWindow = (total: unknown, last24h: unknown, last7d: unknown) => ({
  total: toCount(total),
  last24h: toCount(last24h),
  last7d: toCount(last7d),
});

const normalizeLegacyOverview = (
  row: LegacySummaryRow | null | undefined,
  extras?: {
    totalSavedGenerations?: number;
    savedGenerationsLast24h?: number;
    savedGenerationsLast7d?: number;
    uniqueSavingUsers?: number;
    projectAttachedGenerationsTotal?: number;
    projectAttachedGenerationsLast24h?: number;
    projectAttachedGenerationsLast7d?: number;
    lastSavedGenerationAt?: string | null;
  }
) => ({
  generateClicks: toWindow(
    row?.total_generate_clicks,
    row?.generate_clicks_last_24h,
    row?.generate_clicks_last_7d
  ),
  acceptedGenerations: toWindow(
    row?.total_generations,
    row?.generations_last_24h,
    row?.generations_last_7d
  ),
  successfulGenerations: toWindow(row?.successful_generations, 0, 0),
  failedGenerations: toWindow(row?.failed_generations, 0, 0),
  savedGenerations: toWindow(
    extras?.totalSavedGenerations ?? 0,
    extras?.savedGenerationsLast24h ?? 0,
    extras?.savedGenerationsLast7d ?? 0
  ),
  projectAttachedGenerations: toWindow(
    extras?.projectAttachedGenerationsTotal ?? 0,
    extras?.projectAttachedGenerationsLast24h ?? 0,
    extras?.projectAttachedGenerationsLast7d ?? 0
  ),
  pendingGenerations: toCount(row?.pending_generations),
  runningGenerations: toCount(row?.running_generations),
  uniqueModels: toCount(row?.unique_models),
  uniqueGenerationUsers: toCount(row?.unique_generation_users),
  uniqueClickUsers: toCount(row?.unique_click_users),
  uniqueSavingUsers: toCount(extras?.uniqueSavingUsers ?? 0),
  lastGenerateClickAt: toIsoStringOrNull(row?.last_generate_click_at),
  lastGenerationAt: toIsoStringOrNull(row?.last_generation_at),
  lastSavedGenerationAt: extras?.lastSavedGenerationAt ?? null,
});

const normalizeLegacyModels = (rows: LegacyModelRow[] | null | undefined) =>
  (rows ?? []).map((row) => ({
    modelId:
      typeof row.model_id === "string" && row.model_id.trim() ? row.model_id.trim() : "unknown",
    generateClicks: toWindow(
      row.generate_clicks,
      row.generate_clicks_last_24h,
      row.generate_clicks_last_7d
    ),
    acceptedGenerations: toWindow(
      row.generations_started,
      row.generations_last_24h,
      row.generations_last_7d
    ),
    successfulGenerations: toWindow(row.successful_generations, 0, 0),
    failedGenerations: toWindow(row.failed_generations, 0, 0),
    savedGenerations: toWindow(0, 0, 0),
    pendingGenerations: toCount(row.pending_generations),
    runningGenerations: toCount(row.running_generations),
    uniqueGenerationUsers: toCount(row.unique_generation_users),
    uniqueClickUsers: toCount(row.unique_click_users),
    uniqueSavingUsers: 0,
    lastGenerateClickAt: toIsoStringOrNull(row.last_generate_click_at),
    lastGenerationAt: toIsoStringOrNull(row.last_generation_at),
    lastSavedGenerationAt: null,
  }));

const isMissingRpcError = (value: unknown, functionNames: string[]): boolean => {
  const message =
    value && typeof value === "object" && "message" in value
      ? String((value as { message?: unknown }).message ?? "")
      : String(value ?? "");
  const normalized = message.toLowerCase();
  return functionNames.some((functionName) => normalized.includes(functionName.toLowerCase()));
};

const buildDirectFallbackExtras = async () => {
  const supabaseAdmin = getSupabaseAdmin();
  const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last7dIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    projectAttachedGenerationsTotalResult,
    projectAttachedGenerationsLast24hResult,
    projectAttachedGenerationsLast7dResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("project_generation_items")
      .select("generation_id", { head: true, count: "exact" }),
    supabaseAdmin
      .from("project_generation_items")
      .select("generation_id", { head: true, count: "exact" })
      .gte("created_at", last24hIso),
    supabaseAdmin
      .from("project_generation_items")
      .select("generation_id", { head: true, count: "exact" })
      .gte("created_at", last7dIso),
  ]);

  return {
    totalSavedGenerations: 0,
    savedGenerationsLast24h: 0,
    savedGenerationsLast7d: 0,
    uniqueSavingUsers: 0,
    lastSavedGenerationAt: null,
    projectAttachedGenerationsTotal: toCount(projectAttachedGenerationsTotalResult.count),
    projectAttachedGenerationsLast24h: toCount(projectAttachedGenerationsLast24hResult.count),
    projectAttachedGenerationsLast7d: toCount(projectAttachedGenerationsLast7dResult.count),
  };
};

const buildLegacyFallbackPayload = async () => {
  const supabaseAdmin = getSupabaseAdmin();
  const [summaryResult, modelsResult, extras] = await Promise.all([
    supabaseAdmin.rpc("get_admin_global_stats_summary"),
    supabaseAdmin.rpc("list_admin_model_usage_stats", { p_limit: 100 }),
    buildDirectFallbackExtras(),
  ]);

  const summaryMissing = isMissingRpcError(summaryResult.error, ["get_admin_global_stats_summary"]);
  const modelsMissing = isMissingRpcError(modelsResult.error, ["list_admin_model_usage_stats"]);

  if (summaryResult.error && !summaryMissing) {
    throw new Error(summaryResult.error.message || "Unable to load admin global stats summary.");
  }
  if (modelsResult.error && !modelsMissing) {
    throw new Error(modelsResult.error.message || "Unable to load admin model usage stats.");
  }

  const summaryRows = Array.isArray(summaryResult.data)
    ? (summaryResult.data as LegacySummaryRow[])
    : [];

  return {
    overview: normalizeLegacyOverview(summaryRows[0], extras),
    models: modelsMissing
      ? []
      : normalizeLegacyModels(
          Array.isArray(modelsResult.data) ? (modelsResult.data as LegacyModelRow[]) : []
        ),
    workflows: {
      byTool: [],
      byMode: [],
      highlights: {
        styleAppliedGenerations: { total: 0, last24h: 0, last7d: 0 },
        characterModeGenerations: { total: 0, last24h: 0, last7d: 0 },
        referenceAssistedGenerations: { total: 0, last24h: 0, last7d: 0 },
        styleClicks: { total: 0, last24h: 0, last7d: 0 },
        characterModeClicks: { total: 0, last24h: 0, last7d: 0 },
        referenceAssistedClicks: { total: 0, last24h: 0, last7d: 0 },
      },
    },
    assets: {
      events: [],
      autosave: {
        autoPersisted: { total: 0, last24h: 0, last7d: 0 },
        autosaveSkipped: { total: 0, last24h: 0, last7d: 0 },
      },
    },
    projects: {
      summary: {
        projectsCreated: { total: 0, last24h: 0, last7d: 0 },
        activeProjectsWithGenerations: { total: 0, last24h: 0, last7d: 0 },
        attachedGenerations: {
          total: extras.projectAttachedGenerationsTotal,
          last24h: extras.projectAttachedGenerationsLast24h,
          last7d: extras.projectAttachedGenerationsLast7d,
        },
        attachedMedia: { total: 0, last24h: 0, last7d: 0 },
        attachedPrompts: { total: 0, last24h: 0, last7d: 0 },
      },
      leaderboard: [],
    },
    health: {
      degraded: true,
      reason:
        "Admin stats v1 RPC is unavailable. Apply SQL migration 100_add_admin_global_stats_v1_rpc.sql to enable workflow, asset, and project analytics.",
      overviewSource: "legacy_fallback",
      modelsSource: modelsMissing ? "unavailable" : "legacy_fallback",
      workflowsSource: "unavailable",
      assetsSource: "unavailable",
      projectsSource: "unavailable",
    },
    generatedAt: new Date().toISOString(),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const statsResult = await supabaseAdmin.rpc("get_admin_global_stats_v1");
    const hasRpcGap = isMissingRpcError(statsResult.error, ["get_admin_global_stats_v1"]);

    if (statsResult.error && !hasRpcGap) {
      return res
        .status(500)
        .json({ error: statsResult.error.message || "Unable to load admin stats." });
    }

    if (hasRpcGap) {
      const fallbackPayload = await buildLegacyFallbackPayload();
      return res.status(200).json(fallbackPayload);
    }

    return res.status(200).json({
      ...(statsResult.data && typeof statsResult.data === "object" ? statsResult.data : {}),
      health: {
        degraded: false,
        reason: null,
        overviewSource: "rpc",
        modelsSource: "rpc",
        workflowsSource: "rpc",
        assetsSource: "rpc",
        projectsSource: "rpc",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/stats/global",
      user: adminUser,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load admin stats.",
    });
  }
}

/**
 * Server-side helper seam for global AI Studio built-in Styles catalog access.
 * Admin writes here and AI Studio reads here so built-ins do not depend on user preferences.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SEEDED_BUILT_IN_STYLE_DEFINITIONS,
  normalizeBuiltInStyleDefinitions,
  type BuiltInStyleDefinition,
} from "../../model-runtime/builtInStyles";
import {
  asNullableString,
  clearControlPlaneCatalogCacheState,
  createControlPlaneCatalogCacheState,
  hasSupabaseAdminConfig,
  resolveCachedControlPlaneCatalog,
  resolveControlPlaneCatalogForAdmin,
  saveControlPlaneCatalog,
  type ControlPlaneCatalogSupabaseParams,
} from "./controlPlaneCatalogCore";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type ActiveBuiltInStyleCatalog = {
  styleDefinitions: BuiltInStyleDefinition[];
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
};

export type RuntimeBuiltInStyleCatalogResolution = {
  styleDefinitions: BuiltInStyleDefinition[];
  updatedAt: string | null;
  updatedByEmail: string | null;
  source: "control_plane" | "seed";
  degraded: boolean;
};

export type RuntimeBuiltInStyleCatalogAdminResolution = RuntimeBuiltInStyleCatalogResolution;

export class BuiltInStyleCatalogVersionMismatchError extends Error {
  constructor() {
    super("Built-in Styles catalog changed since it was loaded.");
    this.name = "BuiltInStyleCatalogVersionMismatchError";
  }
}

const runtimeBuiltInStyleCatalogCache =
  createControlPlaneCatalogCacheState<RuntimeBuiltInStyleCatalogResolution>();

export const clearBuiltInStyleControlPlaneCacheForTests = (): void => {
  clearControlPlaneCatalogCacheState(runtimeBuiltInStyleCatalogCache);
};

export const getSeededBuiltInStyleDefinitions = (): BuiltInStyleDefinition[] => [
  ...SEEDED_BUILT_IN_STYLE_DEFINITIONS,
];

export const fetchActiveBuiltInStyleCatalog = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: ControlPlaneCatalogSupabaseParams = {}): Promise<ActiveBuiltInStyleCatalog | null> => {
  const { data, error } = await supabaseAdmin
    .from("ai_studio_builtin_style_runtime")
    .select("style_definitions, updated_at, updated_by_user_id, updated_by_email")
    .eq("singleton", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load built-in Styles catalog.");
  }
  if (!data) return null;

  return {
    styleDefinitions: normalizeBuiltInStyleDefinitions(data.style_definitions),
    updatedAt: asNullableString(data.updated_at),
    updatedByUserId: asNullableString(data.updated_by_user_id),
    updatedByEmail: asNullableString(data.updated_by_email),
  };
};

export const resolveRuntimeBuiltInStyleCatalog = async ({
  controlPlaneCacheTtlMs = process.env.BUILT_IN_STYLE_CONTROL_PLANE_CACHE_TTL_MS,
  bypassCache = false,
}: {
  controlPlaneCacheTtlMs?: string | null;
  bypassCache?: boolean;
} = {}): Promise<RuntimeBuiltInStyleCatalogResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedBuiltInStyleCatalogResolution(false);
  }

  return resolveCachedControlPlaneCatalog({
    cacheState: runtimeBuiltInStyleCatalogCache,
    bypassCache,
    controlPlaneCacheTtlMs,
    fetchActiveCatalog: fetchActiveBuiltInStyleCatalog,
    buildControlPlaneResolution: buildControlPlaneBuiltInStyleCatalogResolution,
    buildSeedResolution: buildSeedBuiltInStyleCatalogResolution,
    buildDegradedResolutionFromPrevious: buildDegradedBuiltInStyleCatalogResolutionFromPrevious,
  });
};

export const resolveBuiltInStyleCatalogForAdmin = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: ControlPlaneCatalogSupabaseParams = {}): Promise<RuntimeBuiltInStyleCatalogAdminResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedBuiltInStyleCatalogResolution(false);
  }

  return resolveControlPlaneCatalogForAdmin({
    fetchActiveCatalog: () => fetchActiveBuiltInStyleCatalog({ supabaseAdmin }),
    buildControlPlaneResolution: buildControlPlaneBuiltInStyleCatalogResolution,
    buildSeedResolution: (degraded) =>
      runtimeBuiltInStyleCatalogCache.current
        ? buildDegradedBuiltInStyleCatalogResolutionFromPrevious(
            runtimeBuiltInStyleCatalogCache.current.resolution
          )
        : buildSeedBuiltInStyleCatalogResolution(degraded),
  });
};

export const saveBuiltInStyleCatalog = async ({
  styleDefinitions,
  expectedUpdatedAt,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  styleDefinitions: readonly BuiltInStyleDefinition[];
  expectedUpdatedAt?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveBuiltInStyleCatalog> =>
  saveControlPlaneCatalog({
    definitions: styleDefinitions,
    normalizeDefinitions: normalizeBuiltInStyleDefinitions,
    expectedUpdatedAt,
    fetchActiveCatalog: () => fetchActiveBuiltInStyleCatalog({ supabaseAdmin }),
    getActiveUpdatedAt: (activeCatalog) => activeCatalog.updatedAt,
    createVersionMismatchError: () => new BuiltInStyleCatalogVersionMismatchError(),
    persistDefinitions: async (normalizedDefinitions) => {
      const { error } = await supabaseAdmin.from("ai_studio_builtin_style_runtime").upsert(
        {
          singleton: true,
          style_definitions: normalizedDefinitions,
          updated_by_user_id: actorUserId ?? null,
          updated_by_email: actorEmail ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "singleton" }
      );

      if (error) {
        throw new Error(error.message || "Failed to save built-in Styles catalog.");
      }
    },
    clearCache: clearBuiltInStyleControlPlaneCacheForTests,
    reReadActiveCatalog: () => fetchActiveBuiltInStyleCatalog({ supabaseAdmin }),
    missingActiveCatalogMessage: "Built-in Styles catalog save did not produce a runtime row.",
  });

const buildControlPlaneBuiltInStyleCatalogResolution = (
  activeCatalog: ActiveBuiltInStyleCatalog
): RuntimeBuiltInStyleCatalogResolution => ({
  styleDefinitions: activeCatalog.styleDefinitions,
  updatedAt: activeCatalog.updatedAt,
  updatedByEmail: activeCatalog.updatedByEmail,
  source: "control_plane",
  degraded: false,
});

const buildSeedBuiltInStyleCatalogResolution = (
  degraded: boolean
): RuntimeBuiltInStyleCatalogResolution => ({
  styleDefinitions: getSeededBuiltInStyleDefinitions(),
  updatedAt: null,
  updatedByEmail: null,
  source: "seed",
  degraded,
});

const buildDegradedBuiltInStyleCatalogResolutionFromPrevious = (
  previousResolution: RuntimeBuiltInStyleCatalogResolution
): RuntimeBuiltInStyleCatalogResolution => ({
  ...previousResolution,
  degraded: true,
});

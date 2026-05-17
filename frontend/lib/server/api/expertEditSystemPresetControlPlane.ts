/**
 * Server-side helper seam for the global Expert Edit system preset catalog.
 * Admin writes here and AI Studio reads here so system presets are shared across all users.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeExpertEditSystemPresetDefinitions,
  SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS,
  type ExpertEditSystemPresetDefinition,
} from "../../model-runtime/expertEditPresetDomain";
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

export type ActiveExpertEditSystemPresetCatalog = {
  presetDefinitions: ExpertEditSystemPresetDefinition[];
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
};

export type RuntimeExpertEditSystemPresetCatalogResolution = {
  presetDefinitions: ExpertEditSystemPresetDefinition[];
  updatedAt: string | null;
  updatedByEmail: string | null;
  source: "control_plane" | "seed";
  degraded: boolean;
};

export type RuntimeExpertEditSystemPresetCatalogAdminResolution =
  RuntimeExpertEditSystemPresetCatalogResolution;

export class ExpertEditSystemPresetCatalogVersionMismatchError extends Error {
  constructor() {
    super("Expert Edit system preset catalog changed since it was loaded.");
    this.name = "ExpertEditSystemPresetCatalogVersionMismatchError";
  }
}

const runtimeExpertEditSystemPresetCatalogCache =
  createControlPlaneCatalogCacheState<RuntimeExpertEditSystemPresetCatalogResolution>();

export const clearExpertEditSystemPresetControlPlaneCacheForTests = (): void => {
  clearControlPlaneCatalogCacheState(runtimeExpertEditSystemPresetCatalogCache);
};

export const getSeededExpertEditSystemPresetDefinitions =
  (): ExpertEditSystemPresetDefinition[] => [...SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS];

export const fetchActiveExpertEditSystemPresetCatalog = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: ControlPlaneCatalogSupabaseParams = {}): Promise<ActiveExpertEditSystemPresetCatalog | null> => {
  const { data, error } = await supabaseAdmin
    .from("expert_edit_system_preset_runtime")
    .select("preset_definitions, updated_at, updated_by_user_id, updated_by_email")
    .eq("singleton", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load Expert Edit system preset catalog.");
  }
  if (!data) return null;

  return {
    presetDefinitions: normalizeExpertEditSystemPresetDefinitions(data.preset_definitions),
    updatedAt: asNullableString(data.updated_at),
    updatedByUserId: asNullableString(data.updated_by_user_id),
    updatedByEmail: asNullableString(data.updated_by_email),
  };
};

export const resolveRuntimeExpertEditSystemPresetCatalog = async ({
  controlPlaneCacheTtlMs = process.env.EXPERT_EDIT_SYSTEM_PRESET_CONTROL_PLANE_CACHE_TTL_MS,
  bypassCache = false,
}: {
  controlPlaneCacheTtlMs?: string | null;
  bypassCache?: boolean;
} = {}): Promise<RuntimeExpertEditSystemPresetCatalogResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedExpertEditSystemPresetCatalogResolution(false);
  }

  return resolveCachedControlPlaneCatalog({
    cacheState: runtimeExpertEditSystemPresetCatalogCache,
    bypassCache,
    controlPlaneCacheTtlMs,
    fetchActiveCatalog: fetchActiveExpertEditSystemPresetCatalog,
    buildControlPlaneResolution: buildControlPlaneExpertEditSystemPresetCatalogResolution,
    buildSeedResolution: buildSeedExpertEditSystemPresetCatalogResolution,
  });
};

export const resolveExpertEditSystemPresetCatalogForAdmin = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: ControlPlaneCatalogSupabaseParams = {}): Promise<RuntimeExpertEditSystemPresetCatalogAdminResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedExpertEditSystemPresetCatalogResolution(false);
  }

  return resolveControlPlaneCatalogForAdmin({
    fetchActiveCatalog: () => fetchActiveExpertEditSystemPresetCatalog({ supabaseAdmin }),
    buildControlPlaneResolution: buildControlPlaneExpertEditSystemPresetCatalogResolution,
    buildSeedResolution: buildSeedExpertEditSystemPresetCatalogResolution,
  });
};

export const saveExpertEditSystemPresetCatalog = async ({
  presetDefinitions,
  expectedUpdatedAt,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  presetDefinitions: readonly ExpertEditSystemPresetDefinition[];
  expectedUpdatedAt?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveExpertEditSystemPresetCatalog> =>
  saveControlPlaneCatalog({
    definitions: presetDefinitions,
    normalizeDefinitions: normalizeExpertEditSystemPresetDefinitions,
    expectedUpdatedAt,
    fetchActiveCatalog: () => fetchActiveExpertEditSystemPresetCatalog({ supabaseAdmin }),
    getActiveUpdatedAt: (activeCatalog) => activeCatalog.updatedAt,
    createVersionMismatchError: () => new ExpertEditSystemPresetCatalogVersionMismatchError(),
    persistDefinitions: async (normalizedDefinitions) => {
      const { error } = await supabaseAdmin.from("expert_edit_system_preset_runtime").upsert(
        {
          singleton: true,
          preset_definitions: normalizedDefinitions,
          updated_by_user_id: actorUserId ?? null,
          updated_by_email: actorEmail ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "singleton" }
      );

      if (error) {
        throw new Error(error.message || "Failed to save Expert Edit system preset catalog.");
      }
    },
    clearCache: clearExpertEditSystemPresetControlPlaneCacheForTests,
    reReadActiveCatalog: () => fetchActiveExpertEditSystemPresetCatalog({ supabaseAdmin }),
    missingActiveCatalogMessage: "Expert Edit system preset save did not produce a runtime row.",
  });

const buildControlPlaneExpertEditSystemPresetCatalogResolution = (
  activeCatalog: ActiveExpertEditSystemPresetCatalog
): RuntimeExpertEditSystemPresetCatalogResolution => ({
  presetDefinitions: activeCatalog.presetDefinitions,
  updatedAt: activeCatalog.updatedAt,
  updatedByEmail: activeCatalog.updatedByEmail,
  source: "control_plane",
  degraded: false,
});

const buildSeedExpertEditSystemPresetCatalogResolution = (
  degraded: boolean
): RuntimeExpertEditSystemPresetCatalogResolution => ({
  presetDefinitions: getSeededExpertEditSystemPresetDefinitions(),
  updatedAt: null,
  updatedByEmail: null,
  source: "seed",
  degraded,
});

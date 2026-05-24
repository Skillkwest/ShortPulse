/**
 * Server-side helper seam for global Create Pulse built-in catalog access.
 * The runtime and admin surface both read through this control plane so built-ins do not depend on browser state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
  normalizeCreatePulseBuiltInPresetDefinitions,
  type CreatePulseBuiltInPresetDefinition,
} from "../../model-runtime/createPulseBuiltIns";
import {
  asNullableString,
  clearControlPlaneCatalogCacheState,
  createControlPlaneCatalogCacheState,
  hasSupabaseAdminConfig,
  resolveControlPlaneCacheTtlMs,
  resolveCachedControlPlaneCatalog,
  resolveControlPlaneCatalogForAdmin,
  saveControlPlaneCatalog,
  type ControlPlaneCatalogSupabaseParams,
} from "./controlPlaneCatalogCore";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type ActiveCreatePulseBuiltInCatalog = {
  builtInDefinitions: CreatePulseBuiltInPresetDefinition[];
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
};

export type RuntimeCreatePulseBuiltInCatalogResolution = {
  builtInDefinitions: CreatePulseBuiltInPresetDefinition[];
  updatedAt: string | null;
  updatedByEmail: string | null;
  source: "control_plane" | "seed";
  degraded: boolean;
};

export type RuntimeCreatePulseBuiltInCatalogAdminResolution =
  RuntimeCreatePulseBuiltInCatalogResolution;

export class CreatePulseBuiltInCatalogVersionMismatchError extends Error {
  constructor() {
    super("Create Pulse built-in catalog changed since it was loaded.");
    this.name = "CreatePulseBuiltInCatalogVersionMismatchError";
  }
}

const runtimeBuiltInCatalogCache =
  createControlPlaneCatalogCacheState<RuntimeCreatePulseBuiltInCatalogResolution>();

export const clearCreatePulseBuiltInControlPlaneCacheForTests = (): void => {
  clearControlPlaneCatalogCacheState(runtimeBuiltInCatalogCache);
};

const rememberCreatePulseBuiltInCatalogResolution = (
  resolution: RuntimeCreatePulseBuiltInCatalogResolution,
  controlPlaneCacheTtlMs = process.env.CREATE_PULSE_BUILTIN_CONTROL_PLANE_CACHE_TTL_MS
): void => {
  runtimeBuiltInCatalogCache.current = {
    expiresAtMs: Date.now() + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
    resolution,
  };
};

export const getSeededCreatePulseBuiltInDefinitions = (): CreatePulseBuiltInPresetDefinition[] => [
  ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
];

export const fetchActiveCreatePulseBuiltInCatalog = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: ControlPlaneCatalogSupabaseParams = {}): Promise<ActiveCreatePulseBuiltInCatalog | null> => {
  const { data, error } = await supabaseAdmin
    .from("create_pulse_builtin_runtime")
    .select("pulse_definitions, updated_at, updated_by_user_id, updated_by_email")
    .eq("singleton", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load Create Pulse built-in catalog.");
  }
  if (!data) return null;

  return {
    builtInDefinitions: normalizeCreatePulseBuiltInPresetDefinitions(data.pulse_definitions),
    updatedAt: asNullableString(data.updated_at),
    updatedByUserId: asNullableString(data.updated_by_user_id),
    updatedByEmail: asNullableString(data.updated_by_email),
  };
};

export const resolveRuntimeCreatePulseBuiltInCatalog = async ({
  controlPlaneCacheTtlMs = process.env.CREATE_PULSE_BUILTIN_CONTROL_PLANE_CACHE_TTL_MS,
  bypassCache = false,
}: {
  controlPlaneCacheTtlMs?: string | null;
  bypassCache?: boolean;
} = {}): Promise<RuntimeCreatePulseBuiltInCatalogResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedCreatePulseBuiltInCatalogResolution(false);
  }

  return resolveCachedControlPlaneCatalog({
    cacheState: runtimeBuiltInCatalogCache,
    bypassCache,
    controlPlaneCacheTtlMs,
    fetchActiveCatalog: fetchActiveCreatePulseBuiltInCatalog,
    buildControlPlaneResolution: buildControlPlaneCreatePulseBuiltInCatalogResolution,
    buildSeedResolution: buildSeedCreatePulseBuiltInCatalogResolution,
    buildDegradedResolutionFromPrevious:
      buildDegradedCreatePulseBuiltInCatalogResolutionFromPrevious,
  });
};

export const resolveCreatePulseBuiltInCatalogForAdmin = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: ControlPlaneCatalogSupabaseParams = {}): Promise<RuntimeCreatePulseBuiltInCatalogAdminResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedCreatePulseBuiltInCatalogResolution(false);
  }

  const resolvedCatalog = await resolveControlPlaneCatalogForAdmin({
    fetchActiveCatalog: () => fetchActiveCreatePulseBuiltInCatalog({ supabaseAdmin }),
    buildControlPlaneResolution: buildControlPlaneCreatePulseBuiltInCatalogResolution,
    buildSeedResolution: (degraded) =>
      runtimeBuiltInCatalogCache.current
        ? buildDegradedCreatePulseBuiltInCatalogResolutionFromPrevious(
            runtimeBuiltInCatalogCache.current.resolution
          )
        : buildSeedCreatePulseBuiltInCatalogResolution(degraded),
  });
  rememberCreatePulseBuiltInCatalogResolution(resolvedCatalog);
  return resolvedCatalog;
};

export const saveCreatePulseBuiltInCatalog = async ({
  builtInDefinitions,
  expectedUpdatedAt,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  builtInDefinitions: readonly CreatePulseBuiltInPresetDefinition[];
  expectedUpdatedAt?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveCreatePulseBuiltInCatalog> => {
  const savedCatalog = await saveControlPlaneCatalog({
    definitions: builtInDefinitions,
    normalizeDefinitions: normalizeCreatePulseBuiltInPresetDefinitions,
    expectedUpdatedAt,
    fetchActiveCatalog: () => fetchActiveCreatePulseBuiltInCatalog({ supabaseAdmin }),
    getActiveUpdatedAt: (activeCatalog) => activeCatalog.updatedAt,
    createVersionMismatchError: () => new CreatePulseBuiltInCatalogVersionMismatchError(),
    persistDefinitions: async (normalizedDefinitions) => {
      const { error } = await supabaseAdmin.from("create_pulse_builtin_runtime").upsert(
        {
          singleton: true,
          pulse_definitions: normalizedDefinitions,
          updated_by_user_id: actorUserId ?? null,
          updated_by_email: actorEmail ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "singleton" }
      );

      if (error) {
        throw new Error(error.message || "Failed to save Create Pulse built-in catalog.");
      }
    },
    clearCache: clearCreatePulseBuiltInControlPlaneCacheForTests,
    reReadActiveCatalog: () => fetchActiveCreatePulseBuiltInCatalog({ supabaseAdmin }),
    missingActiveCatalogMessage:
      "Create Pulse built-in catalog save did not produce a runtime row.",
  });
  rememberCreatePulseBuiltInCatalogResolution(
    buildControlPlaneCreatePulseBuiltInCatalogResolution(savedCatalog)
  );
  return savedCatalog;
};

const buildControlPlaneCreatePulseBuiltInCatalogResolution = (
  activeCatalog: ActiveCreatePulseBuiltInCatalog
): RuntimeCreatePulseBuiltInCatalogResolution => ({
  builtInDefinitions: activeCatalog.builtInDefinitions,
  updatedAt: activeCatalog.updatedAt,
  updatedByEmail: activeCatalog.updatedByEmail,
  source: "control_plane",
  degraded: false,
});

const buildSeedCreatePulseBuiltInCatalogResolution = (
  degraded: boolean
): RuntimeCreatePulseBuiltInCatalogResolution => ({
  builtInDefinitions: getSeededCreatePulseBuiltInDefinitions(),
  updatedAt: null,
  updatedByEmail: null,
  source: "seed",
  degraded,
});

const buildDegradedCreatePulseBuiltInCatalogResolutionFromPrevious = (
  previousResolution: RuntimeCreatePulseBuiltInCatalogResolution
): RuntimeCreatePulseBuiltInCatalogResolution => ({
  ...previousResolution,
  degraded: true,
});

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
};

const DEFAULT_CONTROL_PLANE_CACHE_TTL_MS = 5000;
const MIN_CONTROL_PLANE_CACHE_TTL_MS = 1000;
const MAX_CONTROL_PLANE_CACHE_TTL_MS = 60000;

let runtimeBuiltInCatalogCache: {
  expiresAtMs: number;
  value: ActiveCreatePulseBuiltInCatalog | null;
} | null = null;

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveControlPlaneCacheTtlMs = (rawValue?: string | null): number => {
  const parsed = Number(rawValue ?? String(DEFAULT_CONTROL_PLANE_CACHE_TTL_MS));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTROL_PLANE_CACHE_TTL_MS;
  return Math.max(
    MIN_CONTROL_PLANE_CACHE_TTL_MS,
    Math.min(MAX_CONTROL_PLANE_CACHE_TTL_MS, Math.floor(parsed))
  );
};

const hasSupabaseAdminConfig = (): boolean =>
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0 &&
  typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0;

export const clearCreatePulseBuiltInControlPlaneCacheForTests = (): void => {
  runtimeBuiltInCatalogCache = null;
};

export const getSeededCreatePulseBuiltInDefinitions = (): CreatePulseBuiltInPresetDefinition[] => [
  ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
];

export const fetchActiveCreatePulseBuiltInCatalog = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: {
  supabaseAdmin?: SupabaseClient;
} = {}): Promise<ActiveCreatePulseBuiltInCatalog | null> => {
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
    return {
      builtInDefinitions: getSeededCreatePulseBuiltInDefinitions(),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    };
  }

  const nowMs = Date.now();
  if (
    !bypassCache &&
    runtimeBuiltInCatalogCache &&
    runtimeBuiltInCatalogCache.expiresAtMs > nowMs
  ) {
    const cached = runtimeBuiltInCatalogCache.value;
    if (cached) {
      return {
        builtInDefinitions: cached.builtInDefinitions,
        updatedAt: cached.updatedAt,
        updatedByEmail: cached.updatedByEmail,
        source: "control_plane",
      };
    }
    return {
      builtInDefinitions: getSeededCreatePulseBuiltInDefinitions(),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    };
  }

  try {
    const activeCatalog = await fetchActiveCreatePulseBuiltInCatalog();
    runtimeBuiltInCatalogCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: activeCatalog,
    };
    if (activeCatalog) {
      return {
        builtInDefinitions: activeCatalog.builtInDefinitions,
        updatedAt: activeCatalog.updatedAt,
        updatedByEmail: activeCatalog.updatedByEmail,
        source: "control_plane",
      };
    }
  } catch {
    runtimeBuiltInCatalogCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: null,
    };
  }

  return {
    builtInDefinitions: getSeededCreatePulseBuiltInDefinitions(),
    updatedAt: null,
    updatedByEmail: null,
    source: "seed",
  };
};

export const saveCreatePulseBuiltInCatalog = async ({
  builtInDefinitions,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  builtInDefinitions: readonly CreatePulseBuiltInPresetDefinition[];
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveCreatePulseBuiltInCatalog> => {
  const normalizedDefinitions = normalizeCreatePulseBuiltInPresetDefinitions(builtInDefinitions);
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

  clearCreatePulseBuiltInControlPlaneCacheForTests();
  const activeCatalog = await fetchActiveCreatePulseBuiltInCatalog({ supabaseAdmin });
  if (!activeCatalog) {
    throw new Error("Create Pulse built-in catalog save did not produce a runtime row.");
  }
  return activeCatalog;
};

/**
 * Server-side helper seam for the global Expert Edit system preset catalog.
 * Admin writes here and AI Studio reads here so system presets are shared across all users.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeExpertEditSystemPresetDefinitions,
  SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS,
  type ExpertEditSystemPresetDefinition,
} from "../../../features/ai-studio/components/edit/expertEditPresets";
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
};

export type RuntimeExpertEditSystemPresetCatalogAdminResolution =
  RuntimeExpertEditSystemPresetCatalogResolution & {
    degraded: boolean;
  };

export class ExpertEditSystemPresetCatalogVersionMismatchError extends Error {
  constructor() {
    super("Expert Edit system preset catalog changed since it was loaded.");
    this.name = "ExpertEditSystemPresetCatalogVersionMismatchError";
  }
}

const DEFAULT_CONTROL_PLANE_CACHE_TTL_MS = 5000;
const MIN_CONTROL_PLANE_CACHE_TTL_MS = 1000;
const MAX_CONTROL_PLANE_CACHE_TTL_MS = 60000;

let runtimeExpertEditSystemPresetCatalogCache: {
  expiresAtMs: number;
  value: ActiveExpertEditSystemPresetCatalog | null;
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

export const clearExpertEditSystemPresetControlPlaneCacheForTests = (): void => {
  runtimeExpertEditSystemPresetCatalogCache = null;
};

export const getSeededExpertEditSystemPresetDefinitions =
  (): ExpertEditSystemPresetDefinition[] => [...SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS];

export const fetchActiveExpertEditSystemPresetCatalog = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: {
  supabaseAdmin?: SupabaseClient;
} = {}): Promise<ActiveExpertEditSystemPresetCatalog | null> => {
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
    return {
      presetDefinitions: getSeededExpertEditSystemPresetDefinitions(),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    };
  }

  const nowMs = Date.now();
  if (
    !bypassCache &&
    runtimeExpertEditSystemPresetCatalogCache &&
    runtimeExpertEditSystemPresetCatalogCache.expiresAtMs > nowMs
  ) {
    const cached = runtimeExpertEditSystemPresetCatalogCache.value;
    if (cached) {
      return {
        presetDefinitions: cached.presetDefinitions,
        updatedAt: cached.updatedAt,
        updatedByEmail: cached.updatedByEmail,
        source: "control_plane",
      };
    }
    return {
      presetDefinitions: getSeededExpertEditSystemPresetDefinitions(),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    };
  }

  try {
    const activeCatalog = await fetchActiveExpertEditSystemPresetCatalog();
    runtimeExpertEditSystemPresetCatalogCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: activeCatalog,
    };
    if (activeCatalog) {
      return {
        presetDefinitions: activeCatalog.presetDefinitions,
        updatedAt: activeCatalog.updatedAt,
        updatedByEmail: activeCatalog.updatedByEmail,
        source: "control_plane",
      };
    }
  } catch {
    runtimeExpertEditSystemPresetCatalogCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: null,
    };
  }

  return {
    presetDefinitions: getSeededExpertEditSystemPresetDefinitions(),
    updatedAt: null,
    updatedByEmail: null,
    source: "seed",
  };
};

export const resolveExpertEditSystemPresetCatalogForAdmin = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: {
  supabaseAdmin?: SupabaseClient;
} = {}): Promise<RuntimeExpertEditSystemPresetCatalogAdminResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return {
      presetDefinitions: getSeededExpertEditSystemPresetDefinitions(),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
      degraded: false,
    };
  }

  try {
    const activeCatalog = await fetchActiveExpertEditSystemPresetCatalog({ supabaseAdmin });
    if (activeCatalog) {
      return {
        presetDefinitions: activeCatalog.presetDefinitions,
        updatedAt: activeCatalog.updatedAt,
        updatedByEmail: activeCatalog.updatedByEmail,
        source: "control_plane",
        degraded: false,
      };
    }
    return {
      presetDefinitions: getSeededExpertEditSystemPresetDefinitions(),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
      degraded: false,
    };
  } catch {
    return {
      presetDefinitions: getSeededExpertEditSystemPresetDefinitions(),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
      degraded: true,
    };
  }
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
}): Promise<ActiveExpertEditSystemPresetCatalog> => {
  const normalizedDefinitions = normalizeExpertEditSystemPresetDefinitions(presetDefinitions);
  if (expectedUpdatedAt !== undefined) {
    const activeCatalog = await fetchActiveExpertEditSystemPresetCatalog({ supabaseAdmin });
    const normalizedExpectedUpdatedAt = asNullableString(expectedUpdatedAt);
    const activeUpdatedAt = activeCatalog?.updatedAt ?? null;
    if (activeUpdatedAt !== normalizedExpectedUpdatedAt) {
      throw new ExpertEditSystemPresetCatalogVersionMismatchError();
    }
  }
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

  clearExpertEditSystemPresetControlPlaneCacheForTests();
  const activeCatalog = await fetchActiveExpertEditSystemPresetCatalog({ supabaseAdmin });
  if (!activeCatalog) {
    throw new Error("Expert Edit system preset save did not produce a runtime row.");
  }
  return activeCatalog;
};

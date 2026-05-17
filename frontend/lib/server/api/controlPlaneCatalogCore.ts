import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CONTROL_PLANE_CACHE_TTL_MS = 5000;
const MIN_CONTROL_PLANE_CACHE_TTL_MS = 1000;
const MAX_CONTROL_PLANE_CACHE_TTL_MS = 60000;

export type ControlPlaneCatalogCacheState<TResolution> = {
  current: {
    expiresAtMs: number;
    resolution: TResolution;
  } | null;
};

export const createControlPlaneCatalogCacheState = <
  TResolution,
>(): ControlPlaneCatalogCacheState<TResolution> => ({
  current: null,
});

export const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const resolveControlPlaneCacheTtlMs = (rawValue?: string | null): number => {
  const parsed = Number(rawValue ?? String(DEFAULT_CONTROL_PLANE_CACHE_TTL_MS));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTROL_PLANE_CACHE_TTL_MS;
  return Math.max(
    MIN_CONTROL_PLANE_CACHE_TTL_MS,
    Math.min(MAX_CONTROL_PLANE_CACHE_TTL_MS, Math.floor(parsed))
  );
};

export const hasSupabaseAdminConfig = (): boolean =>
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0 &&
  typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0;

export const clearControlPlaneCatalogCacheState = <TResolution>(
  cacheState: ControlPlaneCatalogCacheState<TResolution>
): void => {
  cacheState.current = null;
};

export const resolveCachedControlPlaneCatalog = async <TActiveCatalog, TResolution>({
  cacheState,
  bypassCache = false,
  controlPlaneCacheTtlMs,
  fetchActiveCatalog,
  buildControlPlaneResolution,
  buildSeedResolution,
}: {
  cacheState: ControlPlaneCatalogCacheState<TResolution>;
  bypassCache?: boolean;
  controlPlaneCacheTtlMs?: string | null;
  fetchActiveCatalog: () => Promise<TActiveCatalog | null>;
  buildControlPlaneResolution: (activeCatalog: TActiveCatalog) => TResolution;
  buildSeedResolution: (degraded: boolean) => TResolution;
}): Promise<TResolution> => {
  const nowMs = Date.now();
  if (!bypassCache && cacheState.current && cacheState.current.expiresAtMs > nowMs) {
    return cacheState.current.resolution;
  }

  try {
    const activeCatalog = await fetchActiveCatalog();
    const resolution = activeCatalog
      ? buildControlPlaneResolution(activeCatalog)
      : buildSeedResolution(false);
    cacheState.current = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      resolution,
    };
    return resolution;
  } catch {
    const resolution = buildSeedResolution(true);
    cacheState.current = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      resolution,
    };
    return resolution;
  }
};

export const resolveControlPlaneCatalogForAdmin = async <TActiveCatalog, TResolution>({
  fetchActiveCatalog,
  buildControlPlaneResolution,
  buildSeedResolution,
}: {
  fetchActiveCatalog: () => Promise<TActiveCatalog | null>;
  buildControlPlaneResolution: (activeCatalog: TActiveCatalog) => TResolution;
  buildSeedResolution: (degraded: boolean) => TResolution;
}): Promise<TResolution> => {
  try {
    const activeCatalog = await fetchActiveCatalog();
    return activeCatalog ? buildControlPlaneResolution(activeCatalog) : buildSeedResolution(false);
  } catch {
    return buildSeedResolution(true);
  }
};

export const saveControlPlaneCatalog = async <TDefinitions, TActiveCatalog>({
  definitions,
  normalizeDefinitions,
  expectedUpdatedAt,
  fetchActiveCatalog,
  getActiveUpdatedAt,
  createVersionMismatchError,
  persistDefinitions,
  clearCache,
  reReadActiveCatalog,
  missingActiveCatalogMessage,
}: {
  definitions: readonly TDefinitions[];
  normalizeDefinitions: (definitions: readonly TDefinitions[]) => TDefinitions[];
  expectedUpdatedAt?: string | null;
  fetchActiveCatalog: () => Promise<TActiveCatalog | null>;
  getActiveUpdatedAt: (activeCatalog: TActiveCatalog) => string | null;
  createVersionMismatchError: () => Error;
  persistDefinitions: (normalizedDefinitions: TDefinitions[]) => Promise<void>;
  clearCache: () => void;
  reReadActiveCatalog: () => Promise<TActiveCatalog | null>;
  missingActiveCatalogMessage: string;
}): Promise<TActiveCatalog> => {
  const normalizedDefinitions = normalizeDefinitions(definitions);
  if (expectedUpdatedAt !== undefined) {
    const activeCatalog = await fetchActiveCatalog();
    const normalizedExpectedUpdatedAt = asNullableString(expectedUpdatedAt);
    const activeUpdatedAt = activeCatalog ? getActiveUpdatedAt(activeCatalog) : null;
    if (activeUpdatedAt !== normalizedExpectedUpdatedAt) {
      throw createVersionMismatchError();
    }
  }

  await persistDefinitions(normalizedDefinitions);
  clearCache();

  const activeCatalog = await reReadActiveCatalog();
  if (!activeCatalog) {
    throw new Error(missingActiveCatalogMessage);
  }
  return activeCatalog;
};

export type ControlPlaneCatalogSupabaseParams = {
  supabaseAdmin?: SupabaseClient;
};

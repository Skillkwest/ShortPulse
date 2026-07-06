import { useCallback, useEffect, useState } from "react";

export type ControlPlaneCatalogSource = "control_plane" | "seed";

type ControlPlaneCatalogLoadResult<T> = {
  value: T;
  source: ControlPlaneCatalogSource;
  degraded: boolean;
};

type UseControlPlaneCatalogOptions<T> = {
  enabled?: boolean;
  getSeededValue: () => T;
  loadCatalog: () => Promise<ControlPlaneCatalogLoadResult<T>>;
  fallbackErrorMessage: string;
};

export type UseControlPlaneCatalogResult<T> = {
  value: T;
  loading: boolean;
  error: string | null;
  source: ControlPlaneCatalogSource | null;
  degraded: boolean;
  isAuthoritative: boolean;
  refresh: () => Promise<ControlPlaneCatalogLoadResult<T> | null>;
};

type CatalogLoader = () => Promise<ControlPlaneCatalogLoadResult<unknown>>;

const controlPlaneCatalogInFlightLoads = new WeakMap<
  CatalogLoader,
  Promise<ControlPlaneCatalogLoadResult<unknown>>
>();

const loadSharedControlPlaneCatalog = async <T>(
  loadCatalog: () => Promise<ControlPlaneCatalogLoadResult<T>>
): Promise<ControlPlaneCatalogLoadResult<T>> => {
  const existing = controlPlaneCatalogInFlightLoads.get(loadCatalog);
  if (existing) {
    return (await existing) as ControlPlaneCatalogLoadResult<T>;
  }

  const request = loadCatalog() as Promise<ControlPlaneCatalogLoadResult<unknown>>;
  controlPlaneCatalogInFlightLoads.set(loadCatalog, request);
  try {
    return (await request) as ControlPlaneCatalogLoadResult<T>;
  } finally {
    if (controlPlaneCatalogInFlightLoads.get(loadCatalog) === request) {
      controlPlaneCatalogInFlightLoads.delete(loadCatalog);
    }
  }
};

export const useControlPlaneCatalog = <T>({
  enabled = true,
  getSeededValue,
  loadCatalog,
  fallbackErrorMessage,
}: UseControlPlaneCatalogOptions<T>): UseControlPlaneCatalogResult<T> => {
  const [value, setValue] = useState<T>(() => getSeededValue());
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ControlPlaneCatalogSource | null>("seed");
  const [degraded, setDegraded] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      const seededValue = getSeededValue();
      const seededCatalog: ControlPlaneCatalogLoadResult<T> = {
        value: seededValue,
        source: "seed",
        degraded: false,
      };
      setValue(seededValue);
      setLoading(false);
      setError(null);
      setSource("seed");
      setDegraded(false);
      return seededCatalog;
    }

    setLoading(true);
    try {
      const nextCatalog = await loadSharedControlPlaneCatalog(loadCatalog);
      setValue(nextCatalog.value);
      setSource(nextCatalog.source);
      setDegraded(nextCatalog.degraded);
      setError(null);
      return nextCatalog;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : fallbackErrorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, fallbackErrorMessage, getSeededValue, loadCatalog]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    value,
    loading,
    error,
    source,
    degraded,
    isAuthoritative: error == null && !degraded && source === "control_plane",
    refresh,
  };
};

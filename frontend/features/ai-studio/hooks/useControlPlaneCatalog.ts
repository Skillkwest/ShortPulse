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
  refresh: () => Promise<void>;
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
      setValue(getSeededValue());
      setLoading(false);
      setError(null);
      setSource("seed");
      setDegraded(false);
      return;
    }

    setLoading(true);
    try {
      const nextCatalog = await loadCatalog();
      setValue(nextCatalog.value);
      setSource(nextCatalog.source);
      setDegraded(nextCatalog.degraded);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : fallbackErrorMessage);
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
    isAuthoritative: !loading && error == null && !degraded && source === "control_plane",
    refresh,
  };
};

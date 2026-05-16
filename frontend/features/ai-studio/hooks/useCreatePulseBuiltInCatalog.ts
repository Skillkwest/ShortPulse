import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  normalizeCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulseBuiltInPresetDefinitions,
  type CreatePulseBuiltInPresetDefinition,
} from "../components/create/createPulsePresets";

type UseCreatePulseBuiltInCatalogOptions = {
  enabled?: boolean;
};

export type UseCreatePulseBuiltInCatalogResult = {
  builtInDefinitions: CreatePulseBuiltInPresetDefinition[];
  loading: boolean;
  error: string | null;
  source: "control_plane" | "seed" | null;
  degraded: boolean;
  isAuthoritative: boolean;
  refresh: () => Promise<void>;
};

const loadCreatePulseBuiltInCatalog = async (): Promise<{
  builtInDefinitions: CreatePulseBuiltInPresetDefinition[];
  source: "control_plane" | "seed";
  degraded: boolean;
}> => {
  const response = await fetchWithAuth("/api/ai/create-pulse-builtins", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Unable to load Pulse built-ins.");
  }
  const payload = (await response.json()) as {
    builtInDefinitions?: unknown;
    source?: unknown;
    degraded?: unknown;
  };
  return {
    builtInDefinitions: normalizeCreatePulseBuiltInPresetDefinitions(payload.builtInDefinitions),
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    degraded: payload.degraded === true,
  };
};

export const useCreatePulseBuiltInCatalog = ({
  enabled = true,
}: UseCreatePulseBuiltInCatalogOptions = {}): UseCreatePulseBuiltInCatalogResult => {
  const [builtInDefinitions, setBuiltInDefinitions] = useState<
    CreatePulseBuiltInPresetDefinition[]
  >(() => resolveCreatePulseBuiltInPresetDefinitions());
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"control_plane" | "seed" | null>("seed");
  const [degraded, setDegraded] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setBuiltInDefinitions(resolveCreatePulseBuiltInPresetDefinitions());
      setLoading(false);
      setError(null);
      setSource("seed");
      setDegraded(false);
      return;
    }

    setLoading(true);
    try {
      const nextCatalog = await loadCreatePulseBuiltInCatalog();
      setBuiltInDefinitions(nextCatalog.builtInDefinitions);
      setSource(nextCatalog.source);
      setDegraded(nextCatalog.degraded);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load Pulse built-ins.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    builtInDefinitions,
    loading,
    error,
    source,
    degraded,
    isAuthoritative: !loading && error == null && !degraded && source === "control_plane",
    refresh,
  };
};

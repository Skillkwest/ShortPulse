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
  refresh: () => Promise<void>;
};

const loadCreatePulseBuiltInCatalog = async (): Promise<CreatePulseBuiltInPresetDefinition[]> => {
  const response = await fetchWithAuth("/api/ai/create-pulse-builtins", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Unable to load Pulse built-ins.");
  }
  const payload = (await response.json()) as { builtInDefinitions?: unknown };
  return normalizeCreatePulseBuiltInPresetDefinitions(payload.builtInDefinitions);
};

export const useCreatePulseBuiltInCatalog = ({
  enabled = true,
}: UseCreatePulseBuiltInCatalogOptions = {}): UseCreatePulseBuiltInCatalogResult => {
  const [builtInDefinitions, setBuiltInDefinitions] = useState<
    CreatePulseBuiltInPresetDefinition[]
  >(() => resolveCreatePulseBuiltInPresetDefinitions());
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setBuiltInDefinitions(resolveCreatePulseBuiltInPresetDefinitions());
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const nextDefinitions = await loadCreatePulseBuiltInCatalog();
      setBuiltInDefinitions(nextDefinitions);
      setError(null);
    } catch (nextError) {
      setBuiltInDefinitions(resolveCreatePulseBuiltInPresetDefinitions());
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
    refresh,
  };
};

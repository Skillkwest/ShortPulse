import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  normalizeCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulseBuiltInPresetDefinitions,
  type CreatePulseBuiltInPresetDefinition,
} from "../components/create/createPulsePresets";
import { useControlPlaneCatalog } from "./useControlPlaneCatalog";

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
  value: CreatePulseBuiltInPresetDefinition[];
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
    value: normalizeCreatePulseBuiltInPresetDefinitions(payload.builtInDefinitions),
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    degraded: payload.degraded === true,
  };
};

export const useCreatePulseBuiltInCatalog = ({
  enabled = true,
}: UseCreatePulseBuiltInCatalogOptions = {}): UseCreatePulseBuiltInCatalogResult => {
  const catalog = useControlPlaneCatalog({
    enabled,
    getSeededValue: resolveCreatePulseBuiltInPresetDefinitions,
    loadCatalog: loadCreatePulseBuiltInCatalog,
    fallbackErrorMessage: "Unable to load Pulse built-ins.",
  });

  return {
    builtInDefinitions: catalog.value,
    loading: catalog.loading,
    error: catalog.error,
    source: catalog.source,
    degraded: catalog.degraded,
    isAuthoritative: catalog.isAuthoritative,
    refresh: catalog.refresh,
  };
};

import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  normalizeBuiltInStyleDefinitions,
  type BuiltInStyleDefinition,
} from "../../../lib/model-runtime/builtInStyles";
import { useControlPlaneCatalog } from "./useControlPlaneCatalog";

type UseBuiltInStyleCatalogOptions = {
  enabled?: boolean;
};

export type UseBuiltInStyleCatalogResult = {
  styleDefinitions: BuiltInStyleDefinition[];
  loading: boolean;
  error: string | null;
  source: "control_plane" | "seed" | null;
  degraded: boolean;
  isAuthoritative: boolean;
  refresh: () => Promise<void>;
};

const getEmptyBuiltInStyleDefinitions = (): BuiltInStyleDefinition[] => [];

const loadBuiltInStyleCatalog = async (): Promise<{
  value: BuiltInStyleDefinition[];
  source: "control_plane" | "seed";
  degraded: boolean;
}> => {
  const response = await fetchWithAuth("/api/ai/built-in-styles", {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Unable to load built-in Styles.");
  }
  const payload = (await response.json()) as {
    styleDefinitions?: unknown;
    source?: unknown;
    degraded?: unknown;
  };
  return {
    value: normalizeBuiltInStyleDefinitions(payload.styleDefinitions),
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    degraded: payload.degraded === true,
  };
};

export const useBuiltInStyleCatalog = ({
  enabled = true,
}: UseBuiltInStyleCatalogOptions = {}): UseBuiltInStyleCatalogResult => {
  const catalog = useControlPlaneCatalog({
    enabled,
    getSeededValue: getEmptyBuiltInStyleDefinitions,
    loadCatalog: loadBuiltInStyleCatalog,
    fallbackErrorMessage: "Unable to load built-in Styles.",
  });

  return {
    styleDefinitions: catalog.value,
    loading: catalog.loading,
    error: catalog.error,
    source: catalog.source,
    degraded: catalog.degraded,
    isAuthoritative: catalog.isAuthoritative,
    refresh: async () => {
      await catalog.refresh();
    },
  };
};

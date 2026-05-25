import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  normalizeExpertEditSystemPresetDefinitions,
  SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS,
  type ExpertEditSystemPresetDefinition,
} from "../components/edit/expertEditPresets";
import { useControlPlaneCatalog } from "./useControlPlaneCatalog";

type UseExpertEditSystemPresetCatalogOptions = {
  enabled?: boolean;
};

export type UseExpertEditSystemPresetCatalogResult = {
  systemPresetDefinitions: ExpertEditSystemPresetDefinition[];
  loading: boolean;
  error: string | null;
  source: "control_plane" | "seed" | null;
  degraded: boolean;
  isAuthoritative: boolean;
  refresh: () => Promise<void>;
};

const getSeededExpertEditSystemPresetDefinitions = (): ExpertEditSystemPresetDefinition[] => [
  ...SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS,
];

const loadExpertEditSystemPresetCatalog = async (): Promise<{
  value: ExpertEditSystemPresetDefinition[];
  source: "control_plane" | "seed";
  degraded: boolean;
}> => {
  const response = await fetchWithAuth("/api/ai/expert-edit-system-presets", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Unable to load global Edit system presets.");
  }
  const payload = (await response.json()) as {
    presetDefinitions?: unknown;
    source?: unknown;
    degraded?: unknown;
  };
  return {
    value: normalizeExpertEditSystemPresetDefinitions(payload.presetDefinitions),
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    degraded: payload.degraded === true,
  };
};

export const useExpertEditSystemPresetCatalog = ({
  enabled = true,
}: UseExpertEditSystemPresetCatalogOptions = {}): UseExpertEditSystemPresetCatalogResult => {
  const catalog = useControlPlaneCatalog({
    enabled,
    getSeededValue: getSeededExpertEditSystemPresetDefinitions,
    loadCatalog: loadExpertEditSystemPresetCatalog,
    fallbackErrorMessage: "Unable to load global Edit system presets.",
  });

  return {
    systemPresetDefinitions: catalog.value,
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

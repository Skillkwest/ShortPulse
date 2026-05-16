import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  normalizeExpertEditSystemPresetDefinitions,
  SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS,
  type ExpertEditSystemPresetDefinition,
} from "../components/edit/expertEditPresets";

type UseExpertEditSystemPresetCatalogOptions = {
  enabled?: boolean;
};

export type UseExpertEditSystemPresetCatalogResult = {
  systemPresetDefinitions: ExpertEditSystemPresetDefinition[];
  loading: boolean;
  error: string | null;
  source: "control_plane" | "seed" | null;
  isAuthoritative: boolean;
  refresh: () => Promise<void>;
};

const loadExpertEditSystemPresetCatalog = async (): Promise<{
  systemPresetDefinitions: ExpertEditSystemPresetDefinition[];
  source: "control_plane" | "seed";
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
  };
  return {
    systemPresetDefinitions: normalizeExpertEditSystemPresetDefinitions(payload.presetDefinitions),
    source: payload.source === "control_plane" ? "control_plane" : "seed",
  };
};

export const useExpertEditSystemPresetCatalog = ({
  enabled = true,
}: UseExpertEditSystemPresetCatalogOptions = {}): UseExpertEditSystemPresetCatalogResult => {
  const [systemPresetDefinitions, setSystemPresetDefinitions] = useState<
    ExpertEditSystemPresetDefinition[]
  >(() => [...SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"control_plane" | "seed" | null>("seed");

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSystemPresetDefinitions([...SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS]);
      setLoading(false);
      setError(null);
      setSource("seed");
      return;
    }

    setLoading(true);
    try {
      const nextCatalog = await loadExpertEditSystemPresetCatalog();
      setSystemPresetDefinitions(nextCatalog.systemPresetDefinitions);
      setSource(nextCatalog.source);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load global Edit system presets."
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    systemPresetDefinitions,
    loading,
    error,
    source,
    isAuthoritative: !loading && error == null && source === "control_plane",
    refresh,
  };
};

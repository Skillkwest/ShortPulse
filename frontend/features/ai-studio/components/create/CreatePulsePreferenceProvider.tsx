/**
 * Pulse preference provider for Pulse-only UI subtrees.
 * Keeps saved/custom Pulse catalog loading out of the AI Studio page root.
 */
import React, { createContext, useContext } from "react";
import { useCreatePulsePresetPanelPreference } from "../../hooks/useCreatePulsePresetPanelPreference";
import { useCreatePulseBuiltInCatalog } from "../../hooks/useCreatePulseBuiltInCatalog";
import type { CreatePulsePreferenceRuntimeValue } from "./createPulsePreferenceRuntime";

const CreatePulsePreferenceContext = createContext<CreatePulsePreferenceRuntimeValue | null>(null);

type CreatePulsePreferenceProviderProps = {
  children: React.ReactNode;
};

/**
 * Loads and provides per-user Pulse preferences for mounted Pulse surfaces.
 */
export const CreatePulsePreferenceProvider = ({ children }: CreatePulsePreferenceProviderProps) => {
  const builtInCatalog = useCreatePulseBuiltInCatalog();
  const preference = useCreatePulsePresetPanelPreference({
    builtInDefinitions: builtInCatalog.builtInDefinitions,
  });
  const refreshBuiltInDefinitions = React.useCallback(async () => {
    const nextCatalog = await builtInCatalog.refresh();
    if (!nextCatalog?.isAuthoritative) return null;
    return nextCatalog.builtInDefinitions;
  }, [builtInCatalog]);
  const value = React.useMemo<CreatePulsePreferenceRuntimeValue>(
    () => ({
      presetPanelIds: preference.presetPanelIds,
      savedPresets: preference.savedPresets,
      deletedBuiltInPresetIds: preference.deletedBuiltInPresetIds,
      builtInDefinitions: builtInCatalog.builtInDefinitions,
      builtInDefinitionsLoading: builtInCatalog.loading,
      builtInDefinitionsError: builtInCatalog.error,
      builtInDefinitionsSource: builtInCatalog.source,
      builtInDefinitionsDegraded: builtInCatalog.degraded,
      builtInDefinitionsAuthoritative: builtInCatalog.isAuthoritative,
      refreshBuiltInDefinitions,
      setPresetPanelIds: preference.setPresetPanelIds,
      setSavedPresets: preference.setSavedPresets,
      restoreDeletedBuiltInPresetIds: preference.restoreDeletedBuiltInPresetIds,
    }),
    [
      builtInCatalog.builtInDefinitions,
      builtInCatalog.degraded,
      builtInCatalog.error,
      builtInCatalog.isAuthoritative,
      builtInCatalog.loading,
      builtInCatalog.source,
      preference.presetPanelIds,
      preference.savedPresets,
      preference.deletedBuiltInPresetIds,
      preference.restoreDeletedBuiltInPresetIds,
      preference.setPresetPanelIds,
      preference.setSavedPresets,
      refreshBuiltInDefinitions,
    ]
  );

  return (
    <CreatePulsePreferenceContext.Provider value={value}>
      {children}
    </CreatePulsePreferenceContext.Provider>
  );
};

/**
 * Reads Pulse preferences from the nearest Pulse-owned provider.
 */
export const useCreatePulsePreferenceRuntime = () => {
  const value = useContext(CreatePulsePreferenceContext);
  if (!value) {
    throw new Error(
      "useCreatePulsePreferenceRuntime must be used inside CreatePulsePreferenceProvider."
    );
  }
  return value;
};

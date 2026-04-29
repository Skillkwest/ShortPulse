/**
 * Pulse preference provider for Pulse-only UI subtrees.
 * Keeps saved/custom Pulse catalog loading out of the AI Studio page root.
 */
import React, { createContext, useContext } from "react";
import { useCreatePulsePresetPanelPreference } from "../../hooks/useCreatePulsePresetPanelPreference";
import type { CreatePulsePresetId, CreatePulseSavedPreset } from "./createPulsePresets";

type CreatePulsePreferenceRuntimeValue = {
  presetPanelIds: readonly CreatePulsePresetId[];
  savedPresets: readonly CreatePulseSavedPreset[];
  setPresetPanelIds: (value: CreatePulsePresetId[]) => Promise<boolean>;
  setSavedPresets: (value: CreatePulseSavedPreset[]) => Promise<boolean>;
};

const CreatePulsePreferenceContext = createContext<CreatePulsePreferenceRuntimeValue | null>(null);

type CreatePulsePreferenceProviderProps = {
  children: React.ReactNode;
};

/**
 * Loads and provides per-user Pulse preferences for mounted Pulse surfaces.
 */
export const CreatePulsePreferenceProvider = ({ children }: CreatePulsePreferenceProviderProps) => {
  const preference = useCreatePulsePresetPanelPreference();
  const value = React.useMemo<CreatePulsePreferenceRuntimeValue>(
    () => ({
      presetPanelIds: preference.presetPanelIds,
      savedPresets: preference.savedPresets,
      setPresetPanelIds: preference.setPresetPanelIds,
      setSavedPresets: preference.setSavedPresets,
    }),
    [
      preference.presetPanelIds,
      preference.savedPresets,
      preference.setPresetPanelIds,
      preference.setSavedPresets,
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

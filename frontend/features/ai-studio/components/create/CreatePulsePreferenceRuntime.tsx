import { useEffect } from "react";
import { useCreatePulsePresetPanelPreference } from "../../hooks/useCreatePulsePresetPanelPreference";
import type { CreatePulsePresetId, CreatePulseSavedPreset } from "./createPulsePresets";

export type CreatePulsePreferenceRuntimeValue = {
  presetPanelIds: CreatePulsePresetId[];
  savedPresets: CreatePulseSavedPreset[];
  setPresetPanelIds: (presetIds: readonly CreatePulsePresetId[]) => Promise<boolean>;
  setSavedPresets: (presets: readonly CreatePulseSavedPreset[]) => Promise<boolean>;
};

type CreatePulsePreferenceRuntimeProps = {
  onPreferenceChange: (value: CreatePulsePreferenceRuntimeValue) => void;
  onPreferenceReset: () => void;
};

/**
 * Mounts custom Pulse preference loading only while Pulse mode is active.
 */
export const CreatePulsePreferenceRuntime = ({
  onPreferenceChange,
  onPreferenceReset,
}: CreatePulsePreferenceRuntimeProps) => {
  const preference = useCreatePulsePresetPanelPreference();

  useEffect(() => {
    onPreferenceChange({
      presetPanelIds: preference.presetPanelIds,
      savedPresets: preference.savedPresets,
      setPresetPanelIds: preference.setPresetPanelIds,
      setSavedPresets: preference.setSavedPresets,
    });
  }, [
    onPreferenceChange,
    preference.presetPanelIds,
    preference.savedPresets,
    preference.setPresetPanelIds,
    preference.setSavedPresets,
  ]);

  useEffect(() => onPreferenceReset, [onPreferenceReset]);

  return null;
};

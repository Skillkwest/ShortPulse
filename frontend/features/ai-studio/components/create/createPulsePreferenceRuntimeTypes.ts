import type { CreatePulsePresetId, CreatePulseSavedPreset } from "./createPulsePresets";

export type CreatePulsePreferenceRuntimeValue = {
  presetPanelIds: CreatePulsePresetId[];
  savedPresets: CreatePulseSavedPreset[];
  setPresetPanelIds: (presetIds: readonly CreatePulsePresetId[]) => Promise<boolean>;
  setSavedPresets: (presets: readonly CreatePulseSavedPreset[]) => Promise<boolean>;
};

export type CreatePulsePreferenceRuntimeProps = {
  onPreferenceChange: (value: CreatePulsePreferenceRuntimeValue) => void;
  onPreferenceReset: () => void;
};

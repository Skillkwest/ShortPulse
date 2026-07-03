import type {
  CreatePulseBuiltInPresetDefinition,
  CreatePulsePresetId,
  CreatePulseSavedPreset,
} from "./createPulsePresets";

export type CreatePulsePreferenceRuntimeValue = {
  presetPanelIds: readonly CreatePulsePresetId[];
  savedPresets: readonly CreatePulseSavedPreset[];
  deletedBuiltInPresetIds: readonly CreatePulsePresetId[];
  builtInDefinitions: readonly CreatePulseBuiltInPresetDefinition[];
  builtInDefinitionsLoading: boolean;
  builtInDefinitionsError: string | null;
  builtInDefinitionsSource: "control_plane" | "seed" | null;
  builtInDefinitionsDegraded: boolean;
  builtInDefinitionsAuthoritative: boolean;
  refreshBuiltInDefinitions: () => Promise<readonly CreatePulseBuiltInPresetDefinition[] | null>;
  setPresetPanelIds: (value: CreatePulsePresetId[]) => Promise<boolean>;
  setSavedPresets: (value: CreatePulseSavedPreset[]) => Promise<boolean>;
  restoreDeletedBuiltInPresetIds: () => Promise<boolean>;
};

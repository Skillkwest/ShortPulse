/**
 * Runtime state for the Create Pulse preset inline rail and More Presets surface.
 * Separates selected panel presets and saved custom pulses from the rendering component.
 */
import React from "react";
import {
  CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS,
  normalizeCreatePulsePanelPresetIds,
  resolveCreatePulsePresetCatalog,
  resolveCreatePulsePresetById,
  type CreatePulseBuiltInPresetDefinition,
  type CreatePulsePresetId,
  type CreatePulseResolvedPreset,
  normalizeCreatePulseSavedPresets,
  type CreatePulseSavedPreset,
} from "./createPulsePresets";

type UseCreatePulseGenerationPresetRuntimeParams = {
  controlledPresetIds?: readonly CreatePulsePresetId[] | null;
  onSelectedPresetIdsChange?:
    | ((value: CreatePulsePresetId[]) => Promise<boolean> | boolean | void)
    | null;
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null;
  controlledSavedPresets?: readonly CreatePulseSavedPreset[] | null;
  onSavedPresetsChange?:
    | ((value: CreatePulseSavedPreset[]) => Promise<boolean> | boolean | void)
    | null;
};

/**
 * Returns Create Pulse preset state consumed by the left rail and popup surface.
 */
export const useCreatePulseGenerationPresetRuntime = ({
  controlledPresetIds,
  onSelectedPresetIdsChange,
  builtInDefinitions,
  controlledSavedPresets,
  onSavedPresetsChange,
}: UseCreatePulseGenerationPresetRuntimeParams) => {
  const [isMorePresetsSurfaceOpen, setIsMorePresetsSurfaceOpen] = React.useState(false);
  const [internalSelectedPresetIds, setInternalSelectedPresetIds] = React.useState<
    CreatePulsePresetId[]
  >(() =>
    normalizeCreatePulsePanelPresetIds(
      CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS,
      [],
      builtInDefinitions
    )
  );
  const [internalSavedPresets, setInternalSavedPresets] = React.useState<CreatePulseSavedPreset[]>(
    []
  );

  const isSavedPresetsControlled = controlledSavedPresets != null && onSavedPresetsChange != null;
  const savedPresets = React.useMemo(
    () =>
      normalizeCreatePulseSavedPresets(
        isSavedPresetsControlled ? controlledSavedPresets : internalSavedPresets
      ),
    [controlledSavedPresets, internalSavedPresets, isSavedPresetsControlled]
  );
  const normalizedControlledPresetIds = React.useMemo(
    () =>
      controlledPresetIds == null
        ? null
        : normalizeCreatePulsePanelPresetIds(controlledPresetIds, savedPresets, builtInDefinitions),
    [builtInDefinitions, controlledPresetIds, savedPresets]
  );
  const controlledPresetChangeHandler = onSelectedPresetIdsChange ?? null;
  const isPresetPanelControlled =
    normalizedControlledPresetIds != null && controlledPresetChangeHandler != null;
  const selectedPresetIds = isPresetPanelControlled
    ? normalizedControlledPresetIds
    : internalSelectedPresetIds;

  React.useEffect(() => {
    if (isPresetPanelControlled) return;
    setInternalSelectedPresetIds((previous) =>
      normalizeCreatePulsePanelPresetIds(previous, savedPresets, builtInDefinitions)
    );
  }, [builtInDefinitions, isPresetPanelControlled, savedPresets]);

  const updateSelectedPresetIds = React.useCallback(
    async (updater: (previous: CreatePulsePresetId[]) => CreatePulsePresetId[]) => {
      if (isPresetPanelControlled) {
        const saved = await controlledPresetChangeHandler(
          normalizeCreatePulsePanelPresetIds(
            updater(normalizedControlledPresetIds),
            savedPresets,
            builtInDefinitions
          )
        );
        return saved !== false;
      }
      setInternalSelectedPresetIds((previous) =>
        normalizeCreatePulsePanelPresetIds(updater(previous), savedPresets, builtInDefinitions)
      );
      return true;
    },
    [
      controlledPresetChangeHandler,
      builtInDefinitions,
      isPresetPanelControlled,
      normalizedControlledPresetIds,
      savedPresets,
    ]
  );

  const updateSavedPresets = React.useCallback(
    async (updater: (previous: CreatePulseSavedPreset[]) => CreatePulseSavedPreset[]) => {
      if (isSavedPresetsControlled) {
        const saved = await onSavedPresetsChange(
          normalizeCreatePulseSavedPresets(updater(savedPresets))
        );
        return saved !== false;
      }
      setInternalSavedPresets((previous) => normalizeCreatePulseSavedPresets(updater(previous)));
      return true;
    },
    [isSavedPresetsControlled, onSavedPresetsChange, savedPresets]
  );

  const availablePresets = React.useMemo(() => {
    const selectedPresetIdSet = new Set(selectedPresetIds);
    return resolveCreatePulsePresetCatalog(savedPresets, builtInDefinitions).filter(
      (preset) => !selectedPresetIdSet.has(preset.presetId)
    );
  }, [builtInDefinitions, savedPresets, selectedPresetIds]);

  const selectedPanelPresets = React.useMemo(
    () =>
      selectedPresetIds.reduce<CreatePulseResolvedPreset[]>((accumulator, presetId) => {
        const preset = resolveCreatePulsePresetById(presetId, savedPresets, builtInDefinitions);
        if (preset) {
          accumulator.push(preset);
        }
        return accumulator;
      }, []),
    [builtInDefinitions, savedPresets, selectedPresetIds]
  );

  const toggleMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen((previous) => !previous);
  }, []);

  return {
    availablePresets,
    hasSelectedPresetIds: selectedPresetIds.length > 0,
    isMorePresetsSurfaceOpen,
    savedPresets,
    selectedPanelPresets,
    setIsMorePresetsSurfaceOpen,
    toggleMorePresetsSurface,
    updateSavedPresets,
    updateSelectedPresetIds,
  };
};

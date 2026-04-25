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
  type CreatePulsePresetId,
  type CreatePulseResolvedPreset,
  normalizeCreatePulseSavedPresets,
  type CreatePulseSavedPreset,
} from "./createPulsePresets";

type UseCreatePulseGenerationPresetRuntimeParams = {
  controlledPresetIds?: readonly CreatePulsePresetId[] | null;
  onSelectedPresetIdsChange?: ((value: CreatePulsePresetId[]) => void) | null;
  controlledSavedPresets?: readonly CreatePulseSavedPreset[] | null;
  onSavedPresetsChange?: ((value: CreatePulseSavedPreset[]) => void) | null;
};

/**
 * Returns Create Pulse preset state consumed by the left rail and popup surface.
 */
export const useCreatePulseGenerationPresetRuntime = ({
  controlledPresetIds,
  onSelectedPresetIdsChange,
  controlledSavedPresets,
  onSavedPresetsChange,
}: UseCreatePulseGenerationPresetRuntimeParams) => {
  const [isMorePresetsSurfaceOpen, setIsMorePresetsSurfaceOpen] = React.useState(false);
  const [internalSelectedPresetIds, setInternalSelectedPresetIds] = React.useState<
    CreatePulsePresetId[]
  >(() => normalizeCreatePulsePanelPresetIds(CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS));
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
        : normalizeCreatePulsePanelPresetIds(controlledPresetIds, savedPresets),
    [controlledPresetIds, savedPresets]
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
      normalizeCreatePulsePanelPresetIds(previous, savedPresets)
    );
  }, [isPresetPanelControlled, savedPresets]);

  const updateSelectedPresetIds = React.useCallback(
    (updater: (previous: CreatePulsePresetId[]) => CreatePulsePresetId[]) => {
      if (isPresetPanelControlled) {
        controlledPresetChangeHandler(
          normalizeCreatePulsePanelPresetIds(updater(normalizedControlledPresetIds), savedPresets)
        );
        return;
      }
      setInternalSelectedPresetIds((previous) =>
        normalizeCreatePulsePanelPresetIds(updater(previous), savedPresets)
      );
    },
    [
      controlledPresetChangeHandler,
      isPresetPanelControlled,
      normalizedControlledPresetIds,
      savedPresets,
    ]
  );

  const updateSavedPresets = React.useCallback(
    (updater: (previous: CreatePulseSavedPreset[]) => CreatePulseSavedPreset[]) => {
      if (isSavedPresetsControlled) {
        onSavedPresetsChange(normalizeCreatePulseSavedPresets(updater(savedPresets)));
        return;
      }
      setInternalSavedPresets((previous) => normalizeCreatePulseSavedPresets(updater(previous)));
    },
    [isSavedPresetsControlled, onSavedPresetsChange, savedPresets]
  );

  const availablePresets = React.useMemo(() => {
    const selectedPresetIdSet = new Set(selectedPresetIds);
    return resolveCreatePulsePresetCatalog(savedPresets).filter(
      (preset) => !selectedPresetIdSet.has(preset.presetId)
    );
  }, [savedPresets, selectedPresetIds]);

  const selectedPanelPresets = React.useMemo(
    () =>
      selectedPresetIds.reduce<CreatePulseResolvedPreset[]>((accumulator, presetId) => {
        const preset = resolveCreatePulsePresetById(presetId, savedPresets);
        if (preset) {
          accumulator.push(preset);
        }
        return accumulator;
      }, []),
    [savedPresets, selectedPresetIds]
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

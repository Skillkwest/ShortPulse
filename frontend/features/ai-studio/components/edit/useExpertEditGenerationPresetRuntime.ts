import React from "react";

import {
  resolveEditSubmitIntentFromRailSelection,
  type EditSubmitIntent,
} from "../../logic/editSubmitIntent";
import { resolveRailToolForGenerationMode } from "./expertEditInteractionUtils";
import { editGenerationModeOptions, type RailTool } from "./expertEditPanelViewContract";
import {
  EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS,
  normalizeExpertEditCustomPresetOverrides,
  normalizePresetPanelPresetIds,
  resolveExpertEditPresetCatalog,
  resolveExpertEditPresetLabelById,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditPresetId,
} from "./expertEditPresets";

type UseExpertEditGenerationPresetRuntimeParams = {
  isGenerationModeToggleEnabled: boolean;
  selectedRailTool: RailTool;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  controlledPresetIds?: readonly ExpertEditPresetId[] | null;
  onSelectedPresetIdsChange?: ((value: ExpertEditPresetId[]) => void) | null;
  controlledCustomPresetOverrides?: ExpertEditCustomPresetOverrides | null;
  onCustomPresetOverridesChange?: ((value: ExpertEditCustomPresetOverrides) => void) | null;
};

export const useExpertEditGenerationPresetRuntime = ({
  isGenerationModeToggleEnabled,
  selectedRailTool,
  setSelectedRailTool,
  controlledPresetIds,
  onSelectedPresetIdsChange,
  controlledCustomPresetOverrides,
  onCustomPresetOverridesChange,
}: UseExpertEditGenerationPresetRuntimeParams) => {
  const visibleEditGenerationModeOptions = React.useMemo(
    () => editGenerationModeOptions.filter((modeOption) => modeOption.id !== "markup"),
    []
  );
  const [selectedGenerationMode, setSelectedGenerationMode] =
    React.useState<EditSubmitIntent>("standard");
  const [isMorePresetsSurfaceOpen, setIsMorePresetsSurfaceOpen] = React.useState(false);
  const [internalSelectedPresetIds, setInternalSelectedPresetIds] = React.useState<
    ExpertEditPresetId[]
  >(() => normalizePresetPanelPresetIds(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS));
  const [internalCustomPresetOverrides, setInternalCustomPresetOverrides] =
    React.useState<ExpertEditCustomPresetOverrides>({});

  const isCustomOverridesControlled =
    controlledCustomPresetOverrides != null && onCustomPresetOverridesChange != null;
  const customPresetOverrides = React.useMemo(
    () =>
      normalizeExpertEditCustomPresetOverrides(
        isCustomOverridesControlled
          ? controlledCustomPresetOverrides
          : internalCustomPresetOverrides
      ),
    [controlledCustomPresetOverrides, internalCustomPresetOverrides, isCustomOverridesControlled]
  );
  const normalizedControlledPresetIds = React.useMemo(
    () =>
      controlledPresetIds == null
        ? null
        : normalizePresetPanelPresetIds(controlledPresetIds, customPresetOverrides),
    [controlledPresetIds, customPresetOverrides]
  );
  const controlledPresetChangeHandler = onSelectedPresetIdsChange ?? null;
  const isPresetPanelControlled =
    normalizedControlledPresetIds != null && controlledPresetChangeHandler != null;
  const selectedPresetIds = isPresetPanelControlled
    ? normalizedControlledPresetIds
    : internalSelectedPresetIds;

  const updateSelectedPresetIds = React.useCallback(
    (updater: (previous: ExpertEditPresetId[]) => ExpertEditPresetId[]) => {
      if (isPresetPanelControlled) {
        const next = normalizePresetPanelPresetIds(
          updater(normalizedControlledPresetIds),
          customPresetOverrides
        );
        controlledPresetChangeHandler(next);
        return;
      }
      setInternalSelectedPresetIds((previous) =>
        normalizePresetPanelPresetIds(updater(previous), customPresetOverrides)
      );
    },
    [
      controlledPresetChangeHandler,
      customPresetOverrides,
      isPresetPanelControlled,
      normalizedControlledPresetIds,
    ]
  );

  const updateCustomPresetOverrides = React.useCallback(
    (updater: (previous: ExpertEditCustomPresetOverrides) => ExpertEditCustomPresetOverrides) => {
      if (isCustomOverridesControlled) {
        const nextValue = normalizeExpertEditCustomPresetOverrides(updater(customPresetOverrides));
        onCustomPresetOverridesChange(nextValue);
        return;
      }
      setInternalCustomPresetOverrides((previous) =>
        normalizeExpertEditCustomPresetOverrides(updater(previous))
      );
    },
    [customPresetOverrides, isCustomOverridesControlled, onCustomPresetOverridesChange]
  );

  const availablePresets = React.useMemo(() => {
    const selectedPresetIdSet = new Set(selectedPresetIds);
    return resolveExpertEditPresetCatalog(customPresetOverrides).filter(
      (preset) => !selectedPresetIdSet.has(preset.presetId)
    );
  }, [customPresetOverrides, selectedPresetIds]);

  const selectedPanelPresets = React.useMemo(
    () =>
      selectedPresetIds.map((presetId) => ({
        presetId,
        label: resolveExpertEditPresetLabelById(presetId, customPresetOverrides),
      })),
    [customPresetOverrides, selectedPresetIds]
  );

  const railSelectionSubmitIntent = React.useMemo(
    () =>
      resolveEditSubmitIntentFromRailSelection({
        isInpaintSelected: selectedRailTool === "inpaint",
        isMarkupSelected: selectedRailTool === "video",
      }),
    [selectedRailTool]
  );

  React.useEffect(() => {
    if (isGenerationModeToggleEnabled && selectedGenerationMode === "markup") {
      setSelectedGenerationMode("standard");
      setSelectedRailTool("move");
    }
  }, [isGenerationModeToggleEnabled, selectedGenerationMode, setSelectedRailTool]);

  const visibleSelectedGenerationMode =
    selectedGenerationMode === "markup" ? "standard" : selectedGenerationMode;
  const effectiveEditSubmitIntent = isGenerationModeToggleEnabled
    ? visibleSelectedGenerationMode
    : railSelectionSubmitIntent;
  const effectiveGenerationModeIndex = React.useMemo(() => {
    const resolvedIndex = visibleEditGenerationModeOptions.findIndex(
      (modeOption) => modeOption.id === effectiveEditSubmitIntent
    );
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }, [effectiveEditSubmitIntent, visibleEditGenerationModeOptions]);
  const generationModeTabsStyle = React.useMemo(
    () =>
      ({
        "--edit-expert-generation-mode-index": effectiveGenerationModeIndex,
        "--edit-expert-generation-mode-slots": visibleEditGenerationModeOptions.length,
      }) as React.CSSProperties,
    [effectiveGenerationModeIndex, visibleEditGenerationModeOptions.length]
  );

  const handleGenerationModeChange = React.useCallback(
    (nextMode: EditSubmitIntent) => {
      setSelectedGenerationMode(nextMode);
      setSelectedRailTool(resolveRailToolForGenerationMode(nextMode));
    },
    [setSelectedRailTool]
  );

  const toggleMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen((previous) => !previous);
  }, []);

  return {
    availablePresets,
    customPresetOverrides,
    effectiveEditSubmitIntent,
    visibleEditGenerationModeOptions,
    generationModeTabsStyle,
    handleGenerationModeChange,
    hasSelectedPresetIds: selectedPresetIds.length > 0,
    isMorePresetsSurfaceOpen,
    selectedPanelPresets,
    setIsMorePresetsSurfaceOpen,
    toggleMorePresetsSurface,
    updateCustomPresetOverrides,
    updateSelectedPresetIds,
  };
};

import React from "react";

import { PRESET_PANEL_LIMIT_TOAST } from "./expertEditPanelViewContract";
import {
  EDIT_PRESET_PANEL_MAX,
  resolveExpertEditPresetLabelById,
  resolveExpertEditPresetPromptById,
  sortPresetIdsByCanonicalOrder,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditPresetId,
  type ExpertEditSystemPresetDefinition,
} from "./expertEditPresets";
import {
  resolvePresetDragPayload,
  setOpaquePresetDragImage,
  writePresetDragTransfer,
} from "./expertEditPanelUtilities";
import { usePresetDragDropRuntime } from "../shared/usePresetDragDropRuntime";

type UseExpertEditPresetRuntimeParams = {
  customPresetOverrides: ExpertEditCustomPresetOverrides;
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null;
  updateSelectedPresetIds: (
    updater: (previous: ExpertEditPresetId[]) => ExpertEditPresetId[]
  ) => void;
  handlePromptTextChange: (nextValue: string) => void;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
};

export const useExpertEditPresetRuntime = ({
  customPresetOverrides,
  systemPresetDefinitions,
  updateSelectedPresetIds,
  handlePromptTextChange,
  showStatusToast,
}: UseExpertEditPresetRuntimeParams) => {
  const addPresetToPanel = React.useCallback(
    (presetId: ExpertEditPresetId | null | undefined) => {
      if (!presetId) return;
      updateSelectedPresetIds((previous) => {
        if (previous.includes(presetId)) return previous;
        if (previous.length >= EDIT_PRESET_PANEL_MAX) {
          showStatusToast(PRESET_PANEL_LIMIT_TOAST, "warning");
          return previous;
        }
        return sortPresetIdsByCanonicalOrder([...previous, presetId], systemPresetDefinitions);
      });
    },
    [showStatusToast, systemPresetDefinitions, updateSelectedPresetIds]
  );

  const removePresetFromPanel = React.useCallback(
    (presetId: ExpertEditPresetId | null | undefined) => {
      if (!presetId) return;
      updateSelectedPresetIds((previous) =>
        previous.includes(presetId)
          ? previous.filter((candidatePresetId) => candidatePresetId !== presetId)
          : previous
      );
    },
    [updateSelectedPresetIds]
  );

  const handlePanelPresetApply = React.useCallback(
    (presetId: ExpertEditPresetId) => {
      const presetPrompt = resolveExpertEditPresetPromptById(
        presetId,
        customPresetOverrides,
        systemPresetDefinitions
      );
      if (!presetPrompt) return;
      handlePromptTextChange(presetPrompt);
    },
    [customPresetOverrides, handlePromptTextChange, systemPresetDefinitions]
  );

  const {
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    resetPresetDropState,
    handleSurfacePresetDragStart,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragOver,
    handlePresetPanelDragLeave,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDrop,
  } = usePresetDragDropRuntime<ExpertEditPresetId>({
    resolvePayload: resolvePresetDragPayload,
    writeDragTransfer: writePresetDragTransfer,
    setOpaqueDragImage: setOpaquePresetDragImage,
    resolveSurfacePresetLabel: (presetId) =>
      resolveExpertEditPresetLabelById(presetId, customPresetOverrides, systemPresetDefinitions),
    resolvePanelPresetLabel: (presetId) =>
      resolveExpertEditPresetLabelById(presetId, customPresetOverrides, systemPresetDefinitions),
    addPresetToPanel,
    removePresetFromPanel,
  });

  return {
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    resetPresetDropState,
    handlePanelPresetApply,
    handleSurfacePresetDragStart,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragOver,
    handlePresetPanelDragLeave,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDrop,
  };
};

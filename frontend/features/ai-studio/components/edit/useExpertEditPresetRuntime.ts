import React from "react";

import { PRESET_PANEL_LIMIT_TOAST } from "./expertEditPanelViewContract";
import {
  EDIT_PRESET_PANEL_MAX,
  resolveExpertEditPresetLabelById,
  resolveExpertEditPresetPromptById,
  sortPresetIdsByCanonicalOrder,
  type ExpertEditCustomPresetId,
  type ExpertEditCustomPresetOverride,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditPresetDragPayload,
  type ExpertEditPresetId,
  type ExpertEditSystemPresetDefinition,
} from "./expertEditPresets";
import {
  resolvePresetDragPayload,
  setOpaquePresetDragImage,
  writePresetDragTransfer,
} from "./expertEditPanelUtilities";

type UseExpertEditPresetRuntimeParams = {
  customPresetOverrides: ExpertEditCustomPresetOverrides;
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null;
  updateSelectedPresetIds: (
    updater: (previous: ExpertEditPresetId[]) => ExpertEditPresetId[]
  ) => void;
  updateCustomPresetOverrides: (
    updater: (previous: ExpertEditCustomPresetOverrides) => ExpertEditCustomPresetOverrides
  ) => void;
  handlePromptTextChange: (nextValue: string) => void;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
};

export const useExpertEditPresetRuntime = ({
  customPresetOverrides,
  systemPresetDefinitions,
  updateSelectedPresetIds,
  updateCustomPresetOverrides,
  handlePromptTextChange,
  showStatusToast,
}: UseExpertEditPresetRuntimeParams) => {
  const activePresetDragPayloadRef = React.useRef<ExpertEditPresetDragPayload | null>(null);
  const presetDragPreviewCleanupRef = React.useRef<(() => void) | null>(null);
  const [isPresetPanelDropActive, setIsPresetPanelDropActive] = React.useState(false);
  const [isPresetsSurfaceDropActive, setIsPresetsSurfaceDropActive] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
    };
  }, []);

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

  const handleCustomPresetSave = React.useCallback(
    (presetId: ExpertEditCustomPresetId, override: ExpertEditCustomPresetOverride) => {
      updateCustomPresetOverrides((previous) => ({
        ...previous,
        [presetId]: {
          label: override.label,
          prompt: override.prompt,
        },
      }));
    },
    [updateCustomPresetOverrides]
  );

  const beginPresetDragSession = React.useCallback(
    (
      event: React.DragEvent<HTMLButtonElement>,
      payload: ExpertEditPresetDragPayload,
      label: string
    ) => {
      event.stopPropagation();
      activePresetDragPayloadRef.current = payload;
      event.dataTransfer.effectAllowed = "move";
      writePresetDragTransfer(event.dataTransfer, payload, label);
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
      presetDragPreviewCleanupRef.current = setOpaquePresetDragImage(
        event.dataTransfer,
        event.currentTarget
      );
      if (!presetDragPreviewCleanupRef.current) return;
      window.setTimeout(() => {
        if (presetDragPreviewCleanupRef.current) {
          presetDragPreviewCleanupRef.current();
          presetDragPreviewCleanupRef.current = null;
        }
      }, 0);
    },
    []
  );

  const handleSurfacePresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, presetId: ExpertEditPresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "surface" },
        resolveExpertEditPresetLabelById(presetId, customPresetOverrides, systemPresetDefinitions)
      );
    },
    [beginPresetDragSession, customPresetOverrides, systemPresetDefinitions]
  );

  const handlePanelPresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, presetId: ExpertEditPresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "panel" },
        resolveExpertEditPresetLabelById(presetId, customPresetOverrides, systemPresetDefinitions)
      );
    },
    [beginPresetDragSession, customPresetOverrides, systemPresetDefinitions]
  );

  const handlePresetDragEnd = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
    setIsPresetsSurfaceDropActive(false);
    activePresetDragPayloadRef.current = null;
    if (presetDragPreviewCleanupRef.current) {
      presetDragPreviewCleanupRef.current();
      presetDragPreviewCleanupRef.current = null;
    }
  }, []);

  const resetPresetDropState = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
    setIsPresetsSurfaceDropActive(false);
  }, []);

  const handlePresetPanelDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = resolvePresetDragPayload(
      event.dataTransfer,
      activePresetDragPayloadRef.current
    );
    if (!payload || payload.source !== "surface") return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsPresetPanelDropActive(true);
  }, []);

  const handlePresetPanelDragLeave = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
  }, []);

  const handlePresetPanelDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePresetDragPayload(
        event.dataTransfer,
        activePresetDragPayloadRef.current
      );
      if (!payload || payload.source !== "surface") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetPanelDropActive(false);
      addPresetToPanel(payload.presetId);
    },
    [addPresetToPanel]
  );

  const handlePresetsSurfaceDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = resolvePresetDragPayload(
      event.dataTransfer,
      activePresetDragPayloadRef.current
    );
    if (!payload || payload.source !== "panel") return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsPresetsSurfaceDropActive(true);
  }, []);

  const handlePresetsSurfaceDragLeave = React.useCallback(() => {
    setIsPresetsSurfaceDropActive(false);
  }, []);

  const handlePresetsSurfaceDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePresetDragPayload(
        event.dataTransfer,
        activePresetDragPayloadRef.current
      );
      if (!payload || payload.source !== "panel") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetsSurfaceDropActive(false);
      removePresetFromPanel(payload.presetId);
    },
    [removePresetFromPanel]
  );

  return {
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    resetPresetDropState,
    handlePanelPresetApply,
    handleCustomPresetSave,
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

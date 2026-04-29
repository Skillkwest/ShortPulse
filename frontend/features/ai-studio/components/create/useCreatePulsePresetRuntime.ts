/**
 * Interaction runtime for Create Pulse presets.
 * Handles activation, drag/drop, and custom preset editing for the Create Pulse rail.
 */
import React from "react";
import {
  CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  CREATE_PULSE_PANEL_MAX,
  resolveCreatePulsePresetById,
  resolveCreatePulsePresetLabelById,
  sortCreatePulsePresetIdsByCanonicalOrder,
  upsertCreatePulseSavedPreset,
  type CreatePulsePresetDragPayload,
  type CreatePulsePresetId,
  type CreatePulsePresetStartResult,
  type CreatePulseResolvedPreset,
  type CreatePulseSavedPreset,
} from "./createPulsePresets";
import {
  resolveCreatePulsePresetDragPayload,
  setOpaqueCreatePulsePresetDragImage,
  writeCreatePulsePresetDragTransfer,
} from "./createPulsePresetUtilities";

export const CREATE_PULSE_PRESET_PANEL_LIMIT_TOAST = "Pulse preset panel is full (max 10).";

type UseCreatePulsePresetRuntimeParams = {
  savedPresets: CreatePulseSavedPreset[];
  activePresetId: CreatePulsePresetId | null;
  updateSelectedPresetIds: (
    updater: (previous: CreatePulsePresetId[]) => CreatePulsePresetId[]
  ) => Promise<boolean> | boolean;
  updateSavedPresets: (
    updater: (previous: CreatePulseSavedPreset[]) => CreatePulseSavedPreset[]
  ) => Promise<boolean> | boolean;
  setActivePresetId: (presetId: CreatePulsePresetId | null) => string | null | void;
  onPresetStart?: (
    preset: CreatePulseResolvedPreset,
    options?: {
      pulseSessionInstanceId?: string | null;
    }
  ) => Promise<CreatePulsePresetStartResult | void> | CreatePulsePresetStartResult | void;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
  showPersistentStatus: (message: string, tone?: "info" | "warning") => void;
  clearStatusMessage: () => void;
  isActivationBusy?: boolean;
};

/**
 * Returns Create Pulse interaction handlers for the inline rail and More Presets surface.
 */
export const useCreatePulsePresetRuntime = ({
  savedPresets,
  activePresetId,
  updateSelectedPresetIds,
  updateSavedPresets,
  setActivePresetId,
  onPresetStart,
  showStatusToast,
  showPersistentStatus,
  clearStatusMessage,
  isActivationBusy = false,
}: UseCreatePulsePresetRuntimeParams) => {
  const activePresetDragPayloadRef = React.useRef<CreatePulsePresetDragPayload | null>(null);
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
    async (presetId: CreatePulsePresetId | null | undefined) => {
      if (!presetId) return true;
      const saved = await updateSelectedPresetIds((previous) => {
        if (previous.includes(presetId)) return previous;
        if (previous.length >= CREATE_PULSE_PANEL_MAX) {
          showStatusToast(CREATE_PULSE_PRESET_PANEL_LIMIT_TOAST, "warning");
          return previous;
        }
        return sortCreatePulsePresetIdsByCanonicalOrder([...previous, presetId], savedPresets);
      });
      if (!saved) {
        showPersistentStatus("Unable to save the Pulse rail right now.", "warning");
      }
      return saved;
    },
    [savedPresets, showPersistentStatus, showStatusToast, updateSelectedPresetIds]
  );

  const removePresetFromPanel = React.useCallback(
    async (presetId: CreatePulsePresetId | null | undefined) => {
      if (!presetId) return true;
      const wasActivePreset = activePresetId === presetId;
      const saved = await updateSelectedPresetIds((previous) =>
        previous.includes(presetId)
          ? previous.filter((candidatePresetId) => candidatePresetId !== presetId)
          : previous
      );
      if (!saved) {
        showPersistentStatus("Unable to save the Pulse rail right now.", "warning");
        return false;
      }
      if (wasActivePreset) {
        setActivePresetId(null);
      }
      return saved;
    },
    [activePresetId, setActivePresetId, showPersistentStatus, updateSelectedPresetIds]
  );

  const handlePanelPresetApply = React.useCallback(
    async (presetId: CreatePulsePresetId) => {
      const resolvedPreset = resolveCreatePulsePresetById(presetId, savedPresets);
      const presetLabel = resolveCreatePulsePresetLabelById(presetId, savedPresets);
      const previousActivePresetId = activePresetId;
      if (isActivationBusy) {
        const blockedMessage = "Wait for the current Pulse step to finish before switching.";
        showPersistentStatus(blockedMessage, "warning");
        return {
          status: "blocked_busy",
          message: blockedMessage,
        } satisfies CreatePulsePresetStartResult;
      }
      clearStatusMessage();
      const pulseSessionInstanceId = setActivePresetId(presetId) ?? null;
      let startResult: CreatePulsePresetStartResult = { status: "started" };
      if (resolvedPreset) {
        startResult = (await onPresetStart?.(resolvedPreset, {
          pulseSessionInstanceId,
        })) ?? { status: "started" };
      }
      if (startResult.status === "blocked_busy") {
        setActivePresetId(previousActivePresetId ?? null);
        showPersistentStatus(startResult.message, "warning");
        return startResult;
      }
      if (startResult.status === "failed") {
        setActivePresetId(previousActivePresetId ?? null);
        showPersistentStatus(startResult.message, "warning");
        return startResult;
      }
      clearStatusMessage();
      showStatusToast(
        activePresetId && activePresetId !== presetId
          ? `Switched to ${presetLabel}. Previous Pulse session cleared.`
          : `Started ${presetLabel}.`
      );
      return startResult;
    },
    [
      activePresetId,
      clearStatusMessage,
      isActivationBusy,
      onPresetStart,
      savedPresets,
      setActivePresetId,
      showPersistentStatus,
      showStatusToast,
    ]
  );

  const handleSurfacePresetSelect = React.useCallback(
    async (presetId: CreatePulsePresetId) => {
      const saved = await addPresetToPanel(presetId);
      if (!saved) {
        return {
          status: "failed",
          reason: "preference_save_failed",
          message: "Unable to save this Pulse to the rail right now.",
        } satisfies CreatePulsePresetStartResult;
      }
      return handlePanelPresetApply(presetId);
    },
    [addPresetToPanel, handlePanelPresetApply]
  );

  const handleCustomPresetSave = React.useCallback(
    async (
      presetId: CreatePulsePresetId,
      draft: {
        label: string;
        systemInstructions: string;
      }
    ) => {
      const saved = await updateSavedPresets((previous) => {
        const existingPreset = previous.find((preset) => preset.presetId === presetId);
        return upsertCreatePulseSavedPreset(previous, {
          presetId,
          label: draft.label,
          description: null,
          systemInstructions: draft.systemInstructions,
          runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
          activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
          starterAssistantMessage: null,
          workflowStageHints: null,
          outputMode: CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
          memoryPolicy: "session",
          createdAt: existingPreset ? existingPreset.createdAt : new Date().toISOString(),
        });
      });
      if (saved === false) {
        showPersistentStatus("Unable to save this Pulse right now.", "warning");
        return false;
      }
      clearStatusMessage();
      return true;
    },
    [clearStatusMessage, showPersistentStatus, updateSavedPresets]
  );

  const beginPresetDragSession = React.useCallback(
    (
      event: React.DragEvent<HTMLButtonElement>,
      payload: CreatePulsePresetDragPayload,
      label: string
    ) => {
      event.stopPropagation();
      activePresetDragPayloadRef.current = payload;
      event.dataTransfer.effectAllowed = "move";
      writeCreatePulsePresetDragTransfer(event.dataTransfer, payload, label);
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
      presetDragPreviewCleanupRef.current = setOpaqueCreatePulsePresetDragImage(
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
    (event: React.DragEvent<HTMLButtonElement>, presetId: CreatePulsePresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "surface" },
        resolveCreatePulsePresetLabelById(presetId, savedPresets)
      );
    },
    [beginPresetDragSession, savedPresets]
  );

  const handlePanelPresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, presetId: CreatePulsePresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "panel" },
        resolveCreatePulsePresetLabelById(presetId, savedPresets)
      );
    },
    [beginPresetDragSession, savedPresets]
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

  const handlePresetPanelDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = resolveCreatePulsePresetDragPayload(
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
      const payload = resolveCreatePulsePresetDragPayload(
        event.dataTransfer,
        activePresetDragPayloadRef.current
      );
      if (!payload || payload.source !== "surface") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetPanelDropActive(false);
      void addPresetToPanel(payload.presetId);
    },
    [addPresetToPanel]
  );

  const handlePresetsSurfaceDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = resolveCreatePulsePresetDragPayload(
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
      const payload = resolveCreatePulsePresetDragPayload(
        event.dataTransfer,
        activePresetDragPayloadRef.current
      );
      if (!payload || payload.source !== "panel") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetsSurfaceDropActive(false);
      void removePresetFromPanel(payload.presetId);
    },
    [removePresetFromPanel]
  );

  return {
    handleCustomPresetSave,
    handlePanelPresetApply,
    handlePanelPresetDragStart,
    handleSurfacePresetSelect,
    handlePresetDragEnd,
    handlePresetPanelDragLeave,
    handlePresetPanelDragOver,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDrop,
    handleSurfacePresetDragStart,
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
  };
};

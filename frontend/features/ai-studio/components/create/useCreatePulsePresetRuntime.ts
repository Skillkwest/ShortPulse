/**
 * Interaction runtime for Create Pulse presets.
 * Handles activation, drag/drop, and custom preset editing for the Create Pulse rail.
 */
import React from "react";
import {
  createCreatePulseCustomSavedPreset,
  CREATE_PULSE_PANEL_MAX,
  type CreatePulseBuiltInPresetDefinition,
  resolveCreatePulsePresetById,
  resolveCreatePulsePresetLabelById,
  sortCreatePulsePresetIdsByCanonicalOrder,
  upsertCreatePulseSavedPreset,
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
import { usePresetDragDropRuntime } from "../shared/usePresetDragDropRuntime";
import type { AiStudioPulsePresetChangeOptions } from "../../hooks/useAiStudioCreateModeRuntime";
import { createPulseSessionInstanceId } from "../../logic/pulseSessionIdentity";

export const CREATE_PULSE_PRESET_PANEL_LIMIT_TOAST = "Pulse preset panel is full (max 10).";

type AddPresetToPanelResult = "added" | "already_present" | "panel_full" | "save_failed";

type UseCreatePulsePresetRuntimeParams = {
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[];
  savedPresets: CreatePulseSavedPreset[];
  activePresetId: CreatePulsePresetId | null;
  updateSelectedPresetIds: (
    updater: (previous: CreatePulsePresetId[]) => CreatePulsePresetId[]
  ) => Promise<boolean> | boolean;
  updateSavedPresets: (
    updater: (previous: CreatePulseSavedPreset[]) => CreatePulseSavedPreset[]
  ) => Promise<boolean> | boolean;
  setActivePresetId: (
    presetId: CreatePulsePresetId | null,
    options?: AiStudioPulsePresetChangeOptions
  ) => string | null | void;
  onPresetStart?: (
    preset: CreatePulseResolvedPreset,
    options?: {
      pulseSessionInstanceId?: string | null;
      deferWorkflowSessionCommit?: boolean;
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
  builtInDefinitions,
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
  const addPresetToPanel = React.useCallback(
    async (presetId: CreatePulsePresetId | null | undefined): Promise<AddPresetToPanelResult> => {
      if (!presetId) return "already_present" as const;
      let addResult: AddPresetToPanelResult | null = null;
      const saved = await updateSelectedPresetIds((previous) => {
        if (previous.includes(presetId)) {
          addResult = "already_present";
          return previous;
        }
        if (previous.length >= CREATE_PULSE_PANEL_MAX) {
          addResult = "panel_full";
          showStatusToast(CREATE_PULSE_PRESET_PANEL_LIMIT_TOAST, "warning");
          return previous;
        }
        addResult = "added";
        return sortCreatePulsePresetIdsByCanonicalOrder(
          [...previous, presetId],
          savedPresets,
          builtInDefinitions
        );
      });
      if (addResult === "panel_full" || addResult === "already_present") {
        return addResult;
      }
      if (!saved) {
        showPersistentStatus("Unable to save the Pulse rail right now.", "warning");
        return "save_failed" as const;
      }
      return addResult ?? "added";
    },
    [
      builtInDefinitions,
      savedPresets,
      showPersistentStatus,
      showStatusToast,
      updateSelectedPresetIds,
    ]
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
      const resolvedPreset = resolveCreatePulsePresetById(
        presetId,
        savedPresets,
        builtInDefinitions
      );
      const presetLabel = resolveCreatePulsePresetLabelById(
        presetId,
        savedPresets,
        builtInDefinitions
      );
      if (isActivationBusy) {
        const blockedMessage = "Wait for the current Pulse step to finish before switching.";
        showPersistentStatus(blockedMessage, "warning");
        return {
          status: "blocked_busy",
          message: blockedMessage,
        } satisfies CreatePulsePresetStartResult;
      }
      clearStatusMessage();
      if (activePresetId === presetId) {
        return {
          status: "started",
        } satisfies CreatePulsePresetStartResult;
      }
      const pulseSessionInstanceId = createPulseSessionInstanceId();
      const didStartWorkflowPreset = Boolean(
        resolvedPreset && onPresetStart && resolvedPreset.runtimeMode === "workflow_gpt"
      );
      let startResult: CreatePulsePresetStartResult = { status: "started" };
      if (resolvedPreset) {
        startResult = (await onPresetStart?.(resolvedPreset, {
          pulseSessionInstanceId,
          deferWorkflowSessionCommit: true,
        })) ?? { status: "started" };
      }
      if (startResult.status === "blocked_busy") {
        showPersistentStatus(startResult.message, "warning");
        return startResult;
      }
      if (startResult.status === "failed") {
        showPersistentStatus(startResult.message, "warning");
        return startResult;
      }
      setActivePresetId(presetId, {
        forceNewSession: true,
        sessionInstanceIdOverride: pulseSessionInstanceId,
        preserveWorkflowSession: didStartWorkflowPreset,
      });
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
      builtInDefinitions,
      savedPresets,
      setActivePresetId,
      showPersistentStatus,
      showStatusToast,
    ]
  );

  const handleSurfacePresetSelect = React.useCallback(
    async (presetId: CreatePulsePresetId) => {
      const addResult = await addPresetToPanel(presetId);
      if (addResult === "panel_full") {
        return {
          status: "failed",
          reason: "panel_full",
          message: CREATE_PULSE_PRESET_PANEL_LIMIT_TOAST,
        } satisfies CreatePulsePresetStartResult;
      }
      if (addResult === "save_failed") {
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
        return upsertCreatePulseSavedPreset(
          previous,
          createCreatePulseCustomSavedPreset({
            presetId,
            label: draft.label,
            systemInstructions: draft.systemInstructions,
            createdAt: existingPreset ? existingPreset.createdAt : new Date().toISOString(),
          })
        );
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

  const {
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    handleSurfacePresetDragStart,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragOver,
    handlePresetPanelDragLeave,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDrop,
  } = usePresetDragDropRuntime<CreatePulsePresetId>({
    resolvePayload: resolveCreatePulsePresetDragPayload,
    writeDragTransfer: writeCreatePulsePresetDragTransfer,
    setOpaqueDragImage: setOpaqueCreatePulsePresetDragImage,
    resolveSurfacePresetLabel: (presetId) =>
      resolveCreatePulsePresetLabelById(presetId, savedPresets, builtInDefinitions),
    resolvePanelPresetLabel: (presetId) =>
      resolveCreatePulsePresetLabelById(presetId, savedPresets, builtInDefinitions),
    addPresetToPanel,
    removePresetFromPanel,
  });

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

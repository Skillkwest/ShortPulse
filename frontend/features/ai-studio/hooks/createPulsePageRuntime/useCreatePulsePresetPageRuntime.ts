import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import {
  resolveCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulsePresetById,
  type CreatePulseBuiltInPresetDefinition,
  type CreatePulseResolvedPreset,
  type CreatePulseSavedPreset,
} from "../../components/create/createPulsePresets";
import type { CreatePulsePreferenceRuntimeValue } from "../../components/create/CreatePulsePreferenceProvider";
import type { StudioOutput, ToolId } from "../../types";
import { useCreatePulseBuiltInCatalog } from "../useCreatePulseBuiltInCatalog";
import { useCreatePulsePresetPanelPreference } from "../useCreatePulsePresetPanelPreference";
import type { AiStudioPulsePresetChangeOptions } from "../useAiStudioCreateModeRuntime";

type AgentModeHint = "chat" | "text" | "describe" | "reference";

type GetAgentContext = (params: {
  lastAssistantMessage: string | null;
  selectedOverride?: StudioOutput | null;
  modeHint?: AgentModeHint;
}) => AgentContext;

type UseCreatePulsePresetPageRuntimeParams = {
  selectedTool: ToolId | null;
  expertCreateMode: "standard" | "pulse";
  activeCreatePulsePresetId: string | null;
  pulseSessionInstanceId: string | null;
  pulseWorkflowSession: AgentPulseWorkflowSession | null;
  savedPresets?: readonly CreatePulseSavedPreset[] | null;
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null;
  isSavedPresetCatalogReady?: boolean;
  loadSavedPresetPreferences?: boolean;
  getAgentContext: GetAgentContext;
  clearPulseRuntime: () => void;
  clearPulsePrompt: () => void;
  handleExpertCreateModeChange: (nextMode: "standard" | "pulse") => void;
  handleActiveCreatePulsePresetIdChange: (
    nextPresetId: string | null,
    options?: AiStudioPulsePresetChangeOptions
  ) => string | null | void;
};

export const useCreatePulsePresetPageRuntime = ({
  selectedTool,
  expertCreateMode,
  activeCreatePulsePresetId,
  pulseSessionInstanceId,
  pulseWorkflowSession,
  savedPresets = null,
  builtInDefinitions = null,
  isSavedPresetCatalogReady = true,
  loadSavedPresetPreferences = false,
  getAgentContext,
  clearPulseRuntime,
  clearPulsePrompt,
  handleExpertCreateModeChange,
  handleActiveCreatePulsePresetIdChange,
}: UseCreatePulsePresetPageRuntimeParams) => {
  const shouldLoadPulsePreferences =
    loadSavedPresetPreferences &&
    selectedTool === "create" &&
    expertCreateMode === "pulse" &&
    savedPresets == null;
  const builtInCatalog = useCreatePulseBuiltInCatalog({
    enabled: selectedTool === "create" && expertCreateMode === "pulse",
  });
  const pulsePreference = useCreatePulsePresetPanelPreference({
    enabled: shouldLoadPulsePreferences,
    builtInDefinitions: builtInCatalog.builtInDefinitions,
  });
  const pulsePreferenceRuntime = useMemo<CreatePulsePreferenceRuntimeValue>(
    () => ({
      presetPanelIds: pulsePreference.presetPanelIds,
      savedPresets: pulsePreference.savedPresets,
      builtInDefinitions: builtInCatalog.builtInDefinitions,
      builtInDefinitionsLoading: builtInCatalog.loading,
      setPresetPanelIds: pulsePreference.setPresetPanelIds,
      setSavedPresets: pulsePreference.setSavedPresets,
    }),
    [
      builtInCatalog.builtInDefinitions,
      builtInCatalog.loading,
      pulsePreference.presetPanelIds,
      pulsePreference.savedPresets,
      pulsePreference.setPresetPanelIds,
      pulsePreference.setSavedPresets,
    ]
  );
  const [activeCreatePulsePresetSnapshotState, setActiveCreatePulsePresetSnapshot] =
    useState<CreatePulseResolvedPreset | null>(null);

  const clearPulseRuntimeForPage = useCallback(() => {
    setActiveCreatePulsePresetSnapshot(null);
    clearPulseRuntime();
    clearPulsePrompt();
  }, [clearPulsePrompt, clearPulseRuntime]);

  const handleExpertCreateModeChangeForPage = useCallback(
    (nextMode: "standard" | "pulse") => {
      if (nextMode === "standard") {
        setActiveCreatePulsePresetSnapshot(null);
        clearPulsePrompt();
      }
      handleExpertCreateModeChange(nextMode);
    },
    [clearPulsePrompt, handleExpertCreateModeChange]
  );

  const handleActiveCreatePulsePresetIdChangeForPage = useCallback(
    (nextPresetId: string | null, options?: AiStudioPulsePresetChangeOptions) => {
      if (!nextPresetId || nextPresetId !== activeCreatePulsePresetId) {
        if (!options?.preserveWorkflowSession) {
          setActiveCreatePulsePresetSnapshot(null);
        }
        clearPulsePrompt();
      }
      return handleActiveCreatePulsePresetIdChange(nextPresetId, options);
    },
    [activeCreatePulsePresetId, clearPulsePrompt, handleActiveCreatePulsePresetIdChange]
  );

  const hasActivePulseSession =
    selectedTool === "create" &&
    expertCreateMode === "pulse" &&
    Boolean(activeCreatePulsePresetId) &&
    Boolean(pulseSessionInstanceId);
  const resolvedSavedPresets = savedPresets ?? pulsePreference.savedPresets;
  const resolvedBuiltInDefinitions =
    builtInDefinitions ??
    builtInCatalog.builtInDefinitions ??
    resolveCreatePulseBuiltInPresetDefinitions();
  const resolvedSavedPresetCatalogReady =
    isSavedPresetCatalogReady &&
    (!shouldLoadPulsePreferences || !pulsePreference.loading) &&
    !builtInCatalog.loading;
  const restoredCreatePulsePresetSnapshot = useMemo(
    () =>
      hasActivePulseSession && activeCreatePulsePresetId
        ? resolveCreatePulsePresetById(
            activeCreatePulsePresetId,
            resolvedSavedPresets,
            resolvedBuiltInDefinitions
          )
        : null,
    [
      activeCreatePulsePresetId,
      hasActivePulseSession,
      resolvedBuiltInDefinitions,
      resolvedSavedPresets,
    ]
  );
  const activeCreatePulsePresetSnapshot =
    hasActivePulseSession &&
    activeCreatePulsePresetSnapshotState?.presetId === activeCreatePulsePresetId
      ? activeCreatePulsePresetSnapshotState
      : restoredCreatePulsePresetSnapshot?.presetId === activeCreatePulsePresetId
        ? restoredCreatePulsePresetSnapshot
        : null;
  useEffect(() => {
    if (!hasActivePulseSession || activeCreatePulsePresetSnapshot) return;
    if (!resolvedSavedPresetCatalogReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Unknown restored Pulse runtimes without a resolvable preset snapshot must fail closed before they can build context.
    clearPulseRuntimeForPage();
  }, [
    activeCreatePulsePresetSnapshot,
    clearPulseRuntimeForPage,
    hasActivePulseSession,
    resolvedSavedPresetCatalogReady,
  ]);

  const getPulseAwareAgentContext = useCallback<GetAgentContext>(
    (params) => {
      const baseContext = getAgentContext(params);
      if (!hasActivePulseSession || !activeCreatePulsePresetId) {
        return baseContext;
      }
      const resolvedPulsePreset =
        activeCreatePulsePresetSnapshot?.presetId === activeCreatePulsePresetId
          ? activeCreatePulsePresetSnapshot
          : null;
      const instructions = resolvedPulsePreset?.systemInstructions?.trim() ?? "";
      if (!resolvedPulsePreset || !instructions) return baseContext;
      return {
        ...baseContext,
        pulse: {
          presetId: activeCreatePulsePresetId,
          label: resolvedPulsePreset.label,
          description: resolvedPulsePreset.description,
          instructions,
          runtimeMode: resolvedPulsePreset.runtimeMode,
          activationMode: resolvedPulsePreset.activationMode,
          starterAssistantMessage: resolvedPulsePreset.starterAssistantMessage,
          workflowStageHints: resolvedPulsePreset.workflowStageHints,
          outputMode: resolvedPulsePreset.outputMode,
          artifactTarget: resolvedPulsePreset.artifactTarget,
          memoryPolicy: resolvedPulsePreset.memoryPolicy,
          source: resolvedPulsePreset.isBuiltIn ? "builtin" : "custom",
          workflowSession: pulseWorkflowSession,
        },
      };
    },
    [
      activeCreatePulsePresetId,
      activeCreatePulsePresetSnapshot,
      getAgentContext,
      hasActivePulseSession,
      pulseWorkflowSession,
    ]
  );

  return {
    activeCreatePulsePresetSnapshot,
    pulsePreferenceRuntime,
    setActiveCreatePulsePresetSnapshot,
    clearPulseRuntimeForPage,
    handleExpertCreateModeChangeForPage,
    handleActiveCreatePulsePresetIdChangeForPage,
    hasActivePulseSession,
    standardCreateAgentContextResolver: getAgentContext,
    pulseCreateAgentContextResolver: getPulseAwareAgentContext,
  };
};

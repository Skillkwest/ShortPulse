import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import {
  resolveCreatePulsePresetById,
  type CreatePulseBuiltInPresetDefinition,
  type CreatePulseResolvedPreset,
  type CreatePulseSavedPreset,
} from "../../components/create/createPulsePresets";
import type { CreatePulsePreferenceRuntimeValue } from "../../components/create/createPulsePreferenceRuntime";
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
  const shouldLoadBuiltInPulseCatalog = selectedTool === "create";
  const builtInCatalog = useCreatePulseBuiltInCatalog({
    enabled: shouldLoadBuiltInPulseCatalog,
  });
  const pulsePreference = useCreatePulsePresetPanelPreference({
    enabled: shouldLoadPulsePreferences,
    builtInDefinitions: builtInCatalog.builtInDefinitions,
  });
  const refreshBuiltInDefinitions = useMemo(
    () => async () => {
      const nextCatalog = await builtInCatalog.refresh();
      if (!nextCatalog?.isAuthoritative) return null;
      return nextCatalog.builtInDefinitions;
    },
    [builtInCatalog]
  );
  const pulsePreferenceRuntime = useMemo<CreatePulsePreferenceRuntimeValue>(
    () => ({
      presetPanelIds: pulsePreference.presetPanelIds,
      savedPresets: pulsePreference.savedPresets,
      deletedBuiltInPresetIds: pulsePreference.deletedBuiltInPresetIds,
      builtInDefinitions: builtInCatalog.builtInDefinitions,
      builtInDefinitionsLoading: builtInCatalog.loading,
      builtInDefinitionsError: builtInCatalog.error,
      builtInDefinitionsSource: builtInCatalog.source,
      builtInDefinitionsDegraded: builtInCatalog.degraded,
      builtInDefinitionsAuthoritative: builtInCatalog.isAuthoritative,
      refreshBuiltInDefinitions,
      setPresetPanelIds: pulsePreference.setPresetPanelIds,
      setSavedPresets: pulsePreference.setSavedPresets,
      restoreDeletedBuiltInPresetIds: pulsePreference.restoreDeletedBuiltInPresetIds,
    }),
    [
      builtInCatalog.builtInDefinitions,
      builtInCatalog.degraded,
      builtInCatalog.error,
      builtInCatalog.isAuthoritative,
      builtInCatalog.loading,
      builtInCatalog.source,
      pulsePreference.presetPanelIds,
      pulsePreference.savedPresets,
      pulsePreference.deletedBuiltInPresetIds,
      pulsePreference.restoreDeletedBuiltInPresetIds,
      pulsePreference.setPresetPanelIds,
      pulsePreference.setSavedPresets,
      refreshBuiltInDefinitions,
    ]
  );
  const [activeCreatePulsePresetSnapshotState, setActiveCreatePulsePresetSnapshot] =
    useState<CreatePulseResolvedPreset | null>(null);
  const [pendingCreatePulsePresetSnapshot, setPendingCreatePulsePresetSnapshot] =
    useState<CreatePulseResolvedPreset | null>(null);
  const pulseActivationRevisionRef = useRef(0);
  const failedClosedPulseRuntimeKeyRef = useRef<string | null>(null);
  const expertCreateModeRef = useRef<"standard" | "pulse">(expertCreateMode);

  useEffect(() => {
    expertCreateModeRef.current = expertCreateMode;
  }, [expertCreateMode]);

  const invalidatePulseActivation = useCallback(() => {
    pulseActivationRevisionRef.current += 1;
  }, []);

  const clearPulseRuntimeForPage = useCallback(() => {
    invalidatePulseActivation();
    setActiveCreatePulsePresetSnapshot(null);
    setPendingCreatePulsePresetSnapshot(null);
    clearPulseRuntime();
    clearPulsePrompt();
  }, [clearPulsePrompt, clearPulseRuntime, invalidatePulseActivation]);

  const handleExpertCreateModeChangeForPage = useCallback(
    (nextMode: "standard" | "pulse") => {
      handleExpertCreateModeChange(nextMode);
    },
    [handleExpertCreateModeChange]
  );

  const handleActiveCreatePulsePresetIdChangeForPage = useCallback(
    (nextPresetId: string | null, options?: AiStudioPulsePresetChangeOptions) => {
      setPendingCreatePulsePresetSnapshot(null);
      if (!nextPresetId || nextPresetId !== activeCreatePulsePresetId) {
        invalidatePulseActivation();
        const hasMatchingActiveSnapshot =
          nextPresetId != null && activeCreatePulsePresetSnapshotState?.presetId === nextPresetId;
        if (!options?.preserveWorkflowSession && !hasMatchingActiveSnapshot) {
          setActiveCreatePulsePresetSnapshot(null);
        }
        clearPulsePrompt();
      }
      return handleActiveCreatePulsePresetIdChange(nextPresetId, options);
    },
    [
      activeCreatePulsePresetId,
      activeCreatePulsePresetSnapshotState,
      clearPulsePrompt,
      handleActiveCreatePulsePresetIdChange,
      invalidatePulseActivation,
    ]
  );

  const beginPulseActivation = useCallback((preset: CreatePulseResolvedPreset) => {
    const activationRevision = pulseActivationRevisionRef.current + 1;
    pulseActivationRevisionRef.current = activationRevision;
    setPendingCreatePulsePresetSnapshot(preset);
    setActiveCreatePulsePresetSnapshot(preset);
    return {
      activationRevision,
      isCurrent: () =>
        pulseActivationRevisionRef.current === activationRevision &&
        expertCreateModeRef.current === "pulse",
      clearPending: () => {
        if (pulseActivationRevisionRef.current !== activationRevision) return;
        setPendingCreatePulsePresetSnapshot(null);
      },
      restoreSnapshot: (snapshot: CreatePulseResolvedPreset | null) => {
        if (pulseActivationRevisionRef.current !== activationRevision) return;
        setActiveCreatePulsePresetSnapshot(snapshot);
      },
    };
  }, []);

  const hasActivePulseSession =
    expertCreateMode === "pulse" &&
    Boolean(activeCreatePulsePresetId) &&
    Boolean(pulseSessionInstanceId);
  const resolvedSavedPresets = savedPresets ?? pulsePreference.savedPresets;
  const resolvedBuiltInDefinitions = builtInDefinitions ?? builtInCatalog.builtInDefinitions;
  const resolvedBuiltInDefinitionsAreAuthoritative =
    builtInDefinitions != null ? true : builtInCatalog.isAuthoritative;
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
  const hasLiveActiveCreatePulsePresetSnapshot =
    hasActivePulseSession &&
    activeCreatePulsePresetSnapshotState?.presetId === activeCreatePulsePresetId;
  const activeCreatePulsePresetSnapshot = hasLiveActiveCreatePulsePresetSnapshot
    ? activeCreatePulsePresetSnapshotState
    : restoredCreatePulsePresetSnapshot?.presetId === activeCreatePulsePresetId
      ? restoredCreatePulsePresetSnapshot
      : null;
  const displayCreatePulsePresetSnapshot =
    activeCreatePulsePresetSnapshot ?? pendingCreatePulsePresetSnapshot;
  const displayCreatePulsePresetId =
    activeCreatePulsePresetId ?? pendingCreatePulsePresetSnapshot?.presetId ?? null;
  const isPulseStartupPending =
    expertCreateMode === "pulse" &&
    !hasActivePulseSession &&
    pendingCreatePulsePresetSnapshot != null;
  const activePulseRuntimeKey =
    hasActivePulseSession && activeCreatePulsePresetId && pulseSessionInstanceId
      ? `${activeCreatePulsePresetId}:${pulseSessionInstanceId}`
      : null;
  const shouldResolveActivePulseSession = selectedTool === "create" && expertCreateMode === "pulse";

  useEffect(() => {
    if (activePulseRuntimeKey != null) return;
    failedClosedPulseRuntimeKeyRef.current = null;
  }, [activePulseRuntimeKey]);

  const requestFailedClosedPulseRuntimeClear = useCallback(() => {
    if (!activePulseRuntimeKey) return;
    if (failedClosedPulseRuntimeKeyRef.current === activePulseRuntimeKey) return;
    failedClosedPulseRuntimeKeyRef.current = activePulseRuntimeKey;
    queueMicrotask(() => {
      clearPulseRuntimeForPage();
    });
  }, [activePulseRuntimeKey, clearPulseRuntimeForPage]);

  useEffect(() => {
    if (!hasActivePulseSession || activeCreatePulsePresetSnapshot) return;
    if (!shouldResolveActivePulseSession) return;
    if (!resolvedSavedPresetCatalogReady) return;
    requestFailedClosedPulseRuntimeClear();
  }, [
    activeCreatePulsePresetSnapshot,
    hasActivePulseSession,
    requestFailedClosedPulseRuntimeClear,
    resolvedSavedPresetCatalogReady,
    shouldResolveActivePulseSession,
  ]);

  useEffect(() => {
    if (selectedTool !== "create" || expertCreateMode !== "pulse") return;
    if (!hasActivePulseSession || activeCreatePulsePresetSnapshot?.isBuiltIn !== true) return;
    if (hasLiveActiveCreatePulsePresetSnapshot) return;
    if (!resolvedSavedPresetCatalogReady || resolvedBuiltInDefinitionsAreAuthoritative) return;
    requestFailedClosedPulseRuntimeClear();
  }, [
    activeCreatePulsePresetSnapshot,
    expertCreateMode,
    hasActivePulseSession,
    hasLiveActiveCreatePulsePresetSnapshot,
    requestFailedClosedPulseRuntimeClear,
    resolvedBuiltInDefinitionsAreAuthoritative,
    resolvedSavedPresetCatalogReady,
    selectedTool,
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
      if (!resolvedPulsePreset || (!instructions && resolvedPulsePreset.isBuiltIn !== true)) {
        return baseContext;
      }
      return {
        ...baseContext,
        pulse: {
          presetId: activeCreatePulsePresetId,
          label: resolvedPulsePreset.label,
          description: resolvedPulsePreset.description,
          instructions,
          pulseKind: resolvedPulsePreset.pulseKind,
          source: resolvedPulsePreset.isBuiltIn ? "builtin" : "custom",
          schemaVersion: resolvedPulsePreset.schemaVersion,
          ...(resolvedPulsePreset.pulseKind === "guided_workflow"
            ? {
                runtimeMode: resolvedPulsePreset.runtimeMode,
                activationMode: resolvedPulsePreset.activationMode,
                outputMode: resolvedPulsePreset.outputMode,
                artifactTarget: resolvedPulsePreset.artifactTarget,
                memoryPolicy: resolvedPulsePreset.memoryPolicy,
                workflowSession: pulseWorkflowSession,
              }
            : {}),
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
    displayCreatePulsePresetId,
    displayCreatePulsePresetSnapshot,
    isPulseStartupPending,
    pendingCreatePulsePresetSnapshot,
    pulsePreferenceRuntime,
    setActiveCreatePulsePresetSnapshot,
    setPendingCreatePulsePresetSnapshot,
    beginPulseActivation,
    clearPulseRuntimeForPage,
    handleExpertCreateModeChangeForPage,
    handleActiveCreatePulsePresetIdChangeForPage,
    hasActivePulseSession,
    standardCreateAgentContextResolver: getAgentContext,
    pulseCreateAgentContextResolver: getPulseAwareAgentContext,
  };
};

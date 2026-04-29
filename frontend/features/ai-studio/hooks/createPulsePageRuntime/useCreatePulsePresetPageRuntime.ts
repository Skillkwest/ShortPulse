import { useCallback, useEffect, useState } from "react";
import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { CreatePulseResolvedPreset } from "../../components/create/createPulsePresets";
import type { StudioOutput, ToolId } from "../../types";
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
  getAgentContext,
  clearPulseRuntime,
  clearPulsePrompt,
  handleExpertCreateModeChange,
  handleActiveCreatePulsePresetIdChange,
}: UseCreatePulsePresetPageRuntimeParams) => {
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
        setActiveCreatePulsePresetSnapshot(null);
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
  const activeCreatePulsePresetSnapshot =
    hasActivePulseSession &&
    activeCreatePulsePresetSnapshotState?.presetId === activeCreatePulsePresetId
      ? activeCreatePulsePresetSnapshotState
      : null;
  useEffect(() => {
    if (!hasActivePulseSession || activeCreatePulsePresetSnapshot) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restored Pulse runtimes without a preset snapshot must fail closed before they can build context.
    clearPulseRuntimeForPage();
  }, [activeCreatePulsePresetSnapshot, clearPulseRuntimeForPage, hasActivePulseSession]);

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
    setActiveCreatePulsePresetSnapshot,
    clearPulseRuntimeForPage,
    handleExpertCreateModeChangeForPage,
    handleActiveCreatePulsePresetIdChangeForPage,
    hasActivePulseSession,
    standardCreateAgentContextResolver: getAgentContext,
    pulseCreateAgentContextResolver: getPulseAwareAgentContext,
  };
};

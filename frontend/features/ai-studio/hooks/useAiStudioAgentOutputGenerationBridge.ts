/**
 * AI Studio agent-output generation bridge.
 * Owns agent-output prompt routing, guarded generate shortcuts, and optimistic output bubble linking for the page shell.
 */
import { useCallback, useMemo } from "react";
import type { AgentOutputBubbleMediaState, AgentOutputGenerateInput } from "../../ai-agent/types";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import { shouldDisableAgentOutputGenerate } from "../logic/createGenerationGuards";
import { normalizeAgentOutputGenerateRequest } from "../logic/promptAdjacency";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import { useAgentOutputBubbleLinking } from "./agentOrchestration/useAgentOutputBubbleLinking";

type HandleGenerateOptions = {
  modeOverride?: StudioMode;
  toolOverride?: ToolId | null;
  costOverrideCredits?: number | null;
};

type HandleGenerateResult = {
  accepted: boolean;
  optimisticOutputId: string | null;
};

type UseAiStudioAgentOutputGenerationBridgeParams = {
  outputs: StudioOutput[];
  mode: StudioMode;
  selectedTool: ToolId | null;
  isGenerateDisabled: boolean;
  isGenerateClickLocked: boolean;
  hasSufficientCreditsForOutputGenerate: boolean;
  model: string | null;
  characterModeEnabled: boolean;
  selectedCharacterId: string;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  setVideoReferenceText: (value: string) => void;
  setEditReferenceText: (value: string) => void;
  setSharedPrompt: (value: string) => void;
  setSelectedToolWithEditIntentReset: (tool: ToolId | null) => void;
  setMode: (value: StudioMode) => void;
  setPromptOrigin: (value: PromptOrigin) => void;
  handleGenerate: (prompt: string, options: HandleGenerateOptions) => Promise<HandleGenerateResult>;
};

/**
 * Returns the page-facing agent-output generate handler, bubble media state, and disable guard.
 */
export const useAiStudioAgentOutputGenerationBridge = ({
  outputs,
  mode,
  selectedTool,
  isGenerateDisabled,
  isGenerateClickLocked,
  hasSufficientCreditsForOutputGenerate,
  model,
  characterModeEnabled,
  selectedCharacterId,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  setVideoReferenceText,
  setEditReferenceText,
  setSharedPrompt,
  setSelectedToolWithEditIntentReset,
  setMode,
  setPromptOrigin,
  handleGenerate,
}: UseAiStudioAgentOutputGenerationBridgeParams) => {
  const { assistantBubbleMedia, registerOutputLink } = useAgentOutputBubbleLinking({ outputs });

  const handleGenerateFromAgentOutputPrompt = useCallback(
    (input: AgentOutputGenerateInput) => {
      const request = normalizeAgentOutputGenerateRequest(input);
      if (!request) return;
      const isVideoWorkflow = selectedTool === "video" || selectedTool === "kling";
      const isEditWorkflow = selectedTool === "edit" || selectedTool === "image";
      const workflowTool: ToolId = isVideoWorkflow ? "video" : isEditWorkflow ? "edit" : "create";
      const workflowMode: StudioMode = isVideoWorkflow ? "video" : "image";

      if (workflowTool === "video") {
        setVideoReferenceText(request.prompt);
      } else if (workflowTool === "edit") {
        setEditReferenceText(request.prompt);
      } else {
        setSharedPrompt(request.prompt);
        if (selectedTool !== "create" && selectedTool !== "text") {
          setSelectedToolWithEditIntentReset("create");
        }
        setMode("image");
      }

      setPromptOrigin("agent");
      void handleGenerate(request.prompt, {
        modeOverride: workflowMode,
        toolOverride: workflowTool,
        costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
      })
        .then((result) => {
          if (!result.accepted || !result.optimisticOutputId) return;
          registerOutputLink({
            messageId: request.messageId,
            optimisticOutputId: result.optimisticOutputId,
          });
        })
        .catch(() => {
          // The generation controller surfaces user-facing errors.
        });
    },
    [
      currentCostCredits,
      handleGenerate,
      promptReferenceGenerateCostCredits,
      registerOutputLink,
      selectedTool,
      setEditReferenceText,
      setMode,
      setPromptOrigin,
      setSelectedToolWithEditIntentReset,
      setSharedPrompt,
      setVideoReferenceText,
    ]
  );

  const disableAgentOutputGenerate = useMemo(
    () =>
      shouldDisableAgentOutputGenerate({
        mode,
        selectedTool,
        isGenerateDisabled,
        isGenerateClickLocked,
        hasSufficientCreditsForOutputGenerate,
        modelId: model,
        characterModeEnabled,
        selectedCharacterId,
      }),
    [
      characterModeEnabled,
      hasSufficientCreditsForOutputGenerate,
      isGenerateClickLocked,
      isGenerateDisabled,
      mode,
      model,
      selectedCharacterId,
      selectedTool,
    ]
  );

  return {
    assistantBubbleMedia: assistantBubbleMedia as Record<string, AgentOutputBubbleMediaState>,
    handleGenerateFromAgentOutputPrompt,
    disableAgentOutputGenerate,
  };
};

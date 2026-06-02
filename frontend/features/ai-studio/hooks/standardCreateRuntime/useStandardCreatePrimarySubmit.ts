import { useCallback } from "react";
import type { AgentAttachment } from "../../../../prefabs/agent";
import type { StudioMode, ToolId } from "../../types";
import {
  resolveStandardCreatePrimaryActionDecision,
  type StandardCreatePrimaryActionDecision,
} from "../../createRuntime/standardPanel/standardCreatePrimaryActionPolicy";
import { useAiStudioCreateSubmitSingleFlight } from "../useAiStudioCreateSubmitSingleFlight";

type GenerateStandardCreateOutput = (
  promptOverride?: string | null,
  options?: {
    modeOverride?: StudioMode;
    toolOverride?: ToolId | null;
    costOverrideCredits?: number | null;
  }
) => void | Promise<unknown>;

type UseStandardCreatePrimarySubmitParams = {
  enabled?: boolean;
  isGenerateDisabled?: boolean;
  selectedTool: ToolId | null;
  chatModeEnabled: boolean;
  agentInput: string;
  prompt: string;
  createGenerateCostCredits: number | null;
  agentAttachments?: AgentAttachment[];
  handleGenerate: GenerateStandardCreateOutput;
  handleProviderPrimarySubmit: () => void;
  setVisibleCreatePrompt: (value: string) => void;
};

/**
 * Standard Create primary submit command.
 * Uses the visible composer text as the only generation prompt in Standard Create.
 */
export const useStandardCreatePrimarySubmit = ({
  enabled = true,
  isGenerateDisabled = false,
  selectedTool,
  chatModeEnabled,
  agentInput,
  prompt,
  createGenerateCostCredits,
  agentAttachments = [],
  handleGenerate,
  handleProviderPrimarySubmit,
  setVisibleCreatePrompt = () => undefined,
}: UseStandardCreatePrimarySubmitParams) => {
  const handlePrimarySubmit = useCallback(() => {
    const decision: StandardCreatePrimaryActionDecision =
      resolveStandardCreatePrimaryActionDecision({
        enabled,
        isGenerateDisabled,
        selectedTool,
        chatModeEnabled,
        agentInput,
        prompt,
        createGenerateCostCredits,
        agentAttachments,
      });

    if (decision.kind === "noop") {
      return;
    }

    if (decision.kind === "provider_submit") {
      return handleProviderPrimarySubmit();
    }

    if (decision.mirrorPromptToVisibleComposer) {
      setVisibleCreatePrompt(decision.prompt);
    }

    return handleGenerate(decision.prompt, decision.options);
  }, [
    agentInput,
    chatModeEnabled,
    createGenerateCostCredits,
    enabled,
    isGenerateDisabled,
    handleGenerate,
    handleProviderPrimarySubmit,
    prompt,
    selectedTool,
    agentAttachments,
    setVisibleCreatePrompt,
  ]);

  return useAiStudioCreateSubmitSingleFlight(handlePrimarySubmit);
};

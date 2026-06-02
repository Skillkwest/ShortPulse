import { useCallback } from "react";
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
  selectedTool: ToolId | null;
  chatModeEnabled: boolean;
  agentInput: string;
  prompt: string;
  createGenerateCostCredits: number | null;
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
  selectedTool,
  chatModeEnabled,
  agentInput,
  prompt,
  createGenerateCostCredits,
  handleGenerate,
  handleProviderPrimarySubmit,
  setVisibleCreatePrompt = () => undefined,
}: UseStandardCreatePrimarySubmitParams) => {
  const handlePrimarySubmit = useCallback(() => {
    const decision: StandardCreatePrimaryActionDecision =
      resolveStandardCreatePrimaryActionDecision({
        enabled,
        selectedTool,
        chatModeEnabled,
        agentInput,
        prompt,
        createGenerateCostCredits,
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
    handleGenerate,
    handleProviderPrimarySubmit,
    prompt,
    selectedTool,
    setVisibleCreatePrompt,
  ]);

  return useAiStudioCreateSubmitSingleFlight(handlePrimarySubmit);
};

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { resolveChatOffCreatePrompt } from "../../logic/promptAdjacency";
import type { StudioMode, ToolId } from "../../types";

type StandardAgentSendResult = {
  prompt?: string | null;
  referenceTitle?: string | null;
} | void;

type GenerateStandardCreateOutput = (
  promptOverride?: string | null,
  options?: {
    modeOverride?: StudioMode;
    toolOverride?: ToolId | null;
    costOverrideCredits?: number | null;
  }
) => void | Promise<unknown>;

type UseStandardCreatePrimarySubmitParams = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  chatModeEnabled: boolean;
  agentInput: string;
  prompt: string;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  handleAgentSend: (
    message?: string,
    options?: { captureResult?: boolean }
  ) => Promise<StandardAgentSendResult>;
  handleGenerate: GenerateStandardCreateOutput;
  handleProviderPrimarySubmit: () => void;
  handleStandardAgentCaptureResult: (promptText: string, referenceTitle?: string | null) => void;
  setPromptOrigin: Dispatch<SetStateAction<"manual" | "agent" | "reference">>;
};

const isStandardCreateTextTool = (tool: ToolId | null): boolean =>
  tool === "create" || tool === "text";

/**
 * Standard Create primary submit command.
 * Owns chat-mode agent send and chat-off provider generation.
 */
export const useStandardCreatePrimarySubmit = ({
  mode,
  selectedTool,
  chatModeEnabled,
  agentInput,
  prompt,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  handleAgentSend,
  handleGenerate,
  handleProviderPrimarySubmit,
  handleStandardAgentCaptureResult,
  setPromptOrigin,
}: UseStandardCreatePrimarySubmitParams) =>
  useCallback(() => {
    if (isStandardCreateTextTool(selectedTool) && mode === "text") {
      if (chatModeEnabled) {
        handleAgentSend(agentInput || prompt, { captureResult: true }).then((result) => {
          if (result?.prompt) {
            handleStandardAgentCaptureResult(result.prompt, result.referenceTitle);
          }
        });
        return;
      }
      const rawPrompt = resolveChatOffCreatePrompt({
        agentInput,
        sharedPrompt: prompt,
        allowSharedPromptFallback: true,
      });
      if (rawPrompt) {
        setPromptOrigin("manual");
      }
      void handleGenerate(rawPrompt ?? "", {
        modeOverride: "image",
        toolOverride: "create",
        costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
      });
      return;
    }
    handleProviderPrimarySubmit();
  }, [
    agentInput,
    chatModeEnabled,
    currentCostCredits,
    handleAgentSend,
    handleGenerate,
    handleProviderPrimarySubmit,
    handleStandardAgentCaptureResult,
    mode,
    prompt,
    promptReferenceGenerateCostCredits,
    selectedTool,
    setPromptOrigin,
  ]);

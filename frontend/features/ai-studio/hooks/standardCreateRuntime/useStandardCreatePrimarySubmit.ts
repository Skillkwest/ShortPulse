import { useCallback } from "react";
import type { StudioMode, ToolId } from "../../types";

type StandardAgentSendResult = {
  prompt?: string | null;
  referenceTitle?: string | null;
} | void;

type UseStandardCreatePrimarySubmitParams = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  chatModeEnabled: boolean;
  agentInput: string;
  prompt: string;
  handleAgentSend: (
    message?: string,
    options?: { captureResult?: boolean }
  ) => Promise<StandardAgentSendResult>;
  handleProviderPrimarySubmit: () => void;
  handleStandardAgentCaptureResult: (promptText: string, referenceTitle?: string | null) => void;
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
  handleAgentSend,
  handleProviderPrimarySubmit,
  handleStandardAgentCaptureResult,
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
      handleProviderPrimarySubmit();
      return;
    }
    handleProviderPrimarySubmit();
  }, [
    agentInput,
    chatModeEnabled,
    handleAgentSend,
    handleProviderPrimarySubmit,
    handleStandardAgentCaptureResult,
    mode,
    prompt,
    selectedTool,
  ]);

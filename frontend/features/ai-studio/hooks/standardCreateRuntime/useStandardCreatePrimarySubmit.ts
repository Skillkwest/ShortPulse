import { useCallback } from "react";
import type { StudioMode, ToolId } from "../../types";

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
  setSharedPrompt: (value: string) => void;
};

const isStandardCreateTextTool = (tool: ToolId | null): boolean =>
  tool === "create" || tool === "text";

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
  setSharedPrompt = () => undefined,
}: UseStandardCreatePrimarySubmitParams) =>
  useCallback(() => {
    if (!enabled) return;
    if (isStandardCreateTextTool(selectedTool)) {
      const visibleComposerPrompt = (chatModeEnabled ? agentInput : prompt).trim();
      if (!visibleComposerPrompt) return;
      if (chatModeEnabled) {
        setSharedPrompt(visibleComposerPrompt);
      }
      void handleGenerate(visibleComposerPrompt, {
        modeOverride: "image",
        toolOverride: "create",
        costOverrideCredits: createGenerateCostCredits,
      });
      return;
    }
    handleProviderPrimarySubmit();
  }, [
    agentInput,
    chatModeEnabled,
    createGenerateCostCredits,
    enabled,
    handleGenerate,
    handleProviderPrimarySubmit,
    prompt,
    selectedTool,
    setSharedPrompt,
  ]);

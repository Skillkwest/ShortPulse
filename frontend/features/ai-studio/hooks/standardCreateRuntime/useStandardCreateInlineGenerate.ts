/**
 * Standard Create inline generation command.
 * Resolves chat-off composer input inside the Standard runtime boundary before calling neutral generation plumbing.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { resolveChatOffCreatePrompt } from "../../logic/promptAdjacency";
import type { StudioMode, ToolId } from "../../types";

type GenerateStandardCreateOutput = (
  promptOverride?: string | null,
  options?: {
    modeOverride?: StudioMode;
    toolOverride?: ToolId | null;
    costOverrideCredits?: number | null;
  }
) => void | Promise<unknown>;

type UseStandardCreateInlineGenerateParams = {
  enabled?: boolean;
  agentInput: string;
  prompt: string;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  handleGenerate: GenerateStandardCreateOutput;
  setPromptOrigin: Dispatch<SetStateAction<"manual" | "agent" | "reference">>;
};

/**
 * Returns the Standard-only inline generate handler used when Chat Mode is off.
 */
export const useStandardCreateInlineGenerate = ({
  enabled = true,
  agentInput,
  prompt,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  handleGenerate,
  setPromptOrigin,
}: UseStandardCreateInlineGenerateParams) =>
  useCallback(() => {
    if (!enabled) return;
    const rawPrompt = resolveChatOffCreatePrompt({
      agentInput,
      sharedPrompt: prompt,
      allowSharedPromptFallback: true,
    });
    if (rawPrompt) setPromptOrigin("manual");
    void handleGenerate(rawPrompt ?? "", {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
    });
  }, [
    agentInput,
    currentCostCredits,
    enabled,
    handleGenerate,
    prompt,
    promptReferenceGenerateCostCredits,
    setPromptOrigin,
  ]);

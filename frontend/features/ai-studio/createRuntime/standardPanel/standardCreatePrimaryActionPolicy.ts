/**
 * Standard Create primary action policy.
 * Decides whether the Standard primary submit should generate from the visible
 * composer, fall back to provider submit, or no-op.
 */
import type { ToolId } from "../../types";
import { resolveVisibleStandardComposerPrompt } from "./standardCreateComposerState";

const isStandardCreateTextTool = (tool: ToolId | null): boolean =>
  tool === "create" || tool === "text";

export type StandardCreatePrimaryActionDecision =
  | { kind: "noop" }
  | { kind: "provider_submit" }
  | {
      kind: "generate";
      prompt: string;
      mirrorPromptToVisibleComposer: boolean;
      options: {
        modeOverride: "image";
        toolOverride: "create";
        costOverrideCredits: number | null;
      };
    };

/**
 * Resolves the Standard Create primary action without mutating UI state.
 */
export const resolveStandardCreatePrimaryActionDecision = ({
  enabled = true,
  selectedTool,
  chatModeEnabled,
  agentInput,
  prompt,
  createGenerateCostCredits,
}: {
  enabled?: boolean;
  selectedTool: ToolId | null;
  chatModeEnabled: boolean;
  agentInput: string;
  prompt: string;
  createGenerateCostCredits: number | null;
}): StandardCreatePrimaryActionDecision => {
  if (!enabled) {
    return { kind: "noop" };
  }

  if (!isStandardCreateTextTool(selectedTool)) {
    return { kind: "provider_submit" };
  }

  const visibleComposerPrompt = resolveVisibleStandardComposerPrompt({
    prompt,
    agentInput,
    chatModeEnabled,
  }).trim();

  if (!visibleComposerPrompt) {
    return { kind: "noop" };
  }

  return {
    kind: "generate",
    prompt: visibleComposerPrompt,
    mirrorPromptToVisibleComposer: chatModeEnabled,
    options: {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: createGenerateCostCredits,
    },
  };
};

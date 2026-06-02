/**
 * Standard Create primary action policy.
 * Decides whether the Standard primary submit should generate from the visible
 * composer, fall back to provider submit, or no-op.
 */
import type { AgentAttachment } from "../../../../prefabs/agent";
import type { ToolId } from "../../types";
import { resolveVisibleStandardComposerPrompt } from "./standardCreateComposerState";

const isStandardCreateTextTool = (tool: ToolId | null): boolean =>
  tool === "create" || tool === "text";

export type StandardCreatePrimaryActionDecision =
  | {
      kind: "noop";
      reason:
        | "disabled"
        | "upstream_disabled"
        | "image_attachment_failed"
        | "image_attachment_preparing"
        | "empty_visible_prompt";
    }
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

export type StandardCreatePrimaryActionNoopReason = Extract<
  StandardCreatePrimaryActionDecision,
  { kind: "noop" }
>["reason"];

const resolveImageAttachmentBlockReason = (
  attachments: AgentAttachment[]
): StandardCreatePrimaryActionNoopReason | null => {
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");
  if (
    imageAttachments.some((attachment) => (attachment.deliveryStatus ?? "pending") === "failed")
  ) {
    return "image_attachment_failed";
  }
  if (
    imageAttachments.some((attachment) => (attachment.deliveryStatus ?? "pending") === "preparing")
  ) {
    return "image_attachment_preparing";
  }
  return null;
};

/**
 * Resolves the Standard Create primary action without mutating UI state.
 */
export const resolveStandardCreatePrimaryActionDecision = ({
  enabled = true,
  isGenerateDisabled = false,
  selectedTool,
  chatModeEnabled,
  agentInput,
  prompt,
  createGenerateCostCredits,
  agentAttachments = [],
}: {
  enabled?: boolean;
  isGenerateDisabled?: boolean;
  selectedTool: ToolId | null;
  chatModeEnabled: boolean;
  agentInput: string;
  prompt: string;
  createGenerateCostCredits: number | null;
  agentAttachments?: AgentAttachment[];
}): StandardCreatePrimaryActionDecision => {
  if (!enabled) {
    return { kind: "noop", reason: "disabled" };
  }

  if (isGenerateDisabled) {
    return { kind: "noop", reason: "upstream_disabled" };
  }

  const imageAttachmentBlockReason = resolveImageAttachmentBlockReason(agentAttachments);
  if (imageAttachmentBlockReason) {
    return { kind: "noop", reason: imageAttachmentBlockReason };
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
    return { kind: "noop", reason: "empty_visible_prompt" };
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

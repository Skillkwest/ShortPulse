/**
 * Agent context adapter for AI Studio state.
 * Converts current selection and last-assistant metadata into the canonical agent context shape.
 */
import type {
  AgentContext,
  AgentMediaPreview,
  AgentReferenceSummary,
} from "../../../ai-agent/types";
import type { StudioMode, StudioOutput } from "../../types";
import { isVideoUrl } from "../../logic/stateParsers";

type BuildAiStudioAgentContextParams = {
  selected: StudioOutput | null;
  model: string | null;
  mode: StudioMode;
  lastAssistantMessage?: string | null;
  modeHint?: "chat" | "text" | "describe" | "reference";
};

/**
 * Build the AI Studio agent context from selected output state.
 */
export const buildAiStudioAgentContext = ({
  selected,
  model,
  mode,
  lastAssistantMessage = null,
  modeHint,
}: BuildAiStudioAgentContextParams): AgentContext => {
  const selectedReferenceIds = selected ? [selected.id] : [];

  // Default fallback: rely on the latest assistant output.
  let focusedSource: AgentContext["focusedSource"] = "agent-output";
  let focusedReferenceId: string | null = null;
  let media: AgentMediaPreview[] = [];
  let references: AgentReferenceSummary[] = [];
  let activePromptValue: string | null = null;

  if (selected) {
    focusedReferenceId = selected.id;
    const hasImage = Boolean(
      selected.previewUrl &&
      (selected.mode === "image" || (selected.mode !== "video" && !isVideoUrl(selected.previewUrl)))
    );
    if (hasImage) {
      // Vision-first: supply the selected image for description; keep prompt metadata secondary.
      focusedSource = "image";
      media = [
        {
          id: selected.id,
          kind: "image",
          url: selected.previewUrl as string,
          thumbnailAlt: selected.prompt ?? selected.previewText ?? null,
        },
      ];
      references = [
        {
          id: selected.id,
          kind: "prompt",
          promptSnippet: selected.prompt ?? selected.previewText ?? null,
          aspect: selected.aspect ?? null,
          caption: selected.previewText ?? null,
        },
      ];
    } else {
      // Prompt-selected (includes video cards; we read prompt text, no media).
      focusedSource = "prompt";
      const promptSnippet = selected.prompt ?? selected.previewText ?? null;
      activePromptValue = promptSnippet;
      references = promptSnippet
        ? [
            {
              id: selected.id,
              kind: "prompt",
              promptSnippet,
              aspect: selected.aspect ?? null,
              caption: selected.previewText ?? null,
            },
          ]
        : [];
    }
  } else {
    // No selection: use the last assistant chat message if provided.
    activePromptValue = lastAssistantMessage;
  }

  return {
    activePrompt: activePromptValue,
    modelId: model,
    mode,
    references,
    media,
    selectedReferenceIds,
    focusedSource,
    focusedReferenceId,
    lastAssistantMessage,
    modeHint: modeHint ?? undefined,
  };
};

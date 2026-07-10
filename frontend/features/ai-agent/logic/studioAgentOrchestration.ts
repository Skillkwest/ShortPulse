/**
 * Deterministic input-flow orchestration for AI Studio agent turns.
 * Classifies each turn into TEXT_ONLY, IMAGE_ONLY, or MIXED before thinker/formatter prompts.
 */
import type { AgentContext, AgentMessage } from "../../../prefabs/agent";
import {
  AGENT_THINKER_MAX_IMAGE_REFERENCES,
  AGENT_THINKER_MAX_PROMPT_REFERENCES,
} from "../../../prefabs/agent/attachmentPolicy";
import type { ThinkerSelectedReference } from "./studioAgentReferenceSelection";

export type StudioAgentFlow = "TEXT_ONLY" | "IMAGE_ONLY" | "MIXED";

export type StudioAgentOrchestration = {
  flow: StudioAgentFlow;
  contextType: "agent-output" | "prompt" | "image";
  userInput: string;
  textInput: string;
  imageReferenceIds: string[];
  promptReferenceIds: string[];
  shouldRunTextExpansion: boolean;
  shouldRunVisionDescription: boolean;
  shouldRunFusion: boolean;
};

const IMAGE_ONLY_PATTERNS: RegExp[] = [
  /^describe(?:\s+this|\s+the)?\s*(?:image|photo|reference)?[.!?]*$/i,
  /^what(?:'s| is)\s+in\s+(?:this\s+)?(?:image|photo|reference)\??$/i,
  /^analy[sz]e(?:\s+this|\s+the)?\s*(?:image|photo|reference)?[.!?]*$/i,
];

const clip = (value?: string | null, maxLength = 1200): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const isImageOnlyDirective = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return IMAGE_ONLY_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const isImageReferenceKind = (kind?: string | null): boolean =>
  kind === "image" || kind === "video";

const dedupeStrings = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const resolveLastUserInput = (messages: AgentMessage[]): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      return clip(message.content, 1500);
    }
  }
  return "";
};

const firstPromptSeed = (
  context: AgentContext,
  selectedReferences: ThinkerSelectedReference[]
): string => {
  const selectedPromptSeed =
    selectedReferences.find((reference) => reference.kind === "prompt")?.promptSnippet ?? "";
  if (selectedPromptSeed) return clip(selectedPromptSeed, 1200);

  const contextPromptSeed =
    context.references?.find((reference) => reference.kind === "prompt")?.promptSnippet ?? "";
  return clip(contextPromptSeed, 1200);
};

/**
 * Builds deterministic orchestration metadata used by the studio-agent API route.
 */
export const buildStudioAgentOrchestration = ({
  context,
  messages,
  selectedReferences,
  effectiveCanonical,
}: {
  context: AgentContext;
  messages: AgentMessage[];
  selectedReferences: ThinkerSelectedReference[];
  effectiveCanonical?: string | null;
}): StudioAgentOrchestration => {
  const userInput = resolveLastUserInput(messages);
  const hasSubstantiveText = Boolean(userInput) && !isImageOnlyDirective(userInput);
  const canonicalPrompt = clip(effectiveCanonical, 1200);
  const activePrompt = clip(context.activePrompt, 1200);
  const promptSeed = firstPromptSeed(context, selectedReferences);

  const selectedImageIds = selectedReferences
    .filter((reference) => isImageReferenceKind(reference.kind))
    .map((reference) => reference.id);
  const selectedPromptIds = selectedReferences
    .filter((reference) => reference.kind === "prompt")
    .map((reference) => reference.id);

  const contextImageIds =
    context.references
      ?.filter((reference) => isImageReferenceKind(reference.kind))
      .map((reference) => reference.id) ?? [];
  const contextPromptIds =
    context.references
      ?.filter((reference) => reference.kind === "prompt")
      .map((reference) => reference.id) ?? [];

  const imageReferenceIds = dedupeStrings([...selectedImageIds, ...contextImageIds]).slice(
    0,
    AGENT_THINKER_MAX_IMAGE_REFERENCES
  );
  const promptReferenceIds = dedupeStrings([...selectedPromptIds, ...contextPromptIds]).slice(
    0,
    AGENT_THINKER_MAX_PROMPT_REFERENCES
  );

  const hasImageContext = (context.media?.length ?? 0) > 0 || imageReferenceIds.length > 0;
  const hasPromptContext = Boolean(canonicalPrompt || activePrompt || promptSeed);

  const flow: StudioAgentFlow = hasImageContext
    ? hasSubstantiveText || hasPromptContext
      ? "MIXED"
      : "IMAGE_ONLY"
    : "TEXT_ONLY";

  const textInput = hasSubstantiveText
    ? userInput
    : canonicalPrompt || activePrompt || promptSeed || userInput;

  const contextType: "agent-output" | "prompt" | "image" =
    flow === "IMAGE_ONLY"
      ? "image"
      : hasPromptContext || flow === "MIXED"
        ? "prompt"
        : "agent-output";

  return {
    flow,
    contextType,
    userInput,
    textInput,
    imageReferenceIds,
    promptReferenceIds,
    shouldRunTextExpansion: flow !== "IMAGE_ONLY",
    shouldRunVisionDescription: flow !== "TEXT_ONLY",
    shouldRunFusion: flow === "MIXED",
  };
};

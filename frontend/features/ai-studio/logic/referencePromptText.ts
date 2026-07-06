/**
 * Resolves the visible prompt text attached to a generated reference.
 */
import { stripHiddenVideoShotModePromptPrefix } from "../../../lib/model-runtime/videoShotModePromptVisibility";
import type { StudioOutput } from "../types";

type ReferencePromptSource = Pick<
  StudioOutput,
  "generationReplay" | "workflowReload" | "prompt" | "previewText"
>;

const normalizeVisiblePrompt = (value: string | null | undefined): string => {
  return stripHiddenVideoShotModePromptPrefix(value)?.trim() ?? "";
};

export const resolveStudioOutputReferencePromptText = (output: ReferencePromptSource): string => {
  const candidates = [
    output.generationReplay?.displayPrompt,
    output.workflowReload?.prompt?.display,
    output.prompt,
    output.previewText,
  ];

  for (const candidate of candidates) {
    const resolvedPrompt = normalizeVisiblePrompt(candidate);
    if (resolvedPrompt) return resolvedPrompt;
  }

  return "";
};

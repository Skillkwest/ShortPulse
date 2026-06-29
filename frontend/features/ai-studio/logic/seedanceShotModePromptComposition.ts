/**
 * Seedance-specific hidden shot-mode prompt composition helpers.
 * Keeps Seedance Single/Multi payload direction distinct from Kling wording.
 */
import {
  HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS,
  VIDEO_SHOT_MODE_PROMPT_SEPARATOR,
} from "../../../lib/model-runtime/videoShotModePromptVisibility";

export type SeedanceShotModePromptCompositionMode = "single" | "multi";

export const SEEDANCE_HIDDEN_SHOT_MODE_INSTRUCTIONS: Record<
  SeedanceShotModePromptCompositionMode,
  string
> = HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS.seedance;

/**
 * Prepends the Seedance-specific hidden shot-mode instruction to a user prompt.
 */
export const composeSeedanceHiddenShotModePrompt = ({
  prompt,
  mode,
}: {
  prompt: string;
  mode: SeedanceShotModePromptCompositionMode;
}): string => {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return trimmedPrompt;
  return `${SEEDANCE_HIDDEN_SHOT_MODE_INSTRUCTIONS[mode]}${VIDEO_SHOT_MODE_PROMPT_SEPARATOR}${trimmedPrompt}`;
};

/**
 * Seedance-specific hidden shot-mode prompt composition helpers.
 * Keeps Seedance Single/Multi payload direction distinct from Kling wording.
 */

export type SeedanceShotModePromptCompositionMode = "single" | "multi";

const SEEDANCE_SHOT_MODE_PROMPT_SEPARATOR = "\n\n";

export const SEEDANCE_HIDDEN_SHOT_MODE_INSTRUCTIONS: Record<
  SeedanceShotModePromptCompositionMode,
  string
> = {
  single:
    "Generate this Seedance 2 video as one continuous single shot. Keep the camera, subject, and scene continuous from start to finish; do not add cuts, montage beats, separate scenes, split-screen edits, or storyboard-style transitions. If multiple actions are described, stage them inside one uninterrupted take.",
  multi:
    "Generate this Seedance 2 video as a coherent multi-shot sequence. Use distinct shots or scene beats with intentional cuts or transitions while preserving subject, style, and story continuity across the clip.",
};

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
  return `${SEEDANCE_HIDDEN_SHOT_MODE_INSTRUCTIONS[mode]}${SEEDANCE_SHOT_MODE_PROMPT_SEPARATOR}${trimmedPrompt}`;
};

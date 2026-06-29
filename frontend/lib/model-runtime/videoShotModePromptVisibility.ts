/**
 * Shared hidden shot-mode prompt text and user-facing visibility helpers.
 * Provider payloads may include these prefixes, but customer surfaces must not show them.
 */

export type HiddenVideoShotModeProvider = "kling" | "seedance";
export type HiddenVideoShotMode = "single" | "multi";

export const VIDEO_SHOT_MODE_PROMPT_SEPARATOR = "\n\n";

export const HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS: Record<
  HiddenVideoShotModeProvider,
  Record<HiddenVideoShotMode, string>
> = {
  kling: {
    multi:
      "Create this as a multi-shot sequence with multiple distinct shots or scene beats. Use cuts or shot changes as needed to cover the described action while preserving continuity.",
    single:
      "Create this as one continuous uninterrupted shot only. Do not add cuts, shot changes, montage beats, separate camera setups, or scene breaks. Stage every described action inside one continuous take.",
  },
  seedance: {
    single:
      "Generate this Seedance 2 video as one continuous single shot. Keep the camera, subject, and scene continuous from start to finish; do not add cuts, montage beats, separate scenes, split-screen edits, or storyboard-style transitions. If multiple actions are described, stage them inside one uninterrupted take.",
    multi:
      "Generate this Seedance 2 video as a coherent multi-shot sequence. Use distinct shots or scene beats with intentional cuts or transitions while preserving subject, style, and story continuity across the clip.",
  },
};

const HIDDEN_VIDEO_SHOT_MODE_PREFIXES = Object.values(HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS).flatMap(
  (instructions) => Object.values(instructions)
);

const stripSingleHiddenPrefix = (value: string): string => {
  const normalizedValue = value.trim();
  for (const instruction of HIDDEN_VIDEO_SHOT_MODE_PREFIXES) {
    if (normalizedValue === instruction) return "";
    if (normalizedValue.startsWith(`${instruction}${VIDEO_SHOT_MODE_PROMPT_SEPARATOR}`)) {
      return normalizedValue
        .slice(instruction.length + VIDEO_SHOT_MODE_PROMPT_SEPARATOR.length)
        .trim();
    }
  }
  return normalizedValue;
};

export const stripHiddenVideoShotModePromptPrefix = (
  value: string | null | undefined
): string | null => {
  if (typeof value !== "string") return null;
  let previous = value.trim();
  if (!previous) return null;

  while (true) {
    const next = stripSingleHiddenPrefix(previous);
    if (next === previous) return next || null;
    previous = next;
    if (!previous) return null;
  }
};

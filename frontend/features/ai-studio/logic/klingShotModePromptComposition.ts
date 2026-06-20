/**
 * Shared Kling single-prompt shot-mode composition helpers.
 * Keeps UI limits and submit-time prompt shaping aligned for Single vs Multi modes.
 */
import {
  getAiStudioKlingElementReferenceUrls,
  resolveAiStudioKlingElementLegacyTokens,
  resolveKieKlingElementToken,
  type AiStudioKlingElement,
} from "./klingElements";

export const KLING_SINGLE_PROMPT_MAX_CHARACTERS = 2500;
export const KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS = 500;
const KLING_SINGLE_PROMPT_VISIBLE_MAX_CHARACTERS = 2000;

export type HiddenShotModePromptCompositionMode = "single" | "multi";

const HIDDEN_SHOT_MODE_PROMPT_SEPARATOR = "\n\n";

const HIDDEN_SHOT_MODE_INSTRUCTIONS: Record<HiddenShotModePromptCompositionMode, string> = {
  multi:
    "Create this as a multi-shot sequence with multiple distinct shots or scene beats. Use cuts or shot changes as needed to cover the described action while preserving continuity.",
  single:
    "Create this as one continuous uninterrupted shot only. Do not add cuts, shot changes, montage beats, separate camera setups, or scene breaks. Stage every described action inside one continuous take.",
};

const HIDDEN_SHOT_MODE_RESERVED_CHARACTERS = Math.floor(
  Math.max(
    ...Object.values(HIDDEN_SHOT_MODE_INSTRUCTIONS).map(
      (instruction) => instruction.length + HIDDEN_SHOT_MODE_PROMPT_SEPARATOR.length
    )
  )
);

const resolveHiddenShotModeInstruction = (mode: HiddenShotModePromptCompositionMode): string =>
  HIDDEN_SHOT_MODE_INSTRUCTIONS[mode];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasKlingElementMedia = (element: AiStudioKlingElement): boolean =>
  Boolean(element.videoUrl.trim() || getAiStudioKlingElementReferenceUrls(element).length);

export const composeHiddenShotModePrompt = ({
  prompt,
  mode,
}: {
  prompt: string;
  mode: HiddenShotModePromptCompositionMode;
}): string => {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return trimmedPrompt;
  return `${resolveHiddenShotModeInstruction(mode)}${HIDDEN_SHOT_MODE_PROMPT_SEPARATOR}${trimmedPrompt}`;
};

export const rewritePromptWithKieElementTokens = (
  prompt: string,
  klingElements: AiStudioKlingElement[]
): string => {
  const trimmedPrompt = prompt.trim();
  const availableTokenPairs = klingElements.reduce<
    Array<{ canonicalToken: string; legacyTokens: string[] }>
  >((accumulator, element, index) => {
    if (!hasKlingElementMedia(element)) return accumulator;
    const canonicalToken = resolveKieKlingElementToken(element, index, klingElements).trim();
    if (!canonicalToken) return accumulator;
    const legacyTokens = resolveAiStudioKlingElementLegacyTokens(
      element,
      index,
      klingElements
    ).filter((token) => token.toLowerCase() !== canonicalToken.toLowerCase());
    if (accumulator.some((pair) => pair.canonicalToken === canonicalToken)) return accumulator;
    accumulator.push({ canonicalToken, legacyTokens });
    return accumulator;
  }, []);

  if (!availableTokenPairs.length) return trimmedPrompt;

  let rewrittenPrompt = trimmedPrompt;
  for (const { canonicalToken, legacyTokens } of availableTokenPairs) {
    for (const legacyToken of legacyTokens) {
      const legacyTokenPattern = new RegExp(
        `(^|\\s)@${escapeRegExp(legacyToken)}(?=$|[\\s,.;:!?])`,
        "g"
      );
      rewrittenPrompt = rewrittenPrompt.replace(legacyTokenPattern, `$1@${canonicalToken}`);
    }
  }

  const missingTokens = availableTokenPairs
    .map((pair) => pair.canonicalToken)
    .filter((token) => {
      const tokenPattern = new RegExp(`(^|\\s)@${escapeRegExp(token)}(?=$|[\\s,.;:!?])`);
      return !tokenPattern.test(rewrittenPrompt);
    });

  if (!missingTokens.length) return rewrittenPrompt;
  const suffix = missingTokens.map((token) => `@${token}`).join(" ");
  return rewrittenPrompt ? `${rewrittenPrompt} ${suffix}` : suffix;
};

export const resolveKlingSinglePromptVisibleCharacterLimit = (
  mode: HiddenShotModePromptCompositionMode
): number => {
  void mode;
  return Math.min(
    KLING_SINGLE_PROMPT_VISIBLE_MAX_CHARACTERS,
    Math.max(0, KLING_SINGLE_PROMPT_MAX_CHARACTERS - HIDDEN_SHOT_MODE_RESERVED_CHARACTERS)
  );
};

export const resolveKlingSinglePromptEffectiveVisibleCharacterLimit = ({
  prompt,
  mode,
  klingElements,
}: {
  prompt: string;
  mode: HiddenShotModePromptCompositionMode;
  klingElements: AiStudioKlingElement[];
}): number =>
  Math.max(
    0,
    resolveKlingSinglePromptVisibleCharacterLimit(mode) -
      (rewritePromptWithKieElementTokens(prompt, klingElements).length - prompt.trim().length)
  );

export const isKlingSinglePromptOverComposedLimit = ({
  prompt,
  mode,
}: {
  prompt: string;
  mode: HiddenShotModePromptCompositionMode;
}): boolean =>
  composeHiddenShotModePrompt({ prompt, mode }).length > KLING_SINGLE_PROMPT_MAX_CHARACTERS;

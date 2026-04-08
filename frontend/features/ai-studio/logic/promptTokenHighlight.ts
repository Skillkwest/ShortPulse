/**
 * Prompt token highlight helpers.
 * Builds plain/token segments for mirrored textarea overlays.
 */

export type PromptTokenHighlightSegment = {
  text: string;
  kind: "plain" | "token" | "character-token" | "invalid-token";
};

const PROMPT_TOKEN_REGEX = /@[A-Za-z0-9_-]+/g;

export const buildPromptTokenHighlightSegments = (
  prompt: string
): PromptTokenHighlightSegment[] => {
  const normalizedPrompt = typeof prompt === "string" ? prompt : "";
  if (!normalizedPrompt.length) {
    return [{ text: "", kind: "plain" }];
  }

  const segments: PromptTokenHighlightSegment[] = [];
  let cursor = 0;

  for (const match of normalizedPrompt.matchAll(PROMPT_TOKEN_REGEX)) {
    const token = match[0] ?? "";
    const start = match.index ?? 0;
    const end = start + token.length;

    if (start > cursor) {
      segments.push({
        text: normalizedPrompt.slice(cursor, start),
        kind: "plain",
      });
    }

    segments.push({
      text: token,
      kind: "token",
    });
    cursor = end;
  }

  if (!segments.length) {
    return [{ text: normalizedPrompt, kind: "plain" }];
  }

  if (cursor < normalizedPrompt.length) {
    segments.push({
      text: normalizedPrompt.slice(cursor),
      kind: "plain",
    });
  }

  return segments;
};

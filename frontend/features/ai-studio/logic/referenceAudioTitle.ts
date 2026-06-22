import type { StudioOutput } from "../types";

const AUDIO_FILENAME_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav|webm)(?:$|[?#\s])/i;

const GENERIC_AUDIO_LABELS = new Set([
  "audio reference",
  "canvas audio",
  "media reference",
  "pasted audio",
]);

const normalizeTitleCandidate = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isGenericAudioLabel = (value: string): boolean =>
  GENERIC_AUDIO_LABELS.has(value.trim().toLowerCase());

const isShortSingleLineLabel = (value: string): boolean =>
  value.length <= 160 && !/[\r\n]/.test(value);

/**
 * Resolves the visible title for an audio reference card.
 * Imported files historically use `prompt` as the filename, while generated
 * audio uses prompt text and should only show an explicit title.
 */
export const resolveReferenceAudioDisplayTitle = (
  output: Pick<StudioOutput, "mode" | "title" | "prompt" | "previewText" | "mediaSource">
): string | null => {
  if (output.mode !== "audio") return null;

  const explicitTitle = normalizeTitleCandidate(output.title);
  if (explicitTitle) return explicitTitle;

  const fallbackLabel =
    normalizeTitleCandidate(output.prompt) ?? normalizeTitleCandidate(output.previewText);
  if (!fallbackLabel || isGenericAudioLabel(fallbackLabel)) return null;

  if (AUDIO_FILENAME_PATTERN.test(fallbackLabel)) return fallbackLabel;

  return output.mediaSource === "upload" ||
    output.mediaSource === "library" ||
    output.mediaSource === "clipboard"
    ? isShortSingleLineLabel(fallbackLabel)
      ? fallbackLabel
      : null
    : null;
};

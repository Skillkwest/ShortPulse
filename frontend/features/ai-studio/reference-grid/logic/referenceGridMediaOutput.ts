/**
 * Stable media-slice projection for Reference Grid.
 * Keeps media-relevant equality separate from volatile task-status updates.
 */
import type { StudioOutput } from "../../types";

export type ReferenceGridMediaOutput = Pick<
  StudioOutput,
  | "id"
  | "mode"
  | "title"
  | "mediaSource"
  | "previewText"
  | "previewUrl"
  | "previewPosterUrl"
  | "previewPosterStoragePath"
  | "companionArtUrl"
  | "companionArtStoragePath"
  | "companionArtStatus"
  | "localObjectUrl"
  | "previewStoragePath"
  | "fullStoragePath"
  | "resultUrls"
  | "generationId"
  | "savedMediaIds"
  | "audioSourceMode"
  | "durationMs"
  | "waveformPeaks"
> & {
  isPlaceholderOnly: boolean;
};

const hasResultMedia = (output: StudioOutput): boolean =>
  Array.isArray(output.resultUrls) &&
  output.resultUrls.some((value) => typeof value === "string" && value.trim().length > 0);

const hasSavedMedia = (output: StudioOutput): boolean =>
  Array.isArray(output.savedMediaIds) &&
  output.savedMediaIds.some((value) => typeof value === "string" && value.trim().length > 0);

const areStringArrayValuesEqual = (
  left: readonly string[] | null | undefined,
  right: readonly string[] | null | undefined
) => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const areNumberArrayValuesEqual = (
  left: readonly number[] | null | undefined,
  right: readonly number[] | null | undefined
) => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

export const isReferenceGridPlaceholderOnlyMediaOutput = (output: ReferenceGridMediaOutput) =>
  output.isPlaceholderOnly;

export const projectReferenceGridMediaOutput = (output: StudioOutput): ReferenceGridMediaOutput => {
  const hasPromptOnlyPreview = Boolean(output.previewText?.trim());
  const isPlaceholderOnly =
    !hasPromptOnlyPreview &&
    !output.previewUrl &&
    !output.previewPosterUrl &&
    !output.localObjectUrl &&
    !output.previewPosterStoragePath &&
    !output.previewStoragePath &&
    !output.fullStoragePath &&
    !hasSavedMedia(output) &&
    !output.generationId?.trim() &&
    !hasResultMedia(output);

  return {
    id: output.id,
    mode: output.mode,
    title: output.title,
    mediaSource: output.mediaSource,
    previewText: output.previewText,
    previewUrl: output.previewUrl,
    previewPosterUrl: output.previewPosterUrl,
    previewPosterStoragePath: output.previewPosterStoragePath,
    companionArtUrl: output.companionArtUrl,
    companionArtStoragePath: output.companionArtStoragePath,
    companionArtStatus: output.companionArtStatus,
    localObjectUrl: output.localObjectUrl,
    previewStoragePath: output.previewStoragePath,
    fullStoragePath: output.fullStoragePath,
    resultUrls: output.resultUrls ?? undefined,
    generationId: output.generationId,
    savedMediaIds: output.savedMediaIds ?? undefined,
    audioSourceMode: output.audioSourceMode,
    durationMs: output.durationMs,
    waveformPeaks: output.waveformPeaks ?? undefined,
    isPlaceholderOnly,
  };
};

export const areReferenceGridMediaOutputsEqual = (
  left: readonly ReferenceGridMediaOutput[],
  right: readonly ReferenceGridMediaOutput[]
) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const lhs = left[index];
    const rhs = right[index];
    if (!lhs || !rhs) return false;
    if (
      lhs.id !== rhs.id ||
      lhs.mode !== rhs.mode ||
      lhs.title !== rhs.title ||
      lhs.mediaSource !== rhs.mediaSource ||
      lhs.previewText !== rhs.previewText ||
      lhs.previewUrl !== rhs.previewUrl ||
      lhs.previewPosterUrl !== rhs.previewPosterUrl ||
      lhs.previewPosterStoragePath !== rhs.previewPosterStoragePath ||
      lhs.companionArtUrl !== rhs.companionArtUrl ||
      lhs.companionArtStoragePath !== rhs.companionArtStoragePath ||
      lhs.companionArtStatus !== rhs.companionArtStatus ||
      lhs.localObjectUrl !== rhs.localObjectUrl ||
      lhs.previewStoragePath !== rhs.previewStoragePath ||
      lhs.fullStoragePath !== rhs.fullStoragePath ||
      lhs.generationId !== rhs.generationId ||
      lhs.audioSourceMode !== rhs.audioSourceMode ||
      lhs.durationMs !== rhs.durationMs ||
      lhs.isPlaceholderOnly !== rhs.isPlaceholderOnly
    ) {
      return false;
    }
    if (!areStringArrayValuesEqual(lhs.resultUrls, rhs.resultUrls)) {
      return false;
    }
    if (!areStringArrayValuesEqual(lhs.savedMediaIds, rhs.savedMediaIds)) {
      return false;
    }
    if (!areNumberArrayValuesEqual(lhs.waveformPeaks, rhs.waveformPeaks)) {
      return false;
    }
  }
  return true;
};

export const areReferenceGridMediaOutputEntriesEqual = (
  left: ReferenceGridMediaOutput | null,
  right: ReferenceGridMediaOutput | null
) => {
  if (left === right) return true;
  if (!left || !right) return left === right;
  return areReferenceGridMediaOutputsEqual([left], [right]);
};

/**
 * Stable media-slice projection for Reference Grid.
 * Keeps media-relevant equality separate from volatile task-status updates.
 */
import type { StudioOutput } from "../../types";

export type ReferenceGridMediaOutput = Pick<
  StudioOutput,
  | "id"
  | "mode"
  | "mediaSource"
  | "previewText"
  | "previewUrl"
  | "previewPosterUrl"
  | "previewPosterStoragePath"
  | "localObjectUrl"
  | "previewStoragePath"
  | "fullStoragePath"
  | "resultUrls"
  | "generationId"
  | "savedMediaIds"
> & {
  isPlaceholderOnly: boolean;
};

const hasResultMedia = (output: StudioOutput): boolean =>
  Array.isArray(output.resultUrls) &&
  output.resultUrls.some((value) => typeof value === "string" && value.trim().length > 0);

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
    !hasResultMedia(output);

  return {
    id: output.id,
    mode: output.mode,
    mediaSource: output.mediaSource,
    previewText: output.previewText,
    previewUrl: output.previewUrl,
    previewPosterUrl: output.previewPosterUrl,
    previewPosterStoragePath: output.previewPosterStoragePath,
    localObjectUrl: output.localObjectUrl,
    previewStoragePath: output.previewStoragePath,
    fullStoragePath: output.fullStoragePath,
    resultUrls: output.resultUrls ?? undefined,
    generationId: output.generationId,
    savedMediaIds: output.savedMediaIds ?? undefined,
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
      lhs.mediaSource !== rhs.mediaSource ||
      lhs.previewText !== rhs.previewText ||
      lhs.previewUrl !== rhs.previewUrl ||
      lhs.previewPosterUrl !== rhs.previewPosterUrl ||
      lhs.previewPosterStoragePath !== rhs.previewPosterStoragePath ||
      lhs.localObjectUrl !== rhs.localObjectUrl ||
      lhs.previewStoragePath !== rhs.previewStoragePath ||
      lhs.fullStoragePath !== rhs.fullStoragePath ||
      lhs.generationId !== rhs.generationId ||
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

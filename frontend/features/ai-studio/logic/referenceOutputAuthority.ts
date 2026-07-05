import type { StudioOutput } from "../types";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";

export type ReferenceOutputAuthorityTier = "reusable" | "tracked" | "preview-only";

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

export const hasOutputStoragePaths = (
  output: Pick<StudioOutput, "previewStoragePath" | "fullStoragePath">
): boolean =>
  Boolean(
    asCanonicalStoragePath(output.previewStoragePath) ||
    asCanonicalStoragePath(output.fullStoragePath)
  );

export const hasSavedMediaIds = (output: Pick<StudioOutput, "savedMediaIds">): boolean =>
  Array.isArray(output.savedMediaIds) && output.savedMediaIds.some((id) => hasText(id));

export const hasStorageAuthority = (
  output: Pick<StudioOutput, "previewStoragePath" | "fullStoragePath" | "savedMediaIds">
): boolean => hasOutputStoragePaths(output) || hasSavedMediaIds(output);

export const isGeneratedOutput = (output: Pick<StudioOutput, "mediaSource">): boolean =>
  output.mediaSource === "generated";

export const hasDurableGenerationIdentity = (
  output: Pick<
    StudioOutput,
    "generationId" | "previewStoragePath" | "fullStoragePath" | "savedMediaIds"
  >
): boolean => hasText(output.generationId) || hasStorageAuthority(output);

export const canDragReferenceOutput = (
  output: Pick<
    StudioOutput,
    "mediaSource" | "generationId" | "previewStoragePath" | "fullStoragePath" | "savedMediaIds"
  >
): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasDurableGenerationIdentity(output);
};

export const canExposeDirectReferenceUrls = (
  output: Pick<
    StudioOutput,
    "mediaSource" | "previewStoragePath" | "fullStoragePath" | "savedMediaIds"
  >
): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasOutputStoragePaths(output);
};

export const resolveReferenceOutputAuthorityTier = (
  output: Pick<
    StudioOutput,
    "mediaSource" | "generationId" | "previewStoragePath" | "fullStoragePath" | "savedMediaIds"
  >
): ReferenceOutputAuthorityTier => {
  if (hasStorageAuthority(output)) return "reusable";
  if (hasDurableGenerationIdentity(output)) return "tracked";
  return "preview-only";
};

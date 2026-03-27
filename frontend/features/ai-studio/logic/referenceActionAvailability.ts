import type { StudioOutput } from "../types";

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasSavedMediaIds = (output: StudioOutput): boolean =>
  Array.isArray(output.savedMediaIds) && output.savedMediaIds.some((id) => hasText(id));

const hasStorageAuthority = (output: StudioOutput): boolean =>
  hasText(output.previewStoragePath) || hasText(output.fullStoragePath) || hasSavedMediaIds(output);

const isGeneratedOutput = (output: StudioOutput): boolean => output.mediaSource === "generated";

export const canSaveReferenceOutput = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasText(output.generationId);
};

export const canDownloadReferenceOutput = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasText(output.generationId) || hasStorageAuthority(output);
};

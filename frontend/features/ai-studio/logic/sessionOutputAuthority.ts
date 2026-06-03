import type { StudioOutput } from "../types";

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasStringEntries = (value: readonly string[] | null | undefined): boolean =>
  Array.isArray(value) && value.some((entry) => hasText(entry));

export const hasSettledSessionOutputPayload = (output: StudioOutput): boolean => {
  if (hasStringEntries(output.savedMediaIds)) return true;
  if (hasStringEntries(output.resultUrls)) return true;
  if (hasText(output.previewUrl)) return true;
  if (hasText(output.previewText)) return true;
  if (hasText(output.previewPosterUrl)) return true;
  if (hasText(output.previewPosterStoragePath)) return true;
  if (hasText(output.previewStoragePath)) return true;
  if (hasText(output.fullStoragePath)) return true;
  if (output.mode === "text" && hasText(output.prompt)) return true;
  return false;
};

export const hasRecoverableSessionOutputIdentity = (output: StudioOutput): boolean =>
  hasText(output.generationId) || hasText(output.sourceRef) || hasText(output.taskId);

/**
 * Durable snapshots should never preserve finished media shells that cannot render
 * or recover media. Those records become clickable blank right-rail cards.
 */
export const shouldKeepSessionOutputForDurableRestore = (output: StudioOutput): boolean =>
  hasSettledSessionOutputPayload(output) || hasRecoverableSessionOutputIdentity(output);

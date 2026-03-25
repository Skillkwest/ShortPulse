/**
 * Shared workflow helpers for style-source resolution and create-from-drop payload assembly.
 */
import { buildStyleExtractionMeta, buildStyleProfileFromPrompt } from "../../logic/styleProfile";
import type { StylesLibraryStyleDetails } from "../../types";
import {
  clampStylePromptCharacters,
  normalizeStylePromptFallbackText,
  preprocessStyleImageDataUrl,
  resolveStyleSource,
  type ResolveInternalStyleDrop,
  type StyleDropSnapshot,
} from "./intake";
import type { StyleExtractionOutcome } from "./types";

export type ProcessedResolvedStyleSource = Awaited<ReturnType<typeof resolveStyleSource>> & {
  previewImageUrl: string;
  extractionSourceImageUrl: string;
};

/**
 * Resolves and preprocesses one dropped or uploaded style source for downstream extraction/save.
 */
export const resolveProcessedStyleSource = async ({
  file,
  dropSnapshot,
  resolveInternalStyleDrop,
}: {
  file?: File | null;
  dropSnapshot?: StyleDropSnapshot | null;
  resolveInternalStyleDrop?: ResolveInternalStyleDrop;
}): Promise<ProcessedResolvedStyleSource> => {
  const resolvedSource = await resolveStyleSource({
    file,
    dropSnapshot,
    resolveInternalStyleDrop,
  });
  const processed = await preprocessStyleImageDataUrl(resolvedSource.sourceImageDataUrl);
  return {
    ...resolvedSource,
    previewImageUrl: processed.previewImageUrl,
    extractionSourceImageUrl: processed.extractionSourceImageUrl,
  };
};

/**
 * Builds the persisted style payload for a newly created style.
 */
export const buildCreatedStyleDetails = ({
  styleName,
  extractedStylePrompt,
  previewImageUrl,
  extractionOutcome,
  sourceUrlKind,
}: {
  styleName: string;
  extractedStylePrompt: string;
  previewImageUrl: string;
  extractionOutcome: StyleExtractionOutcome;
  sourceUrlKind: "data" | "url" | "unknown";
}): StylesLibraryStyleDetails => {
  const normalizedStylePrompt = clampStylePromptCharacters(
    normalizeStylePromptFallbackText(extractedStylePrompt)
  );
  return {
    style: styleName,
    title: styleName,
    referenceImageName: styleName,
    stylePrompt: normalizedStylePrompt,
    previewImageUrl,
    styleProfile: buildStyleProfileFromPrompt(normalizedStylePrompt),
    extractionMeta: buildStyleExtractionMeta({
      outcome: extractionOutcome,
      flow: "library_drop",
      sourceUrlKind,
    }),
  };
};

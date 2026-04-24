/**
 * Shared workflow helpers for style-source resolution and create-style payload assembly.
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
import type { StyleExtractionRuntimeResult } from "./types";

export type ProcessedResolvedStyleSource = Awaited<ReturnType<typeof resolveStyleSource>> & {
  previewImageUrl: string;
  extractionSourceImageUrl: string;
};

export type PreparedStyleCreationSource = {
  previewImageUrl: string;
  stylePrompt: string;
  styleTitle: string | null;
  extractionOutcome: StyleExtractionRuntimeResult["outcome"];
  sourceUrlKind: StyleExtractionRuntimeResult["sourceUrlKind"];
  extractionErrorMessage: string | null;
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
 * Normalizes one processed style source plus extraction result for create flows.
 */
export const prepareStyleCreationSource = ({
  resolvedSource,
  extractionResult,
}: {
  resolvedSource: Pick<ProcessedResolvedStyleSource, "promptText" | "previewImageUrl">;
  extractionResult: StyleExtractionRuntimeResult;
}): PreparedStyleCreationSource => {
  const fallbackStylePrompt = normalizeStylePromptFallbackText(resolvedSource.promptText);
  if (
    extractionResult.outcome === "success" &&
    extractionResult.stylePrompt &&
    extractionResult.styleTitle
  ) {
    return {
      previewImageUrl: resolvedSource.previewImageUrl,
      stylePrompt: clampStylePromptCharacters(extractionResult.stylePrompt),
      styleTitle: extractionResult.styleTitle,
      extractionOutcome: extractionResult.outcome,
      sourceUrlKind: extractionResult.sourceUrlKind,
      extractionErrorMessage: null,
    };
  }

  return {
    previewImageUrl: resolvedSource.previewImageUrl,
    stylePrompt: fallbackStylePrompt,
    styleTitle: null,
    extractionOutcome: extractionResult.outcome,
    sourceUrlKind: extractionResult.sourceUrlKind,
    extractionErrorMessage: extractionResult.errorMessage?.trim() || null,
  };
};

/**
 * Builds the persisted style payload for a newly created style.
 */
export const buildCreatedStyleDetails = ({
  styleName,
  preparedSource,
}: {
  styleName: string;
  preparedSource: PreparedStyleCreationSource;
}): StylesLibraryStyleDetails => {
  return {
    style: styleName,
    title: styleName,
    referenceImageName: styleName,
    stylePrompt: preparedSource.stylePrompt,
    previewImageUrl: preparedSource.previewImageUrl,
    styleProfile: buildStyleProfileFromPrompt(preparedSource.stylePrompt),
    extractionMeta: buildStyleExtractionMeta({
      outcome: preparedSource.extractionOutcome,
      flow: "library_drop",
      sourceUrlKind: preparedSource.sourceUrlKind,
    }),
  };
};

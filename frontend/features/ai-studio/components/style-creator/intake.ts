/**
 * Styles-library intake and create-source preparation helpers.
 * Exposes the stable style-creator utilities used by the controller and tests.
 */
import type { StylesLibraryStyleDetails } from "../../types";
import { CUSTOM_STYLE_NAME_PREFIX, STYLE_PROMPT_MAX_CHARACTERS } from "./constants";
import type {
  PendingStyleEditState,
  ResolvedDroppedStylePreview,
  StyleExtractionRuntimeResult,
} from "./types";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import {
  reorderStylesLibraryOrderedIds,
  type StylesLibraryReorderPlacement,
} from "../../logic/stylesLibraryCatalog";
import {
  buildStyleDropSnapshotTransfer,
  canAcceptStyleLibraryImageDropHint,
  captureStyleDropSnapshot,
  type StyleDropSnapshot,
} from "./styleSourceCapture";
import {
  cropImageDataUrlToSquareDataUrl,
  preprocessStyleImageDataUrl,
  readFileAsDataUrl,
  resizeImageDataUrlForExtraction,
} from "./styleImageDerivation";
import {
  getStyleDropPreviewCandidateCount,
  getStyleDropPreviewClassifierReason,
  getStyleDropPreviewResolutionReason,
  getStyleDropPreviewResolutionStage,
  isImageFileCandidate,
  normalizeStyleDropPreviewError,
  normalizeStylePromptFallbackText,
  resolveStyleSource,
} from "./styleSourceNormalization";
import type { ResolveInternalStyleDrop, ResolvedInternalStyleSource } from "./styleSourceResolver";

export type { StyleDropSnapshot, ResolveInternalStyleDrop, ResolvedInternalStyleSource };
export {
  buildStyleDropSnapshotTransfer,
  canAcceptStyleLibraryImageDropHint,
  captureStyleDropSnapshot,
  cropImageDataUrlToSquareDataUrl,
  getStyleDropPreviewCandidateCount,
  getStyleDropPreviewClassifierReason,
  getStyleDropPreviewResolutionReason,
  getStyleDropPreviewResolutionStage,
  isImageFileCandidate,
  normalizeStyleDropPreviewError,
  normalizeStylePromptFallbackText,
  preprocessStyleImageDataUrl,
  readFileAsDataUrl,
  resizeImageDataUrlForExtraction,
  resolveStyleSource,
};

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
 * Reorders an id list by moving source id around target id.
 */
export const reorderById = (
  ids: readonly string[],
  sourceId: string,
  targetId: string,
  placement?: StylesLibraryReorderPlacement
): string[] => reorderStylesLibraryOrderedIds(ids, sourceId, targetId, placement);

/**
 * Builds style detail defaults from an existing catalog tile.
 */
export const buildInitialStyleDetails = (style: ExpertEditStyleTile): StylesLibraryStyleDetails => {
  const resolvedTitle = style.title.trim();
  const resolvedStyle = style.style?.trim() || resolvedTitle;
  const resolvedReferenceImageName = style.referenceImageName?.trim() || resolvedTitle;
  return {
    style: resolvedStyle,
    title: resolvedTitle,
    referenceImageName: resolvedReferenceImageName,
    stylePrompt: style.stylePrompt?.trim() ?? "",
    previewImageUrl: style.previewUrl?.trim() ?? "",
  };
};

/**
 * Builds a new-style draft with default values.
 */
export const buildNewStyleDetails = (styleName: string): StylesLibraryStyleDetails => ({
  style: styleName,
  title: styleName,
  referenceImageName: styleName,
  stylePrompt: "",
  previewImageUrl: "",
});

/**
 * Enforces the style prompt max character budget.
 */
export const clampStylePromptCharacters = (value: string): string => {
  if (value.length <= STYLE_PROMPT_MAX_CHARACTERS) return value;
  return value.slice(0, STYLE_PROMPT_MAX_CHARACTERS);
};

/**
 * Normalizes a draft before save.
 */
export const normalizeStyleDetailsDraft = (
  value: StylesLibraryStyleDetails
): StylesLibraryStyleDetails => ({
  ...value,
  style: value.style.trim(),
  title: value.title.trim(),
  referenceImageName: value.referenceImageName.trim(),
  stylePrompt: clampStylePromptCharacters(value.stylePrompt.trim()),
  previewImageUrl: value.previewImageUrl.trim(),
});

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
  };
};

/**
 * Resolves a drop payload into preview + extraction source URLs.
 */
export const resolveDroppedStylePreview = async (
  transfer: DataTransfer,
  options?: { resolveInternalStyleDrop?: ResolveInternalStyleDrop }
): Promise<ResolvedDroppedStylePreview> => {
  const resolvedSource = await resolveStyleSource({
    dropSnapshot: captureStyleDropSnapshot(transfer),
    resolveInternalStyleDrop: options?.resolveInternalStyleDrop,
  });
  const processed = await preprocessStyleImageDataUrl(resolvedSource.sourceImageDataUrl);
  return {
    previewImageUrl: processed.previewImageUrl,
    extractionSourceImageUrl: processed.extractionSourceImageUrl,
    promptText: resolvedSource.promptText,
  };
};

/**
 * Applies a preview URL to pending style-edit state.
 */
export const applyStylePreviewToPendingEdit = (
  previous: PendingStyleEditState | null,
  previewImageUrl: string
): PendingStyleEditState | null => {
  if (!previous) return previous;
  return {
    ...previous,
    details: {
      ...previous.details,
      previewImageUrl,
    },
  };
};

/**
 * Builds the next deterministic custom style name.
 */
export const buildNextCustomStyleName = (styles: readonly ExpertEditStyleTile[]): string => {
  const existingNameSet = new Set(
    styles
      .filter((style) => !style.placeholder)
      .map((style) => (style.style?.trim() || style.title.trim()).toLowerCase())
      .filter(Boolean)
  );
  let candidateIndex = 1;
  while (existingNameSet.has(`${CUSTOM_STYLE_NAME_PREFIX} ${candidateIndex}`.toLowerCase())) {
    candidateIndex += 1;
  }
  return `${CUSTOM_STYLE_NAME_PREFIX} ${candidateIndex}`;
};

/**
 * Returns true when a style name is still default-generated.
 */
export const isDefaultCustomStyleName = (value: string): boolean =>
  /^Custom Style \d+$/i.test(value.trim());

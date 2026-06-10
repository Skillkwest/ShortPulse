/**
 * Stateful controller for styles-library creator/edit/delete workflows.
 * Keeps side effects and domain logic out of presentational panel markup.
 */
import React from "react";
import { postExtractStyle } from "../../logic/styleExtraction";
import {
  isStylePreviewGenerationError,
  postGenerateStylePreview,
} from "../../logic/stylePreviewGeneration";
import type { StylesLibraryStyleDetails } from "../../types";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import {
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
} from "../../utils/dragDrop";
import {
  BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE,
  EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
  EXPIRED_STYLE_IMAGE_SOURCE_MESSAGE,
} from "./constants";
import { buildExtractionFailureResult } from "./extraction";
import {
  applyStylePreviewToPendingEdit,
  buildStyleDropSnapshotTransfer,
  buildInitialStyleDetails,
  buildNewStyleDetails,
  buildNextCustomStyleName,
  canAcceptStyleLibraryImageDropHint,
  captureStyleDropSnapshot,
  clampStylePromptCharacters,
  getStyleDropPreviewCandidateCount,
  isDefaultCustomStyleName,
  isImageFileCandidate,
  getStyleDropPreviewResolutionReason,
  getStyleDropPreviewResolutionStage,
  normalizeStyleDropPreviewError,
  normalizeStyleDetailsDraft,
  type StyleDropSnapshot,
  type ResolveInternalStyleDrop,
  reorderById,
} from "./intake";
import { trackStyleExtractionOutcome, trackStyleSourceResolutionDiagnostic } from "./telemetry";
import {
  buildCreatedStyleDetails,
  prepareStyleCreationSource,
  resolveProcessedStyleSource,
  type ProcessedResolvedStyleSource,
} from "./intake";
import type {
  PendingStyleEditState,
  StyleExtractionFailureClass,
  StyleExtractionRuntimeResult,
} from "./types";

type UseStyleCreatorControllerParams = {
  styles: readonly ExpertEditStyleTile[];
  onReorderStyle?: (sourceStyleId: string, targetStyleId: string) => Promise<void> | void;
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
  resolveInternalStyleDrop?: ResolveInternalStyleDrop;
};

type TrackedStyleExtractionParams = {
  flow: "create_modal" | "library_drop";
  sourceImageUrl: string;
};

const toPersistableStyleDetails = (
  details: StylesLibraryStyleDetails
): StylesLibraryStyleDetails => ({
  style: details.style,
  title: details.title,
  referenceImageName: details.referenceImageName,
  stylePrompt: details.stylePrompt,
  previewImageUrl: details.previewImageUrl,
});

const resolveSourceUrlKind = (url: string): "data" | "url" | "unknown" => {
  if (url.startsWith("data:")) return "data";
  if (url.startsWith("http://") || url.startsWith("https://")) return "url";
  return "unknown";
};

const normalizeResultErrorMessage = (errorMessage: string | undefined): string => {
  if (!errorMessage?.trim()) {
    return "Style extraction failed. You can still enter the style prompt manually.";
  }
  return errorMessage;
};

const runDeleteStyleCommand = async ({
  styleId,
  onDeleteStyle,
}: {
  styleId: string;
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
}): Promise<boolean> => {
  if (!onDeleteStyle || !styleId.trim()) return false;
  try {
    return Boolean(await onDeleteStyle(styleId));
  } catch {
    return false;
  }
};

const runSaveStyleDetailsCommand = async ({
  styleId,
  details,
  onSaveStyleDetails,
}: {
  styleId: string;
  details: StylesLibraryStyleDetails;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
}): Promise<boolean> => {
  if (!onSaveStyleDetails || !styleId.trim()) return false;
  try {
    return Boolean(await onSaveStyleDetails(styleId, details));
  } catch {
    return false;
  }
};

const resolveTelemetryFailureClass = (
  result: Pick<StyleExtractionRuntimeResult, "outcome" | "failureClass">
): StyleExtractionFailureClass => {
  if (result.failureClass) return result.failureClass;
  if (result.outcome === "blocked_source" || result.outcome === "fallback") {
    return result.outcome;
  }
  return "unknown";
};

const classifyTransferredUrlKind = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "missing";
  if (/^data:image\//i.test(trimmed)) return "data_image";
  if (/^blob:/i.test(trimmed)) return "blob";
  if (typeof window !== "undefined") {
    try {
      const parsed = new URL(trimmed, window.location.href);
      if (parsed.pathname === "/_next/image" && parsed.origin === window.location.origin) {
        return "same_origin_next_image";
      }
      if (parsed.origin === window.location.origin) return "same_origin_url";
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return "remote_url";
    } catch {
      return "other";
    }
  }
  return /^https?:\/\//i.test(trimmed) ? "remote_url" : "other";
};

const classifyPlainTextKind = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "missing";
  if (/^(?:data:image\/|blob:|https?:\/\/|\/)/i.test(trimmed)) {
    return classifyTransferredUrlKind(trimmed);
  }
  return "text";
};

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
};

const countRawSnapshotUrlSeeds = (
  dropSnapshot: StyleDropSnapshot,
  composerPayload?: { displayArtifactUrl?: string | null; referenceUrl?: string | null } | null
): number => {
  const uriListValue = dropSnapshot.uriList
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0 && !item.startsWith("#"));
  const plainText = dropSnapshot.plainText.trim();
  return [
    composerPayload?.displayArtifactUrl ?? null,
    dropSnapshot.referenceRenderUrl,
    dropSnapshot.imageUrl,
    composerPayload?.referenceUrl ?? null,
    dropSnapshot.referenceUrl,
    uriListValue ?? null,
    /^(?:data:image\/|blob:|https?:\/\/|\/)/i.test(plainText) ? plainText : null,
  ].reduce((count, value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed ? count + 1 : count;
  }, 0);
};

const trackStyleSourceDiagnosticFromSnapshot = ({
  dropSnapshot,
  flow,
  outcome,
  resolvedSourceKind,
  resolutionStage,
  resolutionReason,
  candidateCount,
  internalPayloadPresent,
  errorMessage,
}: {
  dropSnapshot: StyleDropSnapshot;
  flow: "create_modal" | "library_drop";
  outcome: "resolved" | "blocked_source";
  resolvedSourceKind?: "file" | "internal" | "external" | null;
  resolutionStage?: "primary" | "server_copy_fallback" | null;
  resolutionReason?: string | null;
  candidateCount?: number | null;
  internalPayloadPresent?: boolean | null;
  errorMessage?: string;
}) => {
  const transferLikeSnapshot = buildStyleDropSnapshotTransfer(dropSnapshot);
  const internalPayload = extractInternalReferenceDragPayload(transferLikeSnapshot);
  const composerPayload = extractComposerImageDropPayload(transferLikeSnapshot);
  trackStyleSourceResolutionDiagnostic({
    flow,
    outcome,
    resolvedSourceKind: resolvedSourceKind ?? null,
    internalPayloadPresent:
      typeof internalPayloadPresent === "boolean"
        ? internalPayloadPresent
        : Boolean(internalPayload),
    internalDragTokenPresent: Boolean(dropSnapshot.internalReferenceDragToken.trim()),
    rawSnapshotSeedCount: countRawSnapshotUrlSeeds(dropSnapshot, composerPayload),
    transferTypes: dropSnapshot.transferTypes,
    referenceOrigin:
      normalizeOptionalText(internalPayload?.origin) ??
      normalizeOptionalText(dropSnapshot.referenceOrigin),
    referenceOutputId:
      normalizeOptionalText(internalPayload?.outputId) ??
      normalizeOptionalText(internalPayload?.referenceId) ??
      normalizeOptionalText(dropSnapshot.referenceOutputId),
    referenceMediaId:
      normalizeOptionalText(internalPayload?.mediaId) ??
      normalizeOptionalText(dropSnapshot.referenceMediaId),
    referenceImageIndex: (() => {
      const parsed =
        typeof internalPayload?.imageIndex === "number"
          ? internalPayload.imageIndex
          : Number.parseInt(dropSnapshot.referenceImageIndex.trim(), 10);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    referenceSourceSurface:
      normalizeOptionalText(internalPayload?.sourceSurface) ??
      normalizeOptionalText(dropSnapshot.referenceSourceSurface),
    referenceUrlKind: classifyTransferredUrlKind(dropSnapshot.referenceUrl),
    referenceRenderUrlKind: classifyTransferredUrlKind(dropSnapshot.referenceRenderUrl),
    imageUrlKind: classifyTransferredUrlKind(dropSnapshot.imageUrl),
    plainTextKind: classifyPlainTextKind(dropSnapshot.plainText),
    resolutionStage: resolutionStage ?? null,
    resolutionReason: resolutionReason ?? null,
    candidateCount: candidateCount ?? null,
    errorMessage,
  });
};

/**
 * Returns the full styles-library creator/edit/delete state machine contract.
 */
export const useStyleCreatorController = ({
  styles,
  onReorderStyle,
  onDeleteStyle,
  onSaveStyleDetails,
  resolveInternalStyleDrop,
}: UseStyleCreatorControllerParams) => {
  const stylesLibraryDropDepthRef = React.useRef(0);
  const customStyleIdCounterRef = React.useRef(0);
  const stylePromptExtractionRequestIdRef = React.useRef(0);
  const stylePreviewGenerationPendingRef = React.useRef(new Set<string>());

  const [orderedStyleIds, setOrderedStyleIds] = React.useState<string[]>([]);
  const [draggedStyleId, setDraggedStyleId] = React.useState<string | null>(null);
  const [dropTargetStyleId, setDropTargetStyleId] = React.useState<string | null>(null);
  const [pendingDeleteStyle, setPendingDeleteStyle] = React.useState<ExpertEditStyleTile | null>(
    null
  );
  const [pendingStyleEdit, setPendingStyleEdit] = React.useState<PendingStyleEditState | null>(
    null
  );
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [createStyleFromDropSubmitting, setCreateStyleFromDropSubmitting] = React.useState(false);
  const [stylesLibraryDropActive, setStylesLibraryDropActive] = React.useState(false);
  const [stylePreviewDropActive, setStylePreviewDropActive] = React.useState(false);
  const [localDeleteError, setLocalDeleteError] = React.useState<string | null>(null);
  const [localSaveError, setLocalSaveError] = React.useState<string | null>(null);
  const [stylesLibraryDropError, setStylesLibraryDropError] = React.useState<string | null>(null);
  const [stylePreviewGenerationStyleIds, setStylePreviewGenerationStyleIds] = React.useState<
    string[]
  >([]);
  const [stylePreviewGenerationError, setStylePreviewGenerationError] = React.useState<
    string | null
  >(null);
  const [stylePromptExtractionSubmitting, setStylePromptExtractionSubmitting] =
    React.useState(false);
  const [stylePromptExtractionError, setStylePromptExtractionError] = React.useState<string | null>(
    null
  );

  const renderedStyles = React.useMemo(() => {
    if (styles.length === 0) return styles;
    if (orderedStyleIds.length === 0) return styles;
    const byId = new Map(styles.map((style) => [style.id, style] as const));
    const ordered = orderedStyleIds
      .map((styleId) => byId.get(styleId))
      .filter((style): style is ExpertEditStyleTile => Boolean(style));
    return ordered.length === styles.length ? ordered : styles;
  }, [styles, orderedStyleIds]);

  const pendingEditPreviewImageUrl = pendingStyleEdit?.details.previewImageUrl?.trim() ?? "";

  const setStylePreviewGenerationPending = React.useCallback(
    (styleId: string, pending: boolean) => {
      const nextPending = stylePreviewGenerationPendingRef.current;
      if (pending) {
        nextPending.add(styleId);
      } else {
        nextPending.delete(styleId);
      }
      setStylePreviewGenerationStyleIds(Array.from(nextPending));
    },
    []
  );

  const closeDeleteModal = React.useCallback(() => {
    if (deleteSubmitting) return;
    setPendingDeleteStyle(null);
    setLocalDeleteError(null);
  }, [deleteSubmitting]);

  const closeEditModal = React.useCallback(() => {
    if (editSubmitting) return;
    stylePromptExtractionRequestIdRef.current += 1;
    setPendingStyleEdit(null);
    setStylePreviewDropActive(false);
    setLocalSaveError(null);
    setStylePromptExtractionSubmitting(false);
    setStylePromptExtractionError(null);
  }, [editSubmitting]);

  const dismissStylesLibraryDropError = React.useCallback(() => {
    setStylesLibraryDropError(null);
  }, []);

  const dismissStylePreviewGenerationError = React.useCallback(() => {
    setStylePreviewGenerationError(null);
  }, []);

  const applyExtractedStyleToCreateDraft = React.useCallback(
    ({ stylePrompt, styleTitle }: { stylePrompt: string; styleTitle: string }) => {
      setPendingStyleEdit((previous) => {
        if (!previous || previous.mode !== "create") return previous;
        const clampedStylePrompt = clampStylePromptCharacters(stylePrompt);
        const currentStyleName = previous.details.style.trim();
        const shouldReplaceStyleName =
          !currentStyleName.length || isDefaultCustomStyleName(currentStyleName);
        return {
          ...previous,
          styleTitle: shouldReplaceStyleName ? styleTitle : previous.styleTitle,
          details: {
            ...previous.details,
            stylePrompt: clampedStylePrompt,
            style: shouldReplaceStyleName ? styleTitle : previous.details.style,
            title: shouldReplaceStyleName ? styleTitle : previous.details.title,
            referenceImageName: shouldReplaceStyleName
              ? styleTitle
              : previous.details.referenceImageName,
          },
        };
      });
    },
    []
  );

  const runStyleExtraction = React.useCallback(
    async (sourceImageUrl: string): Promise<StyleExtractionRuntimeResult> => {
      try {
        const extracted = await postExtractStyle(sourceImageUrl);
        return {
          outcome: "success" as const,
          sourceUrlKind: resolveSourceUrlKind(sourceImageUrl),
          stylePrompt: extracted.stylePrompt,
          styleTitle: extracted.styleTitle,
          attemptCount: extracted.attemptCount,
          probeMs: extracted.probeMs,
          openAiMs: extracted.openAiMs,
          totalMs: extracted.totalMs,
          modelUsed: extracted.modelUsed,
        };
      } catch (error) {
        return buildExtractionFailureResult(error);
      }
    },
    []
  );

  const runTrackedStyleExtraction = React.useCallback(
    async ({
      flow,
      sourceImageUrl,
    }: TrackedStyleExtractionParams): Promise<StyleExtractionRuntimeResult> => {
      const result = await runStyleExtraction(sourceImageUrl);
      if (result.outcome === "success" && result.stylePrompt && result.styleTitle) {
        trackStyleExtractionOutcome("success", flow, {
          stage: "extract",
          sourceUrlKind: result.sourceUrlKind,
          attemptCount: result.attemptCount ?? null,
          probeMs: result.probeMs ?? null,
          openAiMs: result.openAiMs ?? null,
          totalMs: result.totalMs ?? null,
          modelUsed: result.modelUsed ?? null,
        });
        return result;
      }

      trackStyleExtractionOutcome(result.outcome, flow, {
        stage: "extract",
        sourceUrlKind: result.sourceUrlKind,
        failureClass: resolveTelemetryFailureClass(result),
        errorMessage: result.errorMessage,
        attemptCount: result.attemptCount ?? null,
        probeMs: result.probeMs ?? null,
        openAiMs: result.openAiMs ?? null,
        totalMs: result.totalMs ?? null,
        modelUsed: result.modelUsed ?? null,
      });
      return result;
    },
    [runStyleExtraction]
  );

  const processResolvedStyleSource = React.useCallback(
    async ({
      flow,
      resolvedSource,
    }: {
      flow: "create_modal" | "library_drop";
      resolvedSource: ProcessedResolvedStyleSource;
    }) =>
      prepareStyleCreationSource({
        resolvedSource,
        extractionResult: await runTrackedStyleExtraction({
          flow,
          sourceImageUrl: resolvedSource.extractionSourceImageUrl,
        }),
      }),
    [runTrackedStyleExtraction]
  );

  const handleBlockedStyleDropError = React.useCallback(
    ({
      error,
      dropSnapshot,
      flow,
      onMissingDroppedImage,
      onExpiredSource,
      onBlockedSource,
    }: {
      error: unknown;
      dropSnapshot: StyleDropSnapshot;
      flow: "create_modal" | "library_drop";
      onMissingDroppedImage: () => void;
      onExpiredSource: () => void;
      onBlockedSource: () => void;
    }) => {
      const normalizedError = normalizeStyleDropPreviewError(error);
      const resolutionStage = getStyleDropPreviewResolutionStage(error);
      const resolutionReason = getStyleDropPreviewResolutionReason(error);
      const candidateCount = getStyleDropPreviewCandidateCount(error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : normalizedError.code === "missing-dropped-style-image"
            ? "missing-dropped-style-image"
            : normalizedError.code === EXPIRED_STYLE_IMAGE_SOURCE_ERROR
              ? EXPIRED_STYLE_IMAGE_SOURCE_ERROR
              : "blocked-style-image-source";

      trackStyleSourceDiagnosticFromSnapshot({
        dropSnapshot,
        flow,
        outcome: "blocked_source",
        resolutionStage,
        resolutionReason,
        candidateCount,
        errorMessage,
      });

      if (normalizedError.code === "missing-dropped-style-image") {
        onMissingDroppedImage();
        return;
      }

      trackStyleExtractionOutcome("blocked_source", flow, {
        stage: "preview_source",
        failureClass: "blocked_source",
        classifierReason: normalizedError.classifierReason,
        resolutionStage,
        resolutionReason,
        candidateCount,
        errorMessage: error instanceof Error ? error.message : "unknown_error",
      });

      if (normalizedError.code === EXPIRED_STYLE_IMAGE_SOURCE_ERROR) {
        onExpiredSource();
        return;
      }

      onBlockedSource();
    },
    []
  );

  const applyResolvedSourceToCreateDraft = React.useCallback(
    async (resolvedSource: ProcessedResolvedStyleSource) => {
      const requestId = ++stylePromptExtractionRequestIdRef.current;
      setPendingStyleEdit((previous) =>
        applyStylePreviewToPendingEdit(previous, resolvedSource.previewImageUrl)
      );
      setStylePromptExtractionSubmitting(true);
      setStylePromptExtractionError(null);

      const preparedSource = await processResolvedStyleSource({
        flow: "create_modal",
        resolvedSource,
      });
      if (stylePromptExtractionRequestIdRef.current !== requestId) return;

      if (preparedSource.styleTitle) {
        applyExtractedStyleToCreateDraft({
          stylePrompt: preparedSource.stylePrompt,
          styleTitle: preparedSource.styleTitle,
        });
      } else {
        setStylePromptExtractionError(
          normalizeResultErrorMessage(preparedSource.extractionErrorMessage ?? undefined)
        );
      }

      if (stylePromptExtractionRequestIdRef.current === requestId) {
        setStylePromptExtractionSubmitting(false);
      }
    },
    [applyExtractedStyleToCreateDraft, processResolvedStyleSource]
  );

  const applyStylePreviewFromTransfer = React.useCallback(
    async (dropSnapshot: StyleDropSnapshot) => {
      setLocalSaveError(null);
      try {
        const resolvedSource = await resolveProcessedStyleSource({
          dropSnapshot,
          resolveInternalStyleDrop,
        });
        trackStyleSourceDiagnosticFromSnapshot({
          dropSnapshot,
          flow: "create_modal",
          outcome: "resolved",
          resolvedSourceKind: resolvedSource.kind,
          internalPayloadPresent: resolvedSource.internalPayloadPresent,
          resolutionStage: resolvedSource.resolutionStage,
          resolutionReason: resolvedSource.resolutionReason,
          candidateCount: resolvedSource.candidateCount,
        });
        void applyResolvedSourceToCreateDraft(resolvedSource);
      } catch (error) {
        handleBlockedStyleDropError({
          error,
          dropSnapshot,
          flow: "create_modal",
          onMissingDroppedImage: () => setLocalSaveError("Please drop an image reference."),
          onExpiredSource: () => setLocalSaveError(EXPIRED_STYLE_IMAGE_SOURCE_MESSAGE),
          onBlockedSource: () => setLocalSaveError(BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE),
        });
      }
    },
    [applyResolvedSourceToCreateDraft, handleBlockedStyleDropError, resolveInternalStyleDrop]
  );

  const applyStylePreviewFile = React.useCallback(
    async (file: File) => {
      setLocalSaveError(null);
      try {
        const processed = await resolveProcessedStyleSource({ file });
        void applyResolvedSourceToCreateDraft(processed);
      } catch (error) {
        const normalizedError = normalizeStyleDropPreviewError(error);
        if (normalizedError.code === "missing-dropped-style-image" && !isImageFileCandidate(file)) {
          setLocalSaveError("Please drop an image file.");
          return;
        }
        setLocalSaveError("Unable to process that image.");
      }
    },
    [applyResolvedSourceToCreateDraft]
  );

  const createStyleFromDrop = React.useCallback(
    async (dropSnapshot: StyleDropSnapshot) => {
      if (createStyleFromDropSubmitting) return;
      setCreateStyleFromDropSubmitting(true);
      setStylesLibraryDropError(null);
      setStylePreviewGenerationError(null);
      try {
        const resolvedSource = await resolveProcessedStyleSource({
          dropSnapshot,
          resolveInternalStyleDrop,
        });
        trackStyleSourceDiagnosticFromSnapshot({
          dropSnapshot,
          flow: "library_drop",
          outcome: "resolved",
          resolvedSourceKind: resolvedSource.kind,
          internalPayloadPresent: resolvedSource.internalPayloadPresent,
          resolutionStage: resolvedSource.resolutionStage,
          resolutionReason: resolvedSource.resolutionReason,
          candidateCount: resolvedSource.candidateCount,
        });
        const preparedSource = await processResolvedStyleSource({
          flow: "library_drop",
          resolvedSource,
        });

        if (preparedSource.extractionErrorMessage) {
          const detail = preparedSource.extractionErrorMessage || "Style extraction could not run.";
          setStylesLibraryDropError(`${detail} Style created anyway; you can edit the prompt.`);
        }

        if (!onSaveStyleDetails) {
          setStylesLibraryDropError("Style saving is unavailable right now.");
          return;
        }

        const customStyleName =
          preparedSource.styleTitle?.trim() || buildNextCustomStyleName(styles);
        customStyleIdCounterRef.current += 1;
        const customStyleId = `style-library-custom-${Date.now()}-${customStyleIdCounterRef.current}`;
        const saved = await runSaveStyleDetailsCommand({
          styleId: customStyleId,
          onSaveStyleDetails,
          details: toPersistableStyleDetails(
            buildCreatedStyleDetails({
              styleName: customStyleName,
              preparedSource,
            })
          ),
        });
        if (!saved) {
          setStylesLibraryDropError("Unable to create this style right now.");
          return;
        }
      } catch (error) {
        handleBlockedStyleDropError({
          error,
          dropSnapshot,
          flow: "library_drop",
          onMissingDroppedImage: () =>
            setStylesLibraryDropError(
              "Drop an image from your computer, Reference Grid, or Quick Slot Inventory."
            ),
          onExpiredSource: () => setStylesLibraryDropError(EXPIRED_STYLE_IMAGE_SOURCE_MESSAGE),
          onBlockedSource: () => setStylesLibraryDropError(BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE),
        });
      } finally {
        setCreateStyleFromDropSubmitting(false);
      }
    },
    [
      createStyleFromDropSubmitting,
      handleBlockedStyleDropError,
      onSaveStyleDetails,
      processResolvedStyleSource,
      resolveInternalStyleDrop,
      styles,
    ]
  );

  const runStylePreviewGeneration = React.useCallback(
    async ({ styleId, details }: { styleId: string; details: StylesLibraryStyleDetails }) => {
      if (!onSaveStyleDetails || stylePreviewGenerationPendingRef.current.has(styleId)) return;
      const styleName = details.style.trim();
      const stylePrompt = details.stylePrompt.trim();
      if (!styleId.trim() || !styleName || !stylePrompt || details.previewImageUrl.trim()) return;

      setStylePreviewGenerationPending(styleId, true);
      setStylePreviewGenerationError(null);
      try {
        const generatedPreview = await postGenerateStylePreview({
          styleId,
          styleName,
          stylePrompt,
        });
        const previewImageUrl = generatedPreview.previewImageUrl.trim();
        const saved = await runSaveStyleDetailsCommand({
          styleId,
          onSaveStyleDetails,
          details: toPersistableStyleDetails({
            ...details,
            previewImageUrl,
          }),
        });
        if (!saved) {
          setStylePreviewGenerationError(
            "Style preview generated, but could not be saved. Reopen the style or try again."
          );
        }
      } catch (error) {
        const detail = isStylePreviewGenerationError(error)
          ? error.userMessage
          : "Style preview generation failed.";
        setStylePreviewGenerationError(
          `Style saved, but ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`
        );
      } finally {
        setStylePreviewGenerationPending(styleId, false);
      }
    },
    [onSaveStyleDetails, setStylePreviewGenerationPending]
  );

  const handleStylesLibraryDragEnter = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!canAcceptStyleLibraryImageDropHint(event.dataTransfer)) return;
    event.preventDefault();
    stylesLibraryDropDepthRef.current += 1;
    setStylesLibraryDropActive(true);
    setStylesLibraryDropError(null);
  }, []);

  const handleStylesLibraryDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!canAcceptStyleLibraryImageDropHint(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setStylesLibraryDropActive(true);
  }, []);

  const handleStylesLibraryDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!canAcceptStyleLibraryImageDropHint(event.dataTransfer)) return;
    event.preventDefault();
    stylesLibraryDropDepthRef.current = Math.max(0, stylesLibraryDropDepthRef.current - 1);
    if (stylesLibraryDropDepthRef.current === 0) {
      setStylesLibraryDropActive(false);
    }
  }, []);

  const handleStylesLibraryDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptStyleLibraryImageDropHint(event.dataTransfer)) return;
      event.preventDefault();
      stylesLibraryDropDepthRef.current = 0;
      setStylesLibraryDropActive(false);
      const dropSnapshot: StyleDropSnapshot = captureStyleDropSnapshot(event.dataTransfer);
      void createStyleFromDrop(dropSnapshot);
    },
    [createStyleFromDrop]
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!pendingDeleteStyle?.id || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setLocalDeleteError(null);
    const deleted = await runDeleteStyleCommand({
      styleId: pendingDeleteStyle.id,
      onDeleteStyle,
    });
    if (deleted) {
      setPendingDeleteStyle(null);
    } else {
      setLocalDeleteError("Unable to delete this style right now.");
    }
    setDeleteSubmitting(false);
  }, [deleteSubmitting, onDeleteStyle, pendingDeleteStyle]);

  const handleSaveStyleDetails = React.useCallback(async () => {
    if (!pendingStyleEdit || editSubmitting) return;
    if (pendingStyleEdit.mode === "view") {
      setPendingStyleEdit(null);
      return;
    }
    if (pendingStyleEdit.mode === "create" && stylePromptExtractionSubmitting) {
      setLocalSaveError("Style analysis is still running. Please wait.");
      return;
    }

    const normalizedDetails = normalizeStyleDetailsDraft(pendingStyleEdit.details);
    const canonicalStyleName = normalizedDetails.style;
    if (!canonicalStyleName) {
      setLocalSaveError("Style is required.");
      return;
    }

    const normalizedSavePayload: StylesLibraryStyleDetails = {
      ...normalizedDetails,
      style: canonicalStyleName,
      title: canonicalStyleName,
      referenceImageName: canonicalStyleName,
    };
    const shouldGenerateStylePreview =
      pendingStyleEdit.mode === "create" &&
      !normalizedSavePayload.previewImageUrl.trim() &&
      normalizedSavePayload.stylePrompt.trim().length > 0;

    setEditSubmitting(true);
    setLocalSaveError(null);

    if (!onSaveStyleDetails) {
      setPendingStyleEdit(null);
      setEditSubmitting(false);
      return;
    }

    const saved = await runSaveStyleDetailsCommand({
      styleId: pendingStyleEdit.styleId,
      details: toPersistableStyleDetails(normalizedSavePayload),
      onSaveStyleDetails,
    });

    if (saved) {
      if (shouldGenerateStylePreview) {
        void runStylePreviewGeneration({
          styleId: pendingStyleEdit.styleId,
          details: toPersistableStyleDetails(normalizedSavePayload),
        });
      }
      setPendingStyleEdit(null);
    } else {
      setLocalSaveError("Unable to save this style right now.");
    }

    setEditSubmitting(false);
  }, [
    editSubmitting,
    onSaveStyleDetails,
    pendingStyleEdit,
    runStylePreviewGeneration,
    stylePromptExtractionSubmitting,
  ]);

  const openStyleEditModal = React.useCallback((style: ExpertEditStyleTile) => {
    const styleDisplayName = style.style?.trim() || style.title;
    const mode = style.source === "built_in" ? "view" : "edit";
    setLocalSaveError(null);
    stylePromptExtractionRequestIdRef.current += 1;
    setStylePromptExtractionSubmitting(false);
    setStylePromptExtractionError(null);
    setPendingStyleEdit({
      mode,
      styleId: style.id,
      styleTitle: styleDisplayName,
      details: buildInitialStyleDetails(style),
    });
  }, []);

  const openCreateStyleModal = React.useCallback(() => {
    const nextStyleName = buildNextCustomStyleName(styles);
    customStyleIdCounterRef.current += 1;
    const nextStyleId = `style-library-custom-${Date.now()}-${customStyleIdCounterRef.current}`;
    setLocalSaveError(null);
    stylePromptExtractionRequestIdRef.current += 1;
    setStylePromptExtractionSubmitting(false);
    setStylePromptExtractionError(null);
    setPendingStyleEdit({
      mode: "create",
      styleId: nextStyleId,
      styleTitle: nextStyleName,
      details: buildNewStyleDetails(nextStyleName),
    });
  }, [styles]);

  const handleStyleDragStart = React.useCallback(
    (styleId: string, event: React.DragEvent<HTMLElement>) => {
      setDraggedStyleId(styleId);
      setDropTargetStyleId(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/style-library-id", styleId);
    },
    []
  );

  const handleStyleDragOver = React.useCallback(
    (styleId: string, event: React.DragEvent<HTMLElement>) => {
      if (!draggedStyleId || draggedStyleId === styleId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropTargetStyleId !== styleId) {
        setDropTargetStyleId(styleId);
      }
    },
    [draggedStyleId, dropTargetStyleId]
  );

  const handleStyleDrop = React.useCallback(
    (targetStyleId: string, event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const sourceStyleId =
        draggedStyleId || event.dataTransfer.getData("text/style-library-id") || null;
      if (!sourceStyleId || sourceStyleId === targetStyleId) {
        setDropTargetStyleId(null);
        return;
      }
      if (onReorderStyle) {
        void onReorderStyle(sourceStyleId, targetStyleId);
      } else {
        setOrderedStyleIds((previous) => reorderById(previous, sourceStyleId, targetStyleId));
      }
      setDropTargetStyleId(null);
    },
    [draggedStyleId, onReorderStyle]
  );

  const handleStyleDragEnd = React.useCallback(() => {
    setDraggedStyleId(null);
    setDropTargetStyleId(null);
  }, []);

  React.useEffect(() => {
    const hasModalOpen = Boolean(pendingDeleteStyle || pendingStyleEdit);
    if (!hasModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (pendingStyleEdit) {
        closeEditModal();
        return;
      }
      closeDeleteModal();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeDeleteModal, closeEditModal, pendingDeleteStyle, pendingStyleEdit]);

  React.useEffect(() => {
    const styleIds = styles.map((style) => style.id);
    if (styleIds.length === 0) {
      setOrderedStyleIds([]);
      return;
    }
    setOrderedStyleIds((previous) => {
      const previousSet = new Set(previous);
      const retained = previous.filter((styleId) => styleIds.includes(styleId));
      const appended = styleIds.filter((styleId) => !previousSet.has(styleId));
      const next = [...retained, ...appended];
      if (
        next.length === previous.length &&
        next.every((value, index) => previous[index] === value)
      ) {
        return previous;
      }
      return next;
    });
  }, [styles]);

  React.useEffect(() => {
    const clearStylesLibraryDropState = () => {
      stylesLibraryDropDepthRef.current = 0;
      setStylesLibraryDropActive(false);
    };
    document.addEventListener("drop", clearStylesLibraryDropState);
    document.addEventListener("dragend", clearStylesLibraryDropState);
    return () => {
      document.removeEventListener("drop", clearStylesLibraryDropState);
      document.removeEventListener("dragend", clearStylesLibraryDropState);
    };
  }, []);

  return {
    renderedStyles,
    pendingEditPreviewImageUrl,
    draggedStyleId,
    dropTargetStyleId,
    pendingDeleteStyle,
    pendingStyleEdit,
    deleteSubmitting,
    editSubmitting,
    createStyleFromDropSubmitting,
    stylesLibraryDropActive,
    stylePreviewDropActive,
    stylePreviewGenerationStyleIds,
    localDeleteError,
    localSaveError,
    stylesLibraryDropError,
    stylePreviewGenerationError,
    stylePromptExtractionSubmitting,
    stylePromptExtractionError,
    setPendingDeleteStyle,
    setPendingStyleEdit,
    setStylePreviewDropActive,
    setLocalDeleteError,
    setLocalSaveError,
    closeDeleteModal,
    closeEditModal,
    dismissStylesLibraryDropError,
    dismissStylePreviewGenerationError,
    handleStylesLibraryDragEnter,
    handleStylesLibraryDragOver,
    handleStylesLibraryDragLeave,
    handleStylesLibraryDrop,
    handleDeleteConfirm,
    handleSaveStyleDetails,
    openStyleEditModal,
    openCreateStyleModal,
    handleStyleDragStart,
    handleStyleDragOver,
    handleStyleDrop,
    handleStyleDragEnd,
    applyStylePreviewFromTransfer,
    applyStylePreviewFile,
  };
};

/**
 * Stateful controller for styles-library creator/edit/delete workflows.
 * Keeps side effects and domain logic out of presentational panel markup.
 */
import React from "react";
import { postExtractStyle, prepareStyleImageUrl } from "../../logic/styleExtraction";
import type { StylesLibraryStyleDetails } from "../../types";
import { buildStyleExtractionMeta, buildStyleProfileFromPrompt } from "../../logic/styleProfile";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import { BLOCKED_STYLE_IMAGE_SOURCE_ERROR, BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE } from "./constants";
import { buildExtractionFailureResult, isBlockedStyleSourceError } from "./extraction";
import {
  applyStylePreviewToPendingEdit,
  buildInitialStyleDetails,
  buildNewStyleDetails,
  buildNextCustomStyleName,
  canAcceptStyleLibraryImageDropHint,
  cropImageDataUrlToSquareDataUrl,
  isDefaultCustomStyleName,
  isImageFileCandidate,
  normalizeStylePromptFallbackText,
  normalizeStyleDetailsDraft,
  readFileAsDataUrl,
  reorderById,
  resolveDroppedStylePreview,
} from "./intake";
import { runDeleteStyleCommand, runSaveStyleDetailsCommand } from "./persistence";
import { trackStyleExtractionOutcome } from "./telemetry";
import type {
  PendingStyleEditState,
  StyleExtractionOutcome,
  StyleExtractionRuntimeResult,
} from "./types";

type UseStyleCreatorControllerParams = {
  styles: readonly ExpertEditStyleTile[];
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
};

type StyleExtractionPayload = {
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
  ...(details.styleProfile ? { styleProfile: details.styleProfile } : {}),
  ...(details.extractionMeta ? { extractionMeta: details.extractionMeta } : {}),
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

const resolveTelemetryErrorClass = (
  outcome: StyleExtractionOutcome
): "blocked_source" | "fallback" | "unknown" => {
  if (outcome === "blocked_source" || outcome === "fallback") {
    return outcome;
  }
  return "unknown";
};

/**
 * Returns the full styles-library creator/edit/delete state machine contract.
 */
export const useStyleCreatorController = ({
  styles,
  onDeleteStyle,
  onSaveStyleDetails,
}: UseStyleCreatorControllerParams) => {
  const stylesLibraryDropDepthRef = React.useRef(0);
  const customStyleIdCounterRef = React.useRef(0);
  const stylePromptExtractionRequestIdRef = React.useRef(0);

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

  const applyExtractedStyleToCreateDraft = React.useCallback(
    ({
      stylePrompt,
      styleTitle,
      outcome,
      flow,
      sourceUrlKind,
    }: {
      stylePrompt: string;
      styleTitle: string;
      outcome: StyleExtractionOutcome;
      flow: "create_modal" | "library_drop";
      sourceUrlKind: "data" | "url" | "unknown";
    }) => {
      setPendingStyleEdit((previous) => {
        if (!previous || previous.mode !== "create") return previous;
        const currentStyleName = previous.details.style.trim();
        const shouldReplaceStyleName =
          !currentStyleName.length || isDefaultCustomStyleName(currentStyleName);
        return {
          ...previous,
          styleTitle: shouldReplaceStyleName ? styleTitle : previous.styleTitle,
          details: {
            ...previous.details,
            stylePrompt,
            style: shouldReplaceStyleName ? styleTitle : previous.details.style,
            title: shouldReplaceStyleName ? styleTitle : previous.details.title,
            referenceImageName: shouldReplaceStyleName
              ? styleTitle
              : previous.details.referenceImageName,
            styleProfile: buildStyleProfileFromPrompt(stylePrompt),
            extractionMeta: buildStyleExtractionMeta({
              outcome,
              flow,
              sourceUrlKind,
            }),
          },
        };
      });
    },
    []
  );

  const runStyleExtraction = React.useCallback(
    async ({ sourceImageUrl }: StyleExtractionPayload): Promise<StyleExtractionRuntimeResult> => {
      try {
        const safeImageUrl = await prepareStyleImageUrl(sourceImageUrl);
        if (!safeImageUrl) {
          throw new Error(
            "Unable to prepare image for style extraction. You can still enter the style prompt manually."
          );
        }
        const extracted = await postExtractStyle(safeImageUrl);
        return {
          outcome: "success" as const,
          sourceUrlKind: resolveSourceUrlKind(safeImageUrl),
          stylePrompt: extracted.stylePrompt,
          styleTitle: extracted.styleTitle,
        };
      } catch (error) {
        return buildExtractionFailureResult(error);
      }
    },
    []
  );

  const extractStyleForCreateDraft = React.useCallback(
    async (sourceImageUrl: string) => {
      const requestId = ++stylePromptExtractionRequestIdRef.current;
      setStylePromptExtractionSubmitting(true);
      setStylePromptExtractionError(null);

      const result = await runStyleExtraction({ sourceImageUrl });
      if (stylePromptExtractionRequestIdRef.current !== requestId) return;

      if (result.outcome === "success" && result.stylePrompt && result.styleTitle) {
        trackStyleExtractionOutcome("success", "create_modal", {
          stage: "extract",
          sourceUrlKind: result.sourceUrlKind,
        });
        applyExtractedStyleToCreateDraft({
          stylePrompt: result.stylePrompt,
          styleTitle: result.styleTitle,
          outcome: "success",
          flow: "create_modal",
          sourceUrlKind: result.sourceUrlKind,
        });
      } else {
        trackStyleExtractionOutcome(result.outcome, "create_modal", {
          stage: "extract",
          sourceUrlKind: result.sourceUrlKind,
          errorClass: resolveTelemetryErrorClass(result.outcome),
          errorMessage: result.errorMessage,
        });
        setStylePromptExtractionError(normalizeResultErrorMessage(result.errorMessage));
      }

      if (stylePromptExtractionRequestIdRef.current === requestId) {
        setStylePromptExtractionSubmitting(false);
      }
    },
    [applyExtractedStyleToCreateDraft, runStyleExtraction]
  );

  const applyStylePreviewFromTransfer = React.useCallback(
    async (transfer: DataTransfer) => {
      setLocalSaveError(null);
      try {
        const { previewImageUrl, extractionSourceImageUrl } =
          await resolveDroppedStylePreview(transfer);
        setPendingStyleEdit((previous) =>
          applyStylePreviewToPendingEdit(previous, previewImageUrl)
        );
        if (pendingStyleEdit?.mode === "create") {
          void extractStyleForCreateDraft(extractionSourceImageUrl);
        }
      } catch (error) {
        if (error instanceof Error && error.message === "missing-dropped-style-image") {
          setLocalSaveError("Please drop an image reference.");
          return;
        }
        if (error instanceof Error && error.message === BLOCKED_STYLE_IMAGE_SOURCE_ERROR) {
          trackStyleExtractionOutcome("blocked_source", "create_modal", {
            stage: "preview_source",
            errorClass: "blocked_source",
            errorMessage: error.message,
          });
          setLocalSaveError(BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE);
          return;
        }
        setLocalSaveError("Unable to process that image.");
      }
    },
    [extractStyleForCreateDraft, pendingStyleEdit?.mode]
  );

  const applyStylePreviewFile = React.useCallback(
    async (file: File) => {
      if (!isImageFileCandidate(file)) {
        setLocalSaveError("Please drop an image file.");
        return;
      }
      setLocalSaveError(null);
      try {
        const sourceImageDataUrl = await readFileAsDataUrl(file);
        const croppedPreview = await cropImageDataUrlToSquareDataUrl(sourceImageDataUrl);
        setPendingStyleEdit((previous) => applyStylePreviewToPendingEdit(previous, croppedPreview));
        if (pendingStyleEdit?.mode === "create") {
          void extractStyleForCreateDraft(sourceImageDataUrl);
        }
      } catch {
        setLocalSaveError("Unable to process that image.");
      }
    },
    [extractStyleForCreateDraft, pendingStyleEdit?.mode]
  );

  const createStyleFromDrop = React.useCallback(
    async (transfer: DataTransfer) => {
      if (createStyleFromDropSubmitting) return;
      setCreateStyleFromDropSubmitting(true);
      setStylesLibraryDropError(null);
      try {
        const { previewImageUrl, extractionSourceImageUrl, promptText } =
          await resolveDroppedStylePreview(transfer);

        let extractedStylePrompt = normalizeStylePromptFallbackText(promptText);
        let extractedStyleTitle: string | null = null;
        let extractionOutcome: StyleExtractionOutcome = "fallback";
        let extractionSourceUrlKind: "data" | "url" | "unknown" = "unknown";

        const extractionResult = await runStyleExtraction({
          sourceImageUrl: extractionSourceImageUrl,
        });

        extractionOutcome = extractionResult.outcome;
        extractionSourceUrlKind = extractionResult.sourceUrlKind;

        if (
          extractionResult.outcome === "success" &&
          extractionResult.stylePrompt &&
          extractionResult.styleTitle
        ) {
          extractedStylePrompt = extractionResult.stylePrompt;
          extractedStyleTitle = extractionResult.styleTitle;
          trackStyleExtractionOutcome("success", "library_drop", {
            stage: "extract",
            sourceUrlKind: extractionSourceUrlKind,
          });
        } else {
          trackStyleExtractionOutcome(extractionResult.outcome, "library_drop", {
            stage: "extract",
            sourceUrlKind: extractionSourceUrlKind,
            errorClass: resolveTelemetryErrorClass(extractionResult.outcome),
            errorMessage: extractionResult.errorMessage,
          });
          const detail =
            extractionResult.errorMessage?.trim() ||
            "Style extraction could not run from that source.";
          setStylesLibraryDropError(`${detail} Style created anyway; you can edit the prompt.`);
        }

        if (!onSaveStyleDetails) {
          setStylesLibraryDropError("Style saving is unavailable right now.");
          return;
        }

        const customStyleName = extractedStyleTitle?.trim() || buildNextCustomStyleName(styles);
        customStyleIdCounterRef.current += 1;
        const customStyleId = `style-library-custom-${Date.now()}-${customStyleIdCounterRef.current}`;
        const saved = await runSaveStyleDetailsCommand({
          styleId: customStyleId,
          onSaveStyleDetails,
          details: toPersistableStyleDetails({
            style: customStyleName,
            title: customStyleName,
            referenceImageName: customStyleName,
            stylePrompt: extractedStylePrompt,
            previewImageUrl,
            styleProfile: buildStyleProfileFromPrompt(extractedStylePrompt),
            extractionMeta: buildStyleExtractionMeta({
              outcome: extractionOutcome,
              flow: "library_drop",
              sourceUrlKind: extractionSourceUrlKind,
            }),
          }),
        });
        if (!saved) {
          setStylesLibraryDropError("Unable to create this style right now.");
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.message === "missing-dropped-style-image") {
          setStylesLibraryDropError(
            "Drop an image from your computer, Reference Grid, or Quick Slot Inventory."
          );
          return;
        }
        if (isBlockedStyleSourceError(error)) {
          trackStyleExtractionOutcome("blocked_source", "library_drop", {
            stage: "preview_source",
            errorClass: "blocked_source",
            errorMessage: error instanceof Error ? error.message : "unknown_error",
          });
          setStylesLibraryDropError(BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE);
          return;
        }
        setStylesLibraryDropError("Unable to process that dropped image.");
      } finally {
        setCreateStyleFromDropSubmitting(false);
      }
    },
    [createStyleFromDropSubmitting, onSaveStyleDetails, runStyleExtraction, styles]
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
      void createStyleFromDrop(event.dataTransfer);
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
      setPendingStyleEdit(null);
    } else {
      setLocalSaveError("Unable to save this style right now.");
    }

    setEditSubmitting(false);
  }, [editSubmitting, onSaveStyleDetails, pendingStyleEdit, stylePromptExtractionSubmitting]);

  const openStyleEditModal = React.useCallback((style: ExpertEditStyleTile) => {
    const styleDisplayName = style.style?.trim() || style.title;
    setLocalSaveError(null);
    stylePromptExtractionRequestIdRef.current += 1;
    setStylePromptExtractionSubmitting(false);
    setStylePromptExtractionError(null);
    setPendingStyleEdit({
      mode: "edit",
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
      setOrderedStyleIds((previous) => reorderById(previous, sourceStyleId, targetStyleId));
      setDropTargetStyleId(null);
    },
    [draggedStyleId]
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
    localDeleteError,
    localSaveError,
    stylesLibraryDropError,
    stylePromptExtractionSubmitting,
    stylePromptExtractionError,
    setPendingDeleteStyle,
    setPendingStyleEdit,
    setStylePreviewDropActive,
    setLocalDeleteError,
    setLocalSaveError,
    closeDeleteModal,
    closeEditModal,
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

/**
 * Primary Styles library panel for AI Studio.
 * Renders style tiles and owns edit/delete confirmation modals for style customization.
 */
import React from "react";
import { X } from "phosphor-react";
import type { StylesLibraryStyleDetails } from "../types";
import { postExtractStyle, prepareStyleImageUrl } from "../logic/styleExtraction";
import { extractDragDropPayload } from "../utils/dragDrop";
import { prepareImageUrlForSubmission } from "../utils/imageUpload";
import { reportAppError } from "../../../lib/appErrorReporter";
import type { ExpertEditStyleTile } from "./edit/expertEditStyles";
import { resolveStylePreviewBackgroundImage } from "./edit/expertEditStyles";

export type StylesLibraryPanelProps = {
  styles: readonly ExpertEditStyleTile[];
  selectedStyleId: string | null;
  onSelectStyle?: (styleId: string | null) => void;
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
  deleteError?: string | null;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
  saveError?: string | null;
};

type PendingStyleEditState = {
  mode: "edit" | "create";
  styleId: string;
  styleTitle: string;
  details: StylesLibraryStyleDetails;
};

const STYLE_PREVIEW_OUTPUT_SIZE_PX = 512;
const CUSTOM_STYLE_NAME_PREFIX = "Custom Style";
const IMAGE_FILE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i;
const STYLE_DROP_HINT_TRANSFER_TYPES = new Set([
  "Files",
  "text/plain",
  "text/reference-url",
  "text/reference-id",
  "text/reference-origin",
  "image/url",
  "text/uri-list",
]);
const BLOCKED_STYLE_IMAGE_SOURCE_ERROR = "blocked-style-image-source";
const BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE =
  "This image source blocks browser access. Download the image and drop the file directly.";
const STYLE_EXTRACTION_TELEMETRY_SOURCE = "telemetry.ai_studio.style_extraction";

type StyleExtractionOutcome = "success" | "fallback" | "blocked_source";
type StyleExtractionFlow = "create_modal" | "library_drop";

type ResolvedDroppedStylePreview = {
  previewImageUrl: string;
  extractionSourceImageUrl: string;
  promptText: string;
};

const isImageFileCandidate = (file: File): boolean => {
  if (file.type.startsWith("image/")) return true;
  return !file.type && IMAGE_FILE_EXTENSION_PATTERN.test(file.name);
};

const reorderById = (ids: readonly string[], sourceId: string, targetId: string): string[] => {
  if (sourceId === targetId) return [...ids];
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const buildInitialStyleDetails = (style: ExpertEditStyleTile): StylesLibraryStyleDetails => {
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

const buildNewStyleDetails = (styleName: string): StylesLibraryStyleDetails => ({
  style: styleName,
  title: styleName,
  referenceImageName: styleName,
  stylePrompt: "",
  previewImageUrl: "",
});

const normalizeStyleDetailsDraft = (
  value: StylesLibraryStyleDetails
): StylesLibraryStyleDetails => {
  return {
    style: value.style.trim(),
    title: value.title.trim(),
    referenceImageName: value.referenceImageName.trim(),
    stylePrompt: value.stylePrompt.trim(),
    previewImageUrl: value.previewImageUrl.trim(),
  };
};

const readFileAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Unable to read image file."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });
};

const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = src;
  });
};

const cropImageDataUrlToSquareDataUrl = async (sourceDataUrl: string): Promise<string> => {
  const image = await loadImageElement(sourceDataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const cropSize = Math.min(sourceWidth, sourceHeight);
  if (!cropSize) {
    throw new Error("Invalid image dimensions.");
  }

  const sourceX = Math.max(0, Math.floor((sourceWidth - cropSize) / 2));
  const sourceY = Math.max(0, Math.floor((sourceHeight - cropSize) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = STYLE_PREVIEW_OUTPUT_SIZE_PX;
  canvas.height = STYLE_PREVIEW_OUTPUT_SIZE_PX;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    STYLE_PREVIEW_OUTPUT_SIZE_PX,
    STYLE_PREVIEW_OUTPUT_SIZE_PX
  );
  return canvas.toDataURL("image/jpeg", 0.9);
};

const cropImageUrlToSquareDataUrl = async (sourceUrl: string): Promise<string> => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error("Unable to download image.");
  }
  const sourceBlob = await response.blob();
  if (!(sourceBlob instanceof Blob) || sourceBlob.size <= 0) {
    throw new Error("Unable to read image.");
  }
  const sourceDataUrl = await readFileAsDataUrl(sourceBlob);
  return cropImageDataUrlToSquareDataUrl(sourceDataUrl);
};

const findDroppedImageFile = (transfer: DataTransfer): File | null => {
  const droppedFiles = Array.from(transfer.files ?? []);
  return droppedFiles.find((file) => isImageFileCandidate(file)) ?? null;
};

const hasStyleReorderTransfer = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  return Array.from(transfer.types ?? []).includes("text/style-library-id");
};

const canAcceptStyleLibraryImageDropHint = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer || hasStyleReorderTransfer(transfer)) return false;
  const transferTypes = Array.from(transfer.types ?? []);
  return transferTypes.some((type) => STYLE_DROP_HINT_TRANSFER_TYPES.has(type));
};

const buildNextCustomStyleName = (styles: readonly ExpertEditStyleTile[]): string => {
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

const isDefaultCustomStyleName = (value: string): boolean =>
  /^Custom Style \d+$/i.test(value.trim());

const isBlockedStyleSourceError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.trim().toLowerCase();
  return (
    normalizedMessage === BLOCKED_STYLE_IMAGE_SOURCE_ERROR ||
    normalizedMessage.includes("blocks browser access")
  );
};

export function StylesLibraryPanel({
  styles,
  selectedStyleId,
  onSelectStyle,
  onDeleteStyle,
  deleteError = null,
  onSaveStyleDetails,
  saveError = null,
}: StylesLibraryPanelProps) {
  const stylePreviewFileInputRef = React.useRef<HTMLInputElement | null>(null);
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
  const allStyles = styles;
  const renderedStyles = React.useMemo(() => {
    if (allStyles.length === 0) return allStyles;
    if (orderedStyleIds.length === 0) return allStyles;
    const byId = new Map(allStyles.map((style) => [style.id, style] as const));
    const ordered = orderedStyleIds
      .map((styleId) => byId.get(styleId))
      .filter((style): style is ExpertEditStyleTile => Boolean(style));
    return ordered.length === allStyles.length ? ordered : allStyles;
  }, [allStyles, orderedStyleIds]);
  const pendingEditPreviewImageUrl = pendingStyleEdit?.details.previewImageUrl?.trim() ?? "";
  const trackStyleExtractionOutcome = React.useCallback(
    (
      outcome: StyleExtractionOutcome,
      flow: StyleExtractionFlow,
      metadata?: Record<string, unknown>
    ) => {
      void reportAppError({
        source: STYLE_EXTRACTION_TELEMETRY_SOURCE,
        scope: "app",
        severity: "low",
        message: `style_extraction.${outcome}`,
        metadata: {
          telemetry_family: "style_extraction",
          outcome,
          flow,
          ...(metadata ?? {}),
        },
      });
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

  const applyExtractedStyleToCreateDraft = React.useCallback(
    ({ stylePrompt, styleTitle }: { stylePrompt: string; styleTitle: string }) => {
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
          },
        };
      });
    },
    []
  );

  const extractStyleForCreateDraft = React.useCallback(
    async (sourceImageUrl: string) => {
      const requestId = ++stylePromptExtractionRequestIdRef.current;
      setStylePromptExtractionSubmitting(true);
      setStylePromptExtractionError(null);
      try {
        const safeImageUrl = await prepareStyleImageUrl(sourceImageUrl);
        if (!safeImageUrl) {
          throw new Error(
            "Unable to prepare image for style extraction. You can still enter the style prompt manually."
          );
        }
        const extracted = await postExtractStyle(safeImageUrl);
        if (stylePromptExtractionRequestIdRef.current !== requestId) return;
        trackStyleExtractionOutcome("success", "create_modal", {
          source_url_kind: safeImageUrl.startsWith("data:") ? "data" : "url",
        });
        applyExtractedStyleToCreateDraft({
          stylePrompt: extracted.stylePrompt,
          styleTitle: extracted.styleTitle,
        });
      } catch (error) {
        if (stylePromptExtractionRequestIdRef.current !== requestId) return;
        trackStyleExtractionOutcome(
          isBlockedStyleSourceError(error) ? "blocked_source" : "fallback",
          "create_modal",
          {
            error:
              error instanceof Error && error.message.trim().length
                ? error.message.trim().slice(0, 180)
                : "unknown_error",
          }
        );
        setStylePromptExtractionError(
          error instanceof Error
            ? error.message
            : "Style extraction failed. You can still enter the style prompt manually."
        );
      } finally {
        if (stylePromptExtractionRequestIdRef.current === requestId) {
          setStylePromptExtractionSubmitting(false);
        }
      }
    },
    [applyExtractedStyleToCreateDraft, trackStyleExtractionOutcome]
  );

  const applyStylePreviewToPendingEdit = React.useCallback((previewImageUrl: string) => {
    setPendingStyleEdit((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        details: {
          ...previous.details,
          previewImageUrl,
        },
      };
    });
  }, []);

  const resolveDroppedStylePreview = React.useCallback(
    async (transfer: DataTransfer): Promise<ResolvedDroppedStylePreview> => {
      const droppedImageFile = findDroppedImageFile(transfer);
      if (droppedImageFile) {
        const sourceImageDataUrl = await readFileAsDataUrl(droppedImageFile);
        return {
          previewImageUrl: await cropImageDataUrlToSquareDataUrl(sourceImageDataUrl),
          extractionSourceImageUrl: sourceImageDataUrl,
          promptText: "",
        };
      }
      const dragPayload = extractDragDropPayload(transfer);
      const droppedImageUrl = dragPayload.imageUrl?.trim() ?? "";
      if (!droppedImageUrl) {
        throw new Error("missing-dropped-style-image");
      }
      const preparedDroppedImageUrl =
        (await prepareImageUrlForSubmission(droppedImageUrl)) ?? droppedImageUrl;
      let previewImageUrl: string;
      try {
        previewImageUrl = await cropImageUrlToSquareDataUrl(preparedDroppedImageUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          message.includes("failed to fetch") ||
          message.includes("networkerror") ||
          message.includes("cors")
        ) {
          throw new Error(BLOCKED_STYLE_IMAGE_SOURCE_ERROR);
        }
        throw error;
      }
      return {
        previewImageUrl,
        extractionSourceImageUrl: preparedDroppedImageUrl,
        promptText: dragPayload.promptText?.trim() ?? "",
      };
    },
    []
  );

  const applyStylePreviewFromTransfer = React.useCallback(
    async (transfer: DataTransfer) => {
      setLocalSaveError(null);
      try {
        const { previewImageUrl, extractionSourceImageUrl } =
          await resolveDroppedStylePreview(transfer);
        applyStylePreviewToPendingEdit(previewImageUrl);
        const shouldExtract = pendingStyleEdit?.mode === "create";
        if (shouldExtract) {
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
          });
          setLocalSaveError(BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE);
          return;
        }
        setLocalSaveError("Unable to process that image.");
      }
    },
    [
      applyStylePreviewToPendingEdit,
      extractStyleForCreateDraft,
      pendingStyleEdit?.mode,
      resolveDroppedStylePreview,
      trackStyleExtractionOutcome,
    ]
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
        applyStylePreviewToPendingEdit(croppedPreview);
        const shouldExtract = pendingStyleEdit?.mode === "create";
        if (shouldExtract) {
          void extractStyleForCreateDraft(sourceImageDataUrl);
        }
      } catch {
        setLocalSaveError("Unable to process that image.");
      }
    },
    [applyStylePreviewToPendingEdit, extractStyleForCreateDraft, pendingStyleEdit?.mode]
  );

  const createStyleFromDrop = React.useCallback(
    async (transfer: DataTransfer) => {
      if (createStyleFromDropSubmitting) return;
      setCreateStyleFromDropSubmitting(true);
      setStylesLibraryDropError(null);
      try {
        const { previewImageUrl, extractionSourceImageUrl, promptText } =
          await resolveDroppedStylePreview(transfer);
        let extractedStylePrompt = promptText;
        let extractedStyleTitle: string | null = null;
        try {
          const safeImageUrl = await prepareStyleImageUrl(extractionSourceImageUrl);
          if (!safeImageUrl) {
            throw new Error("Unable to prepare dropped image for style extraction.");
          }
          const extracted = await postExtractStyle(safeImageUrl);
          extractedStylePrompt = extracted.stylePrompt;
          extractedStyleTitle = extracted.styleTitle;
          trackStyleExtractionOutcome("success", "library_drop", {
            source_url_kind: safeImageUrl.startsWith("data:") ? "data" : "url",
          });
        } catch (error) {
          const extractionOutcome: StyleExtractionOutcome = isBlockedStyleSourceError(error)
            ? "blocked_source"
            : "fallback";
          trackStyleExtractionOutcome(extractionOutcome, "library_drop", {
            error:
              error instanceof Error && error.message.trim().length
                ? error.message.trim().slice(0, 180)
                : "unknown_error",
          });
          const detail =
            error instanceof Error && error.message.trim().length
              ? error.message.trim()
              : "Style extraction could not run from that source.";
          setStylesLibraryDropError(`${detail} Style created anyway; you can edit the prompt.`);
        }
        if (!onSaveStyleDetails) {
          setStylesLibraryDropError("Style saving is unavailable right now.");
          return;
        }
        const customStyleName = extractedStyleTitle?.trim() || buildNextCustomStyleName(allStyles);
        customStyleIdCounterRef.current += 1;
        const customStyleId = `style-library-custom-${Date.now()}-${customStyleIdCounterRef.current}`;
        const saved = await onSaveStyleDetails(customStyleId, {
          style: customStyleName,
          title: customStyleName,
          referenceImageName: customStyleName,
          stylePrompt: extractedStylePrompt,
          previewImageUrl,
        });
        if (!saved) {
          setStylesLibraryDropError("Unable to create this style right now.");
          return;
        }
        onSelectStyle?.(customStyleId);
      } catch (error) {
        if (error instanceof Error && error.message === "missing-dropped-style-image") {
          setStylesLibraryDropError(
            "Drop an image from your computer, Reference Grid, or Quick Slot Inventory."
          );
          return;
        }
        if (error instanceof Error && error.message === BLOCKED_STYLE_IMAGE_SOURCE_ERROR) {
          trackStyleExtractionOutcome("blocked_source", "library_drop", {
            stage: "preview_source",
          });
          setStylesLibraryDropError(BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE);
          return;
        }
        setStylesLibraryDropError("Unable to process that dropped image.");
      } finally {
        setCreateStyleFromDropSubmitting(false);
      }
    },
    [
      allStyles,
      createStyleFromDropSubmitting,
      onSaveStyleDetails,
      onSelectStyle,
      resolveDroppedStylePreview,
      trackStyleExtractionOutcome,
    ]
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
    if (!pendingDeleteStyle?.id || !onDeleteStyle || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setLocalDeleteError(null);
    try {
      const deleted = await onDeleteStyle(pendingDeleteStyle.id);
      if (deleted) {
        setPendingDeleteStyle(null);
      } else {
        setLocalDeleteError("Unable to delete this style right now.");
      }
    } catch {
      setLocalDeleteError("Unable to delete this style right now.");
    } finally {
      setDeleteSubmitting(false);
    }
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
      style: canonicalStyleName,
      title: canonicalStyleName,
      referenceImageName: canonicalStyleName,
      stylePrompt: normalizedDetails.stylePrompt,
      previewImageUrl: normalizedDetails.previewImageUrl,
    };

    setEditSubmitting(true);
    setLocalSaveError(null);
    try {
      if (!onSaveStyleDetails) {
        setPendingStyleEdit(null);
        return;
      }
      const saved = await onSaveStyleDetails(pendingStyleEdit.styleId, normalizedSavePayload);
      if (saved) {
        if (pendingStyleEdit.mode === "create") {
          onSelectStyle?.(pendingStyleEdit.styleId);
        }
        setPendingStyleEdit(null);
      } else {
        setLocalSaveError("Unable to save this style right now.");
      }
    } catch {
      setLocalSaveError("Unable to save this style right now.");
    } finally {
      setEditSubmitting(false);
    }
  }, [
    editSubmitting,
    onSaveStyleDetails,
    onSelectStyle,
    pendingStyleEdit,
    stylePromptExtractionSubmitting,
  ]);

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
    const nextStyleName = buildNextCustomStyleName(allStyles);
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
  }, [allStyles]);
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
    const styleIds = allStyles.map((style) => style.id);
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
  }, [allStyles]);
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

  return (
    <section
      className={`styles-library-panel ${stylesLibraryDropActive ? "is-drop-active" : ""}`.trim()}
      aria-label="Styles library"
      onDragEnter={handleStylesLibraryDragEnter}
      onDragOver={handleStylesLibraryDragOver}
      onDragLeave={handleStylesLibraryDragLeave}
      onDrop={handleStylesLibraryDrop}
    >
      <header className="styles-library-header">
        <p className="eyebrow">Styles Library</p>
        <p className="tiny subdued helper-text">
          Browse all loaded styles. Drag an image from your computer, Reference Grid, or Quick Slot
          to create a style.
        </p>
        {stylesLibraryDropActive ? (
          <p className="styles-library-drop-status tiny">Drop image to create a new style.</p>
        ) : null}
        {createStyleFromDropSubmitting ? (
          <p className="styles-library-drop-status tiny subdued">Creating style from image...</p>
        ) : null}
        {stylesLibraryDropError ? (
          <p className="styles-library-drop-error tiny">{stylesLibraryDropError}</p>
        ) : null}
      </header>
      <div
        className={`styles-library-scroll ${
          stylesLibraryDropActive ? "is-external-drop-active" : ""
        }`.trim()}
      >
        <div className="styles-library-grid" role="list" aria-label="Styles library tiles">
          {renderedStyles.map((style) => {
            const isSelected = !style.placeholder && selectedStyleId === style.id;
            return (
              <article
                key={style.id}
                role="listitem"
                className={`styles-library-tile ${isSelected ? "is-selected" : ""} ${
                  draggedStyleId === style.id ? "is-dragging" : ""
                } ${dropTargetStyleId === style.id ? "is-drop-target" : ""} ${
                  style.placeholder ? "is-placeholder" : ""
                }`.trim()}
                draggable
                onDragStart={(event) => handleStyleDragStart(style.id, event)}
                onDragOver={(event) => handleStyleDragOver(style.id, event)}
                onDrop={(event) => handleStyleDrop(style.id, event)}
                onDragEnd={handleStyleDragEnd}
              >
                {!style.placeholder ? (
                  <button
                    type="button"
                    className="styles-library-tile-delete"
                    aria-label={`Delete style: ${style.title}`}
                    onClick={() => {
                      setLocalDeleteError(null);
                      setPendingDeleteStyle(style);
                    }}
                  >
                    <X size={12} weight="bold" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="styles-library-tile-select"
                  aria-label={`Style tile: ${style.title}${style.placeholder ? " (coming soon)" : ""}`}
                  aria-pressed={style.placeholder ? undefined : isSelected}
                  disabled={style.placeholder}
                  onClick={() => {
                    if (style.placeholder) return;
                    onSelectStyle?.(style.id);
                    openStyleEditModal(style);
                  }}
                >
                  <span className="styles-library-tile-title">{style.title}</span>
                  <span
                    className="styles-library-tile-preview"
                    style={
                      style.previewUrl
                        ? {
                            backgroundImage: resolveStylePreviewBackgroundImage(style.previewUrl),
                          }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {style.placeholder ? (
                      <span className="styles-library-tile-coming-soon">Coming soon</span>
                    ) : null}
                  </span>
                </button>
              </article>
            );
          })}
          <article role="listitem" className="styles-library-tile styles-library-add-tile">
            <button
              type="button"
              className="styles-library-tile-select styles-library-add-button"
              aria-label="Add style"
              onClick={openCreateStyleModal}
            >
              <span
                className="styles-library-tile-title styles-library-add-title"
                aria-hidden="true"
              >
                Add style
              </span>
              <span
                className="styles-library-tile-preview styles-library-add-preview"
                aria-hidden="true"
              >
                <span className="styles-library-add-plus">+</span>
                <span className="styles-library-add-label tiny">Add style</span>
              </span>
            </button>
          </article>
        </div>
      </div>
      {pendingStyleEdit ? (
        <div
          className="styles-library-edit-modal-backdrop"
          role="presentation"
          onClick={closeEditModal}
        >
          <div
            className="styles-library-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="styles-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="styles-edit-title" className="styles-library-edit-title">
              {pendingStyleEdit.mode === "create" ? "Add style" : "Edit style"}
            </p>
            <p className="styles-library-edit-copy tiny subdued">
              {pendingStyleEdit.mode === "create" ? (
                <>
                  Enter details for <strong>{pendingStyleEdit.styleTitle}</strong>.
                </>
              ) : (
                <>
                  Update <strong>{pendingStyleEdit.styleTitle}</strong> details.
                </>
              )}
            </p>
            <label className="styles-library-edit-field">
              <span className="styles-library-edit-label">Style</span>
              <input
                type="text"
                className="styles-library-edit-input"
                value={pendingStyleEdit.details.style}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPendingStyleEdit((previous) => {
                    if (!previous) return previous;
                    return {
                      ...previous,
                      details: {
                        ...previous.details,
                        style: nextValue,
                        title: nextValue,
                        referenceImageName: nextValue,
                      },
                    };
                  });
                }}
              />
            </label>
            <div className="styles-library-edit-field">
              <span className="styles-library-edit-label">Reference Image</span>
              <div
                className={`styles-library-edit-dropzone ${
                  stylePreviewDropActive ? "is-drop-active" : ""
                } ${pendingEditPreviewImageUrl ? "has-preview" : ""}`.trim()}
                role="button"
                tabIndex={0}
                aria-label="Drop reference image or click to upload"
                onClick={() => stylePreviewFileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  stylePreviewFileInputRef.current?.click();
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setStylePreviewDropActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "copy";
                  setStylePreviewDropActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const nextTarget = event.relatedTarget;
                  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                    return;
                  }
                  setStylePreviewDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setStylePreviewDropActive(false);
                  void applyStylePreviewFromTransfer(event.dataTransfer);
                }}
              >
                <input
                  ref={stylePreviewFileInputRef}
                  type="file"
                  accept="image/*"
                  className="styles-library-edit-dropzone-input"
                  onChange={(event) => {
                    const [file] = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (!file) return;
                    void applyStylePreviewFile(file);
                  }}
                />
                <span
                  className="styles-library-edit-dropzone-preview"
                  style={
                    pendingEditPreviewImageUrl
                      ? {
                          backgroundImage: resolveStylePreviewBackgroundImage(
                            pendingEditPreviewImageUrl
                          ),
                        }
                      : undefined
                  }
                  aria-hidden="true"
                />
                <span className="styles-library-edit-dropzone-copy">
                  Drop an image here, or click to upload.
                </span>
                <span className="styles-library-edit-dropzone-hint tiny subdued">
                  Image is center-cropped to a square and used on the style card.
                </span>
              </div>
            </div>
            <label className="styles-library-edit-field">
              <span className="styles-library-edit-label">Style Prompt</span>
              <textarea
                className="styles-library-edit-textarea"
                rows={5}
                value={pendingStyleEdit.details.stylePrompt}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPendingStyleEdit((previous) => {
                    if (!previous) return previous;
                    return {
                      ...previous,
                      details: {
                        ...previous.details,
                        stylePrompt: nextValue,
                      },
                    };
                  });
                }}
              />
            </label>
            {pendingStyleEdit.mode === "create" && stylePromptExtractionSubmitting ? (
              <p className="styles-library-edit-copy tiny subdued">Analyzing style...</p>
            ) : null}
            {pendingStyleEdit.mode === "create" && stylePromptExtractionError ? (
              <p className="styles-library-edit-error tiny">{stylePromptExtractionError}</p>
            ) : null}
            {saveError ? <p className="styles-library-edit-error tiny">{saveError}</p> : null}
            {localSaveError ? (
              <p className="styles-library-edit-error tiny">{localSaveError}</p>
            ) : null}
            <div className="styles-library-edit-actions">
              <button
                type="button"
                className="ghost-btn mini styles-library-edit-action-btn"
                onClick={closeEditModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ghost-btn mini styles-library-edit-action-btn styles-library-edit-save"
                disabled={
                  editSubmitting ||
                  (pendingStyleEdit.mode === "create" && stylePromptExtractionSubmitting)
                }
                onClick={() => {
                  void handleSaveStyleDetails();
                }}
              >
                {pendingStyleEdit.mode === "create" && stylePromptExtractionSubmitting
                  ? "Analyzing style..."
                  : editSubmitting
                    ? "Saving..."
                    : pendingStyleEdit.mode === "create"
                      ? "Save style"
                      : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDeleteStyle ? (
        <div
          className="styles-library-delete-modal-backdrop"
          role="presentation"
          onClick={closeDeleteModal}
        >
          <div
            className="styles-library-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="styles-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="styles-delete-title" className="styles-library-delete-title">
              Delete style?
            </p>
            <p className="styles-library-delete-copy tiny subdued">
              Remove <strong>{pendingDeleteStyle.title}</strong> from your style library
              permanently?
            </p>
            {deleteError ? <p className="styles-library-delete-error tiny">{deleteError}</p> : null}
            {localDeleteError ? (
              <p className="styles-library-delete-error tiny">{localDeleteError}</p>
            ) : null}
            <div className="styles-library-delete-actions">
              <button type="button" className="ghost-btn mini" onClick={closeDeleteModal}>
                No
              </button>
              <button
                type="button"
                className="ghost-btn mini styles-library-delete-confirm"
                disabled={deleteSubmitting}
                onClick={() => {
                  void handleDeleteConfirm();
                }}
              >
                {deleteSubmitting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

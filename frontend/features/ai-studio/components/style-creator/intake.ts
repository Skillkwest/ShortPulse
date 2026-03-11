/**
 * Intake and image-prep helpers for styles-library creation/edit flows.
 */
import type { StylesLibraryStyleDetails } from "../../types";
import { extractDragDropPayload } from "../../utils/dragDrop";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
import {
  BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
  CUSTOM_STYLE_NAME_PREFIX,
  IMAGE_FILE_EXTENSION_PATTERN,
  STYLE_EXTRACTION_MAX_DIMENSION_PX,
  STYLE_DROP_HINT_TRANSFER_TYPES,
  STYLE_PREVIEW_OUTPUT_SIZE_PX,
  STYLE_PROMPT_MAX_CHARACTERS,
} from "./constants";
import type { PendingStyleEditState, ResolvedDroppedStylePreview } from "./types";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";

const IMAGE_FILENAME_TEXT_PATTERN =
  /(?:^|[\\/])[^\\/\n]+\.(?:avif|bmp|gif|heic|heif|jpe?g|png|webp|tiff?)$/i;
const CAMERA_FILENAME_STEM_PATTERN = /^(?:img|dsc|pxl|mvimg|screenshot)[-_ ]?\d[\w .:-]*$/i;
const STYLE_IMAGE_OUTPUT_QUALITY = 0.9;

/**
 * Returns true when a dropped file is a supported image candidate.
 */
export const isImageFileCandidate = (file: File): boolean => {
  if (file.type.startsWith("image/")) return true;
  return !file.type && IMAGE_FILE_EXTENSION_PATTERN.test(file.name);
};

/**
 * Reorders an id list by moving source id before target id.
 */
export const reorderById = (
  ids: readonly string[],
  sourceId: string,
  targetId: string
): string[] => {
  if (sourceId === targetId) return [...ids];
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

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
    styleProfile: style.styleProfile,
    extractionMeta: style.extractionMeta,
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
 * Enforces the style prompt max character budget.
 */
export const clampStylePromptCharacters = (value: string): string => {
  if (value.length <= STYLE_PROMPT_MAX_CHARACTERS) return value;
  return value.slice(0, STYLE_PROMPT_MAX_CHARACTERS);
};

/**
 * Reads a blob as a data URL.
 */
export const readFileAsDataUrl = (blob: Blob): Promise<string> => {
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

const createStyleImageCanvasContext = (
  width: number,
  height: number
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
};

const resolveImageNaturalDimensions = (
  image: HTMLImageElement
): { width: number; height: number } => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    throw new Error("Invalid image dimensions.");
  }
  return { width, height };
};

/**
 * Center-crops and scales an image data URL into a square card preview.
 */
export const cropImageDataUrlToSquareDataUrl = async (sourceDataUrl: string): Promise<string> => {
  const image = await loadImageElement(sourceDataUrl);
  const { width: sourceWidth, height: sourceHeight } = resolveImageNaturalDimensions(image);
  const cropSize = Math.min(sourceWidth, sourceHeight);

  const sourceX = Math.max(0, Math.floor((sourceWidth - cropSize) / 2));
  const sourceY = Math.max(0, Math.floor((sourceHeight - cropSize) / 2));
  const { canvas, context } = createStyleImageCanvasContext(
    STYLE_PREVIEW_OUTPUT_SIZE_PX,
    STYLE_PREVIEW_OUTPUT_SIZE_PX
  );
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
  return canvas.toDataURL("image/jpeg", STYLE_IMAGE_OUTPUT_QUALITY);
};

/**
 * Resizes an image data URL for extraction analysis without cropping.
 * Caps the longest side and never upscales source dimensions.
 */
export const resizeImageDataUrlForExtraction = async (sourceDataUrl: string): Promise<string> => {
  const image = await loadImageElement(sourceDataUrl);
  const { width: sourceWidth, height: sourceHeight } = resolveImageNaturalDimensions(image);
  const sourceMaxDimension = Math.max(sourceWidth, sourceHeight);
  const scale =
    sourceMaxDimension > STYLE_EXTRACTION_MAX_DIMENSION_PX
      ? STYLE_EXTRACTION_MAX_DIMENSION_PX / sourceMaxDimension
      : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const { canvas, context } = createStyleImageCanvasContext(targetWidth, targetHeight);
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", STYLE_IMAGE_OUTPUT_QUALITY);
};

/**
 * Produces style-intake preview and extraction images from a source data URL.
 */
export const preprocessStyleImageDataUrl = async (
  sourceDataUrl: string
): Promise<Pick<ResolvedDroppedStylePreview, "previewImageUrl" | "extractionSourceImageUrl">> => {
  const [previewImageUrl, extractionSourceImageUrl] = await Promise.all([
    cropImageDataUrlToSquareDataUrl(sourceDataUrl),
    resizeImageDataUrlForExtraction(sourceDataUrl),
  ]);
  return {
    previewImageUrl,
    extractionSourceImageUrl,
  };
};

const readImageDataUrlFromUrl = async (sourceUrl: string): Promise<string> => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error("Unable to download image.");
  }
  const sourceBlob = await response.blob();
  if (!(sourceBlob instanceof Blob) || sourceBlob.size <= 0) {
    throw new Error("Unable to read image.");
  }
  return readFileAsDataUrl(sourceBlob);
};

const findDroppedImageFile = (transfer: DataTransfer): File | null => {
  const droppedFiles = Array.from(transfer.files ?? []);
  return droppedFiles.find((file) => isImageFileCandidate(file)) ?? null;
};

const hasStyleReorderTransfer = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  return Array.from(transfer.types ?? []).includes("text/style-library-id");
};

/**
 * Returns true when a transfer payload should be accepted for style intake.
 */
export const canAcceptStyleLibraryImageDropHint = (
  transfer: DataTransfer | null | undefined
): boolean => {
  if (!transfer || hasStyleReorderTransfer(transfer)) return false;
  const transferTypes = Array.from(transfer.types ?? []);
  return transferTypes.some((type) => STYLE_DROP_HINT_TRANSFER_TYPES.has(type));
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

/**
 * Sanitizes drag-drop prompt fallback text used when extraction fails.
 * Drops filename/path-like payloads so style prompts never default to image filenames.
 */
export const normalizeStylePromptFallbackText = (value: string | null | undefined): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (/^file:\/\//i.test(trimmed)) return "";
  if (IMAGE_FILENAME_TEXT_PATTERN.test(trimmed)) return "";
  if (CAMERA_FILENAME_STEM_PATTERN.test(trimmed) && !/[,.]/.test(trimmed)) return "";
  return clampStylePromptCharacters(trimmed);
};

/**
 * Resolves a drop payload into preview + extraction source URLs.
 */
export const resolveDroppedStylePreview = async (
  transfer: DataTransfer
): Promise<ResolvedDroppedStylePreview> => {
  const droppedImageFile = findDroppedImageFile(transfer);
  if (droppedImageFile) {
    const sourceImageDataUrl = await readFileAsDataUrl(droppedImageFile);
    const processed = await preprocessStyleImageDataUrl(sourceImageDataUrl);
    return {
      previewImageUrl: processed.previewImageUrl,
      extractionSourceImageUrl: processed.extractionSourceImageUrl,
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
  try {
    const sourceImageDataUrl = await readImageDataUrlFromUrl(preparedDroppedImageUrl);
    const processed = await preprocessStyleImageDataUrl(sourceImageDataUrl);
    return {
      previewImageUrl: processed.previewImageUrl,
      extractionSourceImageUrl: processed.extractionSourceImageUrl,
      promptText: normalizeStylePromptFallbackText(dragPayload.promptText),
    };
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

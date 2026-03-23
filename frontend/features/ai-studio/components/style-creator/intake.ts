/**
 * Intake and image-prep helpers for styles-library creation/edit flows.
 */
import type { StylesLibraryStyleDetails } from "../../types";
import {
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
  normalizeReferenceTransferUrlCandidate,
  type InternalReferenceDragPayload,
} from "../../utils/dragDrop";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import {
  BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
  CUSTOM_STYLE_NAME_PREFIX,
  EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
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
const REFERENCE_RENDER_URL_TRANSFER_TYPE = "text/reference-render-url";
const URLISH_TEXT_PATTERN = /^(?:data:image\/|blob:|https?:\/\/|\/)/i;
const SERVER_COPY_ROUTE = "/api/media/copy-from-url";
const STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED !== "false";

export type InternalStyleDropServerCopyHints = {
  outputId?: string | null;
  mediaId?: string | null;
  imageIndex: number;
  generationId?: string | null;
  taskId?: string | null;
  previewStoragePathHint?: string | null;
  fullStoragePathHint?: string | null;
  previewUrlHint?: string | null;
  fullUrlHint?: string | null;
};

export type ResolvedInternalStyleDrop = {
  imageUrlCandidates: string[];
  promptText?: string | null;
  serverCopyHints?: InternalStyleDropServerCopyHints;
  resolutionReason?:
    | "output_storage_path"
    | "saved_media_lookup"
    | "generation_index_lookup"
    | "result_url"
    | "output_preview_url"
    | "payload_reference_url"
    | null;
};

export type ResolveInternalStyleDrop = (
  payload: InternalReferenceDragPayload
) => Promise<ResolvedInternalStyleDrop | null>;

type ResolveDroppedStylePreviewOptions = {
  resolveInternalStyleDrop?: ResolveInternalStyleDrop;
};

export type StyleDropPreviewErrorCode =
  | "missing-dropped-style-image"
  | typeof BLOCKED_STYLE_IMAGE_SOURCE_ERROR
  | typeof EXPIRED_STYLE_IMAGE_SOURCE_ERROR;

export type StyleDropPreviewClassifierReason =
  | "missing_drop_payload"
  | "non_image_payload"
  | "image_load_failed"
  | "image_process_failed"
  | "invalid_image_dimensions"
  | "reference_url_expired"
  | "reference_url_refresh_failed"
  | "download_http_4xx"
  | "download_http_5xx"
  | "image_read_failed"
  | "network_failed_to_fetch"
  | "network_request_failed"
  | "network_error"
  | "network_load_failed"
  | "network_offline"
  | "fetch_failed"
  | "cors_blocked"
  | "canvas_tainted"
  | "security_error"
  | "request_aborted"
  | "unknown";

type StyleDropPreviewError = Error & {
  styleDropErrorCode?: StyleDropPreviewErrorCode;
  styleDropClassifierReason?: StyleDropPreviewClassifierReason;
  styleDropResolutionReason?: string | null;
  styleDropResolutionStage?: "primary" | "server_copy_fallback";
  styleDropCandidateCount?: number;
  styleDropServerCopyAttempted?: boolean;
};

const createStyleDropPreviewError = (
  code: StyleDropPreviewErrorCode,
  classifierReason: StyleDropPreviewClassifierReason,
  context?: {
    resolutionReason?: string | null;
    resolutionStage?: "primary" | "server_copy_fallback";
    candidateCount?: number;
    serverCopyAttempted?: boolean;
  }
): StyleDropPreviewError => {
  const error = new Error(code) as StyleDropPreviewError;
  error.styleDropErrorCode = code;
  error.styleDropClassifierReason = classifierReason;
  if (context?.resolutionReason !== undefined) {
    error.styleDropResolutionReason = context.resolutionReason;
  }
  if (context?.resolutionStage !== undefined) {
    error.styleDropResolutionStage = context.resolutionStage;
  }
  if (typeof context?.candidateCount === "number" && Number.isFinite(context.candidateCount)) {
    error.styleDropCandidateCount = Math.max(0, Math.trunc(context.candidateCount));
  }
  if (typeof context?.serverCopyAttempted === "boolean") {
    error.styleDropServerCopyAttempted = context.serverCopyAttempted;
  }
  return error;
};

export const getStyleDropPreviewClassifierReason = (
  error: unknown
): StyleDropPreviewClassifierReason | null => {
  if (!error || typeof error !== "object") return null;
  const reason = (error as StyleDropPreviewError).styleDropClassifierReason;
  if (typeof reason !== "string" || !reason.trim()) return null;
  return reason as StyleDropPreviewClassifierReason;
};

export const getStyleDropPreviewResolutionReason = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const reason = (error as StyleDropPreviewError).styleDropResolutionReason;
  if (typeof reason !== "string") return null;
  const normalized = reason.trim();
  return normalized.length ? normalized : null;
};

export const getStyleDropPreviewResolutionStage = (
  error: unknown
): "primary" | "server_copy_fallback" | null => {
  if (!error || typeof error !== "object") return null;
  const stage = (error as StyleDropPreviewError).styleDropResolutionStage;
  return stage === "primary" || stage === "server_copy_fallback" ? stage : null;
};

export const getStyleDropPreviewCandidateCount = (error: unknown): number | null => {
  if (!error || typeof error !== "object") return null;
  const count = (error as StyleDropPreviewError).styleDropCandidateCount;
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  return Math.max(0, Math.trunc(count));
};

export const getStyleDropPreviewServerCopyAttempted = (error: unknown): boolean | null => {
  if (!error || typeof error !== "object") return null;
  const attempted = (error as StyleDropPreviewError).styleDropServerCopyAttempted;
  return typeof attempted === "boolean" ? attempted : null;
};

export const isStyleDropPreviewErrorCode = (
  error: unknown,
  code: StyleDropPreviewErrorCode
): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.message === code) return true;
  return (error as StyleDropPreviewError).styleDropErrorCode === code;
};

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

const isSameOriginUrl = (value: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return new URL(value, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

const isSameOriginNextImageOptimizerUrl = (value: string): boolean => {
  if (!isSameOriginUrl(value)) return false;
  try {
    return new URL(value, window.location.href).pathname === "/_next/image";
  } catch {
    return false;
  }
};

const fetchDroppedImageResponse = async (sourceUrl: string): Promise<Response> => {
  const sameOrigin = isSameOriginUrl(sourceUrl);
  const initialResponse = sameOrigin
    ? await fetch(sourceUrl, { credentials: "include" })
    : await fetch(sourceUrl);
  if ((initialResponse.status === 401 || initialResponse.status === 403) && sameOrigin) {
    return fetchWithAuth(sourceUrl, {
      method: "GET",
      shortpulseLogScope: "generation",
      shortpulseSkipErrorLogging: true,
    });
  }
  return initialResponse;
};

const readImageDataUrlFromUrl = async (sourceUrl: string): Promise<string> => {
  const response = await fetchDroppedImageResponse(sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to download image (${response.status}).`);
  }
  const responseContentType = response.headers?.get?.("content-type")?.trim().toLowerCase() ?? "";
  if (responseContentType && !responseContentType.startsWith("image/")) {
    throw new Error("Dropped URL did not resolve to an image.");
  }
  const sourceBlob = await response.blob();
  if (!(sourceBlob instanceof Blob) || sourceBlob.size <= 0) {
    throw new Error("Unable to read image.");
  }
  if (sourceBlob.type && !sourceBlob.type.startsWith("image/")) {
    throw new Error("Dropped URL did not resolve to an image.");
  }
  return readFileAsDataUrl(sourceBlob);
};

const getFirstUriListValue = (value: string): string => {
  return (
    value
      .split("\n")
      .map((item) => item.trim())
      .find(Boolean) ?? ""
  );
};

const collectDroppedImageUrlCandidates = (
  transfer: DataTransfer,
  primaryCandidate: string,
  priorityCandidates: readonly string[] = [],
  options?: { preserveNextImageOptimizerUrls?: boolean }
): string[] => {
  const candidates: string[] = [];
  const addCandidate = (value: string | null | undefined) => {
    const normalized = value?.trim() ?? "";
    if (!normalized) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };
  const normalizeOptions =
    options?.preserveNextImageOptimizerUrls === true
      ? { unwrapNextImage: false as const }
      : undefined;
  const pushCandidate = (value: string | null | undefined) => {
    const normalizedPrimary =
      normalizeReferenceTransferUrlCandidate(value, normalizeOptions) ??
      (typeof value === "string" ? value.trim() : "");
    if (!normalizedPrimary) return;
    addCandidate(normalizedPrimary);
    if (options?.preserveNextImageOptimizerUrls !== true) {
      return;
    }
    const normalizedUnwrapped = normalizeReferenceTransferUrlCandidate(value);
    if (normalizedUnwrapped && normalizedUnwrapped !== normalizedPrimary) {
      addCandidate(normalizedUnwrapped);
    }
  };
  priorityCandidates.forEach((candidate) => pushCandidate(candidate));
  pushCandidate(transfer.getData(REFERENCE_RENDER_URL_TRANSFER_TYPE));
  pushCandidate(primaryCandidate);
  pushCandidate(transfer.getData("text/reference-url"));
  pushCandidate(transfer.getData("image/url"));
  pushCandidate(getFirstUriListValue(transfer.getData("text/uri-list")));
  const plainText = transfer.getData("text/plain").trim();
  if (URLISH_TEXT_PATTERN.test(plainText)) {
    pushCandidate(plainText);
  }
  return candidates;
};

const readDroppedImageDataUrlWithRefreshFallback = async (sourceUrl: string): Promise<string> => {
  const normalizedSourceUrl = sourceUrl.trim();
  if (/^data:image\//i.test(normalizedSourceUrl)) {
    return normalizedSourceUrl;
  }
  try {
    return await readImageDataUrlFromUrl(normalizedSourceUrl);
  } catch (directError) {
    if (isSameOriginNextImageOptimizerUrl(normalizedSourceUrl)) {
      throw directError;
    }
    const refreshedUrl = await prepareImageUrlForSubmission(normalizedSourceUrl).catch(() => null);
    if (!refreshedUrl || refreshedUrl.trim() === normalizedSourceUrl) {
      throw directError;
    }
    return await readImageDataUrlFromUrl(refreshedUrl);
  }
};

const resolveErrorDetails = (
  error: unknown
): { name: string; message: string; messageLower: string } => {
  const fallback = { name: "", message: "", messageLower: "" };
  if (!error) return fallback;
  if (typeof error === "string") {
    const message = error.trim();
    return { name: "", message, messageLower: message.toLowerCase() };
  }
  if (typeof error === "object") {
    const maybeRecord = error as { name?: unknown; message?: unknown };
    const name = typeof maybeRecord.name === "string" ? maybeRecord.name.trim() : "";
    const message = typeof maybeRecord.message === "string" ? maybeRecord.message.trim() : "";
    if (name || message) {
      return {
        name,
        message,
        messageLower: message.toLowerCase(),
      };
    }
  }
  const message = String(error ?? "").trim();
  return { name: "", message, messageLower: message.toLowerCase() };
};

export const normalizeStyleDropPreviewError = (
  error: unknown
): {
  code: StyleDropPreviewErrorCode;
  classifierReason: StyleDropPreviewClassifierReason;
} => {
  if (isStyleDropPreviewErrorCode(error, "missing-dropped-style-image")) {
    return {
      code: "missing-dropped-style-image",
      classifierReason: getStyleDropPreviewClassifierReason(error) ?? "missing_drop_payload",
    };
  }
  if (isStyleDropPreviewErrorCode(error, EXPIRED_STYLE_IMAGE_SOURCE_ERROR)) {
    return {
      code: EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
      classifierReason: getStyleDropPreviewClassifierReason(error) ?? "reference_url_expired",
    };
  }
  if (isStyleDropPreviewErrorCode(error, BLOCKED_STYLE_IMAGE_SOURCE_ERROR)) {
    return {
      code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
      classifierReason: getStyleDropPreviewClassifierReason(error) ?? "unknown",
    };
  }

  const { name, messageLower } = resolveErrorDetails(error);
  const nameLower = name.toLowerCase();
  const downloadStatusMatch = messageLower.match(/unable to download image \((\d{3})\)/);
  const downloadStatus = downloadStatusMatch?.[1]
    ? Number.parseInt(downloadStatusMatch[1], 10)
    : null;

  if (
    messageLower.includes("dropped url did not resolve to an image") ||
    messageLower.includes("unable to load image") ||
    messageLower.includes("unable to process image") ||
    messageLower.includes("invalid image dimensions") ||
    messageLower.includes("image could not be decoded") ||
    messageLower.includes("cannot decode image")
  ) {
    if (
      messageLower.includes("unable to load image") ||
      messageLower.includes("image could not be decoded") ||
      messageLower.includes("cannot decode image")
    ) {
      return { code: "missing-dropped-style-image", classifierReason: "image_load_failed" };
    }
    if (messageLower.includes("unable to process image")) {
      return { code: "missing-dropped-style-image", classifierReason: "image_process_failed" };
    }
    if (messageLower.includes("invalid image dimensions")) {
      return { code: "missing-dropped-style-image", classifierReason: "invalid_image_dimensions" };
    }
    return { code: "missing-dropped-style-image", classifierReason: "non_image_payload" };
  }

  const expiredOrDeniedSource =
    (typeof downloadStatus === "number" && downloadStatus >= 400 && downloadStatus < 500) ||
    messageLower.includes("reference url expired") ||
    messageLower.includes("could not be refreshed");
  if (expiredOrDeniedSource) {
    if (messageLower.includes("could not be refreshed")) {
      return {
        code: EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
        classifierReason: "reference_url_refresh_failed",
      };
    }
    if (typeof downloadStatus === "number") {
      return {
        code: EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
        classifierReason: "download_http_4xx",
      };
    }
    return {
      code: EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
      classifierReason: "reference_url_expired",
    };
  }

  if (
    messageLower.includes("unable to read image.") ||
    messageLower.includes("unable to read image file.") ||
    (typeof downloadStatus === "number" && downloadStatus >= 500) ||
    messageLower.includes("failed to fetch") ||
    messageLower.includes("network request failed") ||
    messageLower.includes("networkerror") ||
    messageLower.includes("network error") ||
    messageLower.includes("load failed") ||
    messageLower.includes("fetch failed") ||
    messageLower.includes("the internet connection appears to be offline") ||
    messageLower.includes("cors") ||
    messageLower.includes("cross-origin") ||
    messageLower.includes("tainted canvases") ||
    messageLower.includes("tainted canvas") ||
    messageLower.includes("securityerror") ||
    messageLower.includes("security error") ||
    messageLower.includes("operation is insecure") ||
    messageLower.includes("not allowed to load local resource") ||
    messageLower.includes("resource has been blocked") ||
    messageLower.includes("aborterror") ||
    messageLower.includes("aborted") ||
    nameLower.includes("securityerror") ||
    nameLower.includes("networkerror") ||
    nameLower.includes("aborterror") ||
    (nameLower.includes("typeerror") && !messageLower)
  ) {
    if (typeof downloadStatus === "number" && downloadStatus >= 500) {
      return {
        code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
        classifierReason: "download_http_5xx",
      };
    }
    if (
      messageLower.includes("unable to read image.") ||
      messageLower.includes("unable to read image file.")
    ) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "image_read_failed" };
    }
    if (messageLower.includes("failed to fetch")) {
      return {
        code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
        classifierReason: "network_failed_to_fetch",
      };
    }
    if (messageLower.includes("network request failed")) {
      return {
        code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
        classifierReason: "network_request_failed",
      };
    }
    if (messageLower.includes("networkerror") || messageLower.includes("network error")) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "network_error" };
    }
    if (messageLower.includes("load failed")) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "network_load_failed" };
    }
    if (messageLower.includes("fetch failed")) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "fetch_failed" };
    }
    if (messageLower.includes("the internet connection appears to be offline")) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "network_offline" };
    }
    if (messageLower.includes("cors") || messageLower.includes("cross-origin")) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "cors_blocked" };
    }
    if (messageLower.includes("tainted canvases") || messageLower.includes("tainted canvas")) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "canvas_tainted" };
    }
    if (
      messageLower.includes("securityerror") ||
      messageLower.includes("security error") ||
      messageLower.includes("operation is insecure") ||
      messageLower.includes("not allowed to load local resource") ||
      messageLower.includes("resource has been blocked") ||
      nameLower.includes("securityerror")
    ) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "security_error" };
    }
    if (
      messageLower.includes("aborterror") ||
      messageLower.includes("aborted") ||
      nameLower.includes("aborterror")
    ) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "request_aborted" };
    }
    if (nameLower.includes("networkerror")) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "network_error" };
    }
    if (nameLower.includes("typeerror") && !messageLower) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "fetch_failed" };
    }
    return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "unknown" };
  }

  return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "unknown" };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveServerCopyDeliveryUrl = (payload: unknown): string | null => {
  const record = asRecord(payload);
  const delivery = asRecord(record.delivery);
  return (
    normalizeReferenceTransferUrlCandidate(asOptionalString(delivery.previewUrl), {
      unwrapNextImage: false,
    }) ??
    normalizeReferenceTransferUrlCandidate(asOptionalString(delivery.fullUrl), {
      unwrapNextImage: false,
    }) ??
    null
  );
};

const isServerCopyCandidateUrl = (value: string): boolean => /^(?:https?:\/\/|\/)/i.test(value);

const collectInternalServerCopySourceUrls = (candidateUrls: readonly string[]): string[] => {
  const next: string[] = [];
  for (const candidate of candidateUrls) {
    const normalized = candidate.trim();
    if (!normalized || !isServerCopyCandidateUrl(normalized)) continue;
    if (!next.includes(normalized)) {
      next.push(normalized);
    }
  }
  return next;
};

const resolveFallbackImageUrlViaServerCopy = async ({
  sourceUrl,
  payload,
  resolvedInternalDrop,
  classifierReason,
}: {
  sourceUrl: string;
  payload: InternalReferenceDragPayload;
  resolvedInternalDrop: ResolvedInternalStyleDrop | null;
  classifierReason: StyleDropPreviewClassifierReason;
}): Promise<string | null> => {
  const hints = resolvedInternalDrop?.serverCopyHints;
  const response = await fetchWithAuth(SERVER_COPY_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: sourceUrl,
      mode: "image",
      source: "ai_studio",
      fileTypeHint: "image",
      promptText: normalizeStylePromptFallbackText(resolvedInternalDrop?.promptText),
      generationId: hints?.generationId ?? null,
      index: hints?.imageIndex ?? Math.max(0, Math.floor(payload.imageIndex ?? 0)),
      previewStoragePathHint: hints?.previewStoragePathHint ?? null,
      fullStoragePathHint: hints?.fullStoragePathHint ?? null,
      previewUrlHint: hints?.previewUrlHint ?? null,
      fullUrlHint: hints?.fullUrlHint ?? null,
      metadata: {
        style_drop_server_copy_fallback: true,
        style_drop_classifier_reason: classifierReason,
        style_drop_output_id: hints?.outputId ?? payload.outputId ?? payload.referenceId ?? null,
        style_drop_task_id: hints?.taskId ?? null,
        style_drop_media_id: hints?.mediaId ?? payload.mediaId ?? null,
      },
    }),
    shortpulseLogScope: "generation",
    shortpulseSkipErrorLogging: true,
  });
  const routePayload = await response.json().catch(() => null);
  if (!response.ok) return null;
  return resolveServerCopyDeliveryUrl(routePayload);
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
  transfer: DataTransfer,
  options?: ResolveDroppedStylePreviewOptions
): Promise<ResolvedDroppedStylePreview> => {
  let resolutionReason: string | null = null;
  let resolutionStage: "primary" | "server_copy_fallback" = "primary";
  let candidateCount = 0;
  let serverCopyAttempted = false;
  try {
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
    const internalDropPayload = extractInternalReferenceDragPayload(transfer);
    const internalDropResolution =
      internalDropPayload && options?.resolveInternalStyleDrop
        ? await options.resolveInternalStyleDrop(internalDropPayload).catch(() => null)
        : null;
    resolutionReason = internalDropResolution?.resolutionReason ?? null;
    const dragPayload = extractDragDropPayload(transfer);
    const droppedImageUrl =
      (internalDropPayload
        ? normalizeReferenceTransferUrlCandidate(transfer.getData("text/reference-url"), {
            unwrapNextImage: false,
          })
        : null) ??
      dragPayload.imageUrl?.trim() ??
      "";
    const droppedImageUrlCandidates = collectDroppedImageUrlCandidates(
      transfer,
      droppedImageUrl,
      internalDropResolution?.imageUrlCandidates ?? [],
      { preserveNextImageOptimizerUrls: Boolean(internalDropPayload) }
    );
    candidateCount = droppedImageUrlCandidates.length;
    if (!droppedImageUrlCandidates.length) {
      throw createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload");
    }
    const fallbackPromptText = normalizeStylePromptFallbackText(dragPayload.promptText);
    const internalPromptText = normalizeStylePromptFallbackText(internalDropResolution?.promptText);
    let sourceImageDataUrl: string | null = null;
    let lastReadError: unknown = null;
    for (const candidateUrl of droppedImageUrlCandidates) {
      try {
        sourceImageDataUrl = await readDroppedImageDataUrlWithRefreshFallback(candidateUrl);
        break;
      } catch (error) {
        lastReadError = error;
      }
    }
    if (!sourceImageDataUrl && internalDropPayload && STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED) {
      const normalizedReadError = normalizeStyleDropPreviewError(
        lastReadError ??
          createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload")
      );
      if (normalizedReadError.code === BLOCKED_STYLE_IMAGE_SOURCE_ERROR) {
        resolutionStage = "server_copy_fallback";
        serverCopyAttempted = true;
        const serverCopySourceUrls = collectInternalServerCopySourceUrls(droppedImageUrlCandidates);
        for (const sourceUrl of serverCopySourceUrls) {
          const fallbackUrl = await resolveFallbackImageUrlViaServerCopy({
            sourceUrl,
            payload: internalDropPayload,
            resolvedInternalDrop: internalDropResolution,
            classifierReason: normalizedReadError.classifierReason,
          }).catch(() => null);
          if (!fallbackUrl) continue;
          resolutionReason = "server_copy_delivery";
          try {
            sourceImageDataUrl = await readDroppedImageDataUrlWithRefreshFallback(fallbackUrl);
            break;
          } catch (error) {
            lastReadError = error;
          }
        }
      }
    }
    if (!sourceImageDataUrl) {
      throw (
        lastReadError ??
        createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload")
      );
    }
    const processed = await preprocessStyleImageDataUrl(sourceImageDataUrl);
    return {
      previewImageUrl: processed.previewImageUrl,
      extractionSourceImageUrl: processed.extractionSourceImageUrl,
      promptText: fallbackPromptText || internalPromptText,
    };
  } catch (error) {
    const normalizedError = normalizeStyleDropPreviewError(error);
    throw createStyleDropPreviewError(normalizedError.code, normalizedError.classifierReason, {
      resolutionReason,
      resolutionStage,
      candidateCount,
      serverCopyAttempted,
    });
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

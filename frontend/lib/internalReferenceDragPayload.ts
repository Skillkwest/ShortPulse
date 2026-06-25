/**
 * Shared internal reference drag payload helpers.
 * Provides a neutral parsing seam for AI Studio-originated reference drags consumed across features.
 */
import {
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  getComposerImageDropSessionToken,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  getInternalReferenceDragSessionToken,
  resolveComposerImageDropSession,
  resolveInternalReferenceDragSession,
} from "./internalReferenceDragSession";

const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const RELATIVE_MEDIA_PATH_HINT_PATTERN =
  /^\/(?:_next\/image|storage\/|.*\.(?:aac|avif|bmp|flac|gif|heic|heif|jpe?g|m4a|mp3|oga|ogg|png|wav|webp|m4v|mov|mp4|ogv|webm)(?:$|[?#]))/i;

const INTERNAL_REFERENCE_DRAG_VERSION = 1;
const REFERENCE_TRANSFER_ORIGIN_TYPE = "text/reference-origin";
const REFERENCE_TRANSFER_VERSION_TYPE = "text/reference-version";
const REFERENCE_TRANSFER_OUTPUT_ID_TYPE = "text/reference-output-id";
const REFERENCE_TRANSFER_IMAGE_INDEX_TYPE = "text/reference-image-index";
const REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE = "text/reference-source-surface";
const REFERENCE_TRANSFER_MEDIA_ID_TYPE = "text/reference-media-id";
const REFERENCE_TRANSFER_MEDIA_KIND_TYPE = "text/reference-media-kind";
const REFERENCE_TRANSFER_WIDTH_TYPE = "text/reference-width";
const REFERENCE_TRANSFER_HEIGHT_TYPE = "text/reference-height";
const REFERENCE_TRANSFER_PREVIEW_STORAGE_PATH_TYPE = "text/reference-preview-storage-path";
const REFERENCE_TRANSFER_FULL_STORAGE_PATH_TYPE = "text/reference-full-storage-path";
export const COMPOSER_IMAGE_DROP_PAYLOAD_TYPE = "application/x-shortpulse-composer-image-drop";
export const COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE = "text/reference-composer-image-payload";
const INTERNAL_REFERENCE_TRANSFER_TYPE_HINTS = new Set([
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  "text/reference-id",
  "text/reference-output-id",
  "text/reference-media-id",
  "text/reference-origin",
  "text/reference-source-surface",
]);

export type ReferenceDragSourceSurface = "all-refs" | "curated";
export const INTERNAL_REFERENCE_DRAG_ORIGIN = "ai-studio-reference-grid" as const;
const normalizedTransferTypesCache = new WeakMap<object, string[]>();

export type InternalReferenceDragPayload = {
  version: number;
  origin: typeof INTERNAL_REFERENCE_DRAG_ORIGIN;
  referenceId: string | null;
  outputId: string | null;
  imageIndex: number;
  mediaId: string | null;
  mediaKind?: "image" | "video" | "audio" | "text" | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  referenceUrl: string | null;
  referenceRenderUrl?: string | null;
  promptText?: string | null;
  sourceSurface: ReferenceDragSourceSurface | null;
  width?: number;
  height?: number;
  sessionBacked?: boolean;
};

export type ComposerImageDropPayload = {
  version: number;
  origin: typeof INTERNAL_REFERENCE_DRAG_ORIGIN;
  referenceId: string | null;
  outputId: string | null;
  mediaId: string | null;
  displayArtifactUrl: string;
  displayArtifactKind: "blob" | "data" | "url";
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  referenceUrl?: string | null;
  promptText?: string | null;
  sourceSurface: ReferenceDragSourceSurface | null;
  width?: number;
  height?: number;
  mimeType?: string | null;
};

/**
 * Normalizes a composer image-drop payload into the shared internal reference drag payload shape.
 */
export const buildInternalPayloadFromComposerDropPayload = (
  composerPayload: ComposerImageDropPayload | null
): InternalReferenceDragPayload | null => {
  if (!composerPayload) return null;
  return {
    version: composerPayload.version,
    origin: composerPayload.origin,
    referenceId: composerPayload.referenceId,
    outputId: composerPayload.outputId,
    imageIndex: 0,
    mediaId: composerPayload.mediaId,
    ...(composerPayload.previewStoragePath
      ? { previewStoragePath: composerPayload.previewStoragePath }
      : {}),
    ...(composerPayload.fullStoragePath
      ? { fullStoragePath: composerPayload.fullStoragePath }
      : {}),
    referenceUrl: composerPayload.referenceUrl ?? null,
    ...(composerPayload.displayArtifactUrl
      ? { referenceRenderUrl: composerPayload.displayArtifactUrl }
      : {}),
    ...(normalizePromptText(composerPayload.promptText)
      ? { promptText: normalizePromptText(composerPayload.promptText) }
      : {}),
    sourceSurface: composerPayload.sourceSurface,
    ...(typeof composerPayload.width === "number" ? { width: composerPayload.width } : {}),
    ...(typeof composerPayload.height === "number" ? { height: composerPayload.height } : {}),
  };
};

const toAbsoluteTransferUrl = (value: string): string => {
  if (!value.startsWith("/")) return value;
  if (!RELATIVE_MEDIA_PATH_HINT_PATTERN.test(value)) return value;
  if (typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return value;
  }
};

const unwrapNextImageTransferUrl = (value: string): string => {
  if (typeof window === "undefined") return value;
  try {
    const parsed = new URL(value, window.location.href);
    if (parsed.pathname !== NEXT_IMAGE_OPTIMIZER_PATH) return value;
    const sourceUrl = parsed.searchParams.get("url")?.trim();
    if (!sourceUrl) return value;
    return toAbsoluteTransferUrl(sourceUrl);
  } catch {
    return value;
  }
};

const normalizeReferenceTransferUrlCandidate = (
  value: string | null | undefined,
  options?: {
    unwrapNextImage?: boolean;
  }
): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withAbsoluteOrigin = toAbsoluteTransferUrl(trimmed);
  const shouldUnwrapNextImage = options?.unwrapNextImage ?? true;
  const unwrapped = (
    shouldUnwrapNextImage ? unwrapNextImageTransferUrl(withAbsoluteOrigin) : withAbsoluteOrigin
  ).trim();
  return unwrapped || null;
};

const parseReferenceDragSourceSurface = (
  value: string | null | undefined
): ReferenceDragSourceSurface | null => {
  const candidate = (value ?? "").trim().toLowerCase();
  if (candidate === "all-refs" || candidate === "curated") return candidate;
  return null;
};

const parseReferenceImageIndex = (value: string | null | undefined): number => {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const parseReferenceDimension = (value: string | null | undefined): number | undefined => {
  const parsed = Number.parseFloat((value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const normalizeReferenceTransferId = (value: string | null | undefined): string | null => {
  const candidate = (value ?? "").trim();
  return candidate.length ? candidate : null;
};

const normalizePromptText = (value: string | null | undefined): string | null => {
  const candidate = (value ?? "").trim();
  return candidate.length ? candidate : null;
};

const parseReferenceMediaKind = (
  value: string | null | undefined
): InternalReferenceDragPayload["mediaKind"] => {
  const candidate = (value ?? "").trim().toLowerCase();
  if (
    candidate === "image" ||
    candidate === "video" ||
    candidate === "audio" ||
    candidate === "text"
  ) {
    return candidate;
  }
  return null;
};

/**
 * Normalizes `DataTransfer.types` for drag/drop policy checks.
 */
export const getNormalizedTransferTypes = (
  transfer: Pick<DataTransfer, "types"> | null | undefined
): string[] => {
  if (!transfer) return [];
  const cacheKey = transfer as object;
  const cachedTypes = normalizedTransferTypesCache.get(cacheKey);
  if (cachedTypes) {
    return cachedTypes;
  }
  const normalizedTypes = Array.from(transfer.types || [])
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);
  normalizedTransferTypesCache.set(cacheKey, normalizedTypes);
  return normalizedTypes;
};

/**
 * Checks whether a drag transfer contains internal reference payload hints.
 */
export const hasInternalReferenceDragTypeHints = (
  transfer: DataTransfer | null | undefined
): boolean => {
  if (!transfer) return false;
  return getNormalizedTransferTypes(transfer).some((type) =>
    INTERNAL_REFERENCE_TRANSFER_TYPE_HINTS.has(type)
  );
};

/**
 * Parses the shared internal reference drag payload from a `DataTransfer`.
 */
export const extractInternalReferenceDragPayload = (
  transfer: DataTransfer | null | undefined
): InternalReferenceDragPayload | null => {
  if (!transfer) return null;
  const sessionPayload = resolveInternalReferenceDragSession(
    getInternalReferenceDragSessionToken(transfer)
  );
  if (sessionPayload) {
    return {
      ...sessionPayload,
      sessionBacked: true,
    };
  }
  const originRaw = transfer.getData(REFERENCE_TRANSFER_ORIGIN_TYPE).trim().toLowerCase();
  const sourceSurface = parseReferenceDragSourceSurface(
    transfer.getData(REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE)
  );
  const referenceId = normalizeReferenceTransferId(transfer.getData("text/reference-id"));
  const outputId =
    normalizeReferenceTransferId(transfer.getData(REFERENCE_TRANSFER_OUTPUT_ID_TYPE)) ??
    referenceId;
  const mediaId = normalizeReferenceTransferId(transfer.getData(REFERENCE_TRANSFER_MEDIA_ID_TYPE));
  const mediaKind = parseReferenceMediaKind(transfer.getData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE));
  const width = parseReferenceDimension(transfer.getData(REFERENCE_TRANSFER_WIDTH_TYPE));
  const height = parseReferenceDimension(transfer.getData(REFERENCE_TRANSFER_HEIGHT_TYPE));
  const previewStoragePath = normalizeReferenceTransferUrlCandidate(
    transfer.getData(REFERENCE_TRANSFER_PREVIEW_STORAGE_PATH_TYPE),
    { unwrapNextImage: false }
  );
  const fullStoragePath = normalizeReferenceTransferUrlCandidate(
    transfer.getData(REFERENCE_TRANSFER_FULL_STORAGE_PATH_TYPE),
    { unwrapNextImage: false }
  );
  const referenceUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData("text/reference-url"),
    { unwrapNextImage: false }
  );
  const referenceRenderUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData("text/reference-render-url"),
    { unwrapNextImage: false }
  );
  const hasLegacyInternalHints = Boolean(referenceId && sourceSurface);
  const hasStrongInternalHints = Boolean(outputId || mediaId);

  if (!originRaw && !hasLegacyInternalHints && !hasStrongInternalHints) return null;
  if (originRaw && originRaw !== INTERNAL_REFERENCE_DRAG_ORIGIN) return null;
  if (!outputId && !referenceId && !mediaId && !referenceUrl) return null;

  const payload: InternalReferenceDragPayload = {
    version: Number.parseInt(transfer.getData(REFERENCE_TRANSFER_VERSION_TYPE), 10) || 1,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId,
    outputId,
    imageIndex: parseReferenceImageIndex(transfer.getData(REFERENCE_TRANSFER_IMAGE_INDEX_TYPE)),
    mediaId,
    ...(mediaKind ? { mediaKind } : {}),
    ...(previewStoragePath ? { previewStoragePath } : {}),
    ...(fullStoragePath ? { fullStoragePath } : {}),
    referenceUrl,
    ...(referenceRenderUrl ? { referenceRenderUrl } : {}),
    sourceSurface,
    sessionBacked: false,
  };

  if (typeof width === "number") payload.width = width;
  if (typeof height === "number") payload.height = height;
  if (payload.version <= 0) payload.version = INTERNAL_REFERENCE_DRAG_VERSION;

  return payload;
};

/**
 * Parses a dedicated composer image-drop payload from a `DataTransfer`.
 */
export const extractComposerImageDropPayload = (
  transfer: DataTransfer | null | undefined
): ComposerImageDropPayload | null => {
  if (!transfer) return null;
  const sessionPayload = resolveComposerImageDropSession(
    getComposerImageDropSessionToken(transfer)
  );
  if (sessionPayload) {
    return sessionPayload;
  }
  const rawPayload =
    transfer.getData(COMPOSER_IMAGE_DROP_PAYLOAD_TYPE) ||
    transfer.getData(COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE);
  const trimmedPayload = rawPayload.trim();
  if (!trimmedPayload) return null;

  try {
    const parsed = JSON.parse(trimmedPayload) as Partial<ComposerImageDropPayload>;
    if (parsed.origin !== INTERNAL_REFERENCE_DRAG_ORIGIN) return null;
    const displayArtifactUrl = normalizeReferenceTransferUrlCandidate(parsed.displayArtifactUrl, {
      unwrapNextImage: false,
    });
    if (!displayArtifactUrl) return null;

    const displayArtifactKind =
      parsed.displayArtifactKind === "blob" ||
      parsed.displayArtifactKind === "data" ||
      parsed.displayArtifactKind === "url"
        ? parsed.displayArtifactKind
        : displayArtifactUrl.startsWith("blob:")
          ? "blob"
          : displayArtifactUrl.startsWith("data:")
            ? "data"
            : "url";

    const payload: ComposerImageDropPayload = {
      version:
        typeof parsed.version === "number" && Number.isFinite(parsed.version) && parsed.version > 0
          ? Math.floor(parsed.version)
          : INTERNAL_REFERENCE_DRAG_VERSION,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: normalizeReferenceTransferId(parsed.referenceId),
      outputId:
        normalizeReferenceTransferId(parsed.outputId) ??
        normalizeReferenceTransferId(parsed.referenceId),
      mediaId: normalizeReferenceTransferId(parsed.mediaId),
      displayArtifactUrl,
      displayArtifactKind,
      sourceSurface: parseReferenceDragSourceSurface(parsed.sourceSurface),
      ...(normalizeReferenceTransferUrlCandidate(parsed.previewStoragePath, {
        unwrapNextImage: false,
      })
        ? {
            previewStoragePath: normalizeReferenceTransferUrlCandidate(parsed.previewStoragePath, {
              unwrapNextImage: false,
            }),
          }
        : {}),
      ...(normalizeReferenceTransferUrlCandidate(parsed.fullStoragePath, {
        unwrapNextImage: false,
      })
        ? {
            fullStoragePath: normalizeReferenceTransferUrlCandidate(parsed.fullStoragePath, {
              unwrapNextImage: false,
            }),
          }
        : {}),
      ...(normalizeReferenceTransferUrlCandidate(parsed.referenceUrl, {
        unwrapNextImage: false,
      })
        ? {
            referenceUrl: normalizeReferenceTransferUrlCandidate(parsed.referenceUrl, {
              unwrapNextImage: false,
            }),
          }
        : {}),
      ...(normalizePromptText(parsed.promptText)
        ? { promptText: normalizePromptText(parsed.promptText) }
        : {}),
      ...(typeof parseReferenceDimension(String(parsed.width ?? "")) === "number"
        ? { width: parseReferenceDimension(String(parsed.width ?? "")) }
        : {}),
      ...(typeof parseReferenceDimension(String(parsed.height ?? "")) === "number"
        ? { height: parseReferenceDimension(String(parsed.height ?? "")) }
        : {}),
      ...(normalizePromptText(parsed.mimeType)
        ? { mimeType: normalizePromptText(parsed.mimeType) }
        : {}),
    };

    return payload;
  } catch {
    return null;
  }
};

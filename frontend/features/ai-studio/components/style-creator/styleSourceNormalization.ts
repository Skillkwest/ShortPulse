/**
 * Style-source normalization helpers.
 * Converts files, drops, and internal descriptors into one normalized source ready for derivation.
 */
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import {
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../../lib/internalReferenceDragSession";
import {
  buildInternalPayloadFromComposerDropPayload,
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
} from "../../../../lib/internalReferenceDragPayload";
import {
  BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
  EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
  IMAGE_FILE_EXTENSION_PATTERN,
  STYLE_IMAGE_SOURCE_TOO_LARGE_ERROR,
  STYLE_SOURCE_IMAGE_MAX_BYTES,
  STYLE_PROMPT_MAX_CHARACTERS,
} from "./constants";
import {
  buildStyleDropSnapshotTransfer,
  captureStyleDropSnapshot,
  type StyleDropSnapshot,
} from "./styleSourceCapture";
import { readFileAsDataUrl } from "./styleImageDerivation";
import type { ResolveInternalStyleDrop, ResolvedInternalStyleSource } from "./styleSourceResolver";
import {
  extractComposerImageDropPayload,
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
  type InternalReferenceDragPayload,
  normalizeReferenceTransferUrlCandidate,
} from "../../utils/dragDrop";
import { refreshSupabaseSignedUrlIfNeeded } from "../../utils/imageUpload";

const SERVER_COPY_ROUTE = "/api/media/copy-from-url";
const STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED !== "false";
const IMAGE_FILENAME_TEXT_PATTERN =
  /(?:^|[\\/])[^\\/\n]+\.(?:avif|bmp|gif|heic|heif|jpe?g|png|webp|tiff?)$/i;
const CAMERA_FILENAME_STEM_PATTERN = /^(?:img|dsc|pxl|mvimg|screenshot)[-_ ]?\d[\w .:-]*$/i;
const URLISH_TEXT_PATTERN = /^(?:data:image\/|blob:|https?:\/\/|\/)/i;

export type StyleDropPreviewErrorCode =
  | "missing-dropped-style-image"
  | typeof BLOCKED_STYLE_IMAGE_SOURCE_ERROR
  | typeof EXPIRED_STYLE_IMAGE_SOURCE_ERROR
  | typeof STYLE_IMAGE_SOURCE_TOO_LARGE_ERROR;

export type StyleDropPreviewClassifierReason =
  | "missing_drop_payload"
  | "non_image_payload"
  | "internal_source_unresolved"
  | "image_read_failed"
  | "download_http_4xx"
  | "download_http_5xx"
  | "network_failed_to_fetch"
  | "network_request_failed"
  | "request_aborted"
  | "reference_url_expired"
  | "source_image_too_large"
  | "unknown";

type StyleDropPreviewError = Error & {
  styleDropErrorCode?: StyleDropPreviewErrorCode;
  styleDropClassifierReason?: StyleDropPreviewClassifierReason;
  styleDropResolutionReason?: string | null;
  styleDropResolutionStage?: "primary" | "server_copy_fallback";
  styleDropCandidateCount?: number;
};

export type ResolvedStyleSource = {
  kind: "file" | "internal" | "external";
  sourceImageDataUrl: string;
  promptText: string;
  internalPayloadPresent: boolean;
  resolutionReason: string | null;
  resolutionStage: "primary" | "server_copy_fallback";
  candidateCount: number;
};

const createStyleDropPreviewError = (
  code: StyleDropPreviewErrorCode,
  classifierReason: StyleDropPreviewClassifierReason,
  context?: {
    resolutionReason?: string | null;
    resolutionStage?: "primary" | "server_copy_fallback";
    candidateCount?: number;
  }
): StyleDropPreviewError => {
  const error = new Error(code) as StyleDropPreviewError;
  error.styleDropErrorCode = code;
  error.styleDropClassifierReason = classifierReason;
  error.styleDropResolutionReason = context?.resolutionReason ?? null;
  error.styleDropResolutionStage = context?.resolutionStage ?? "primary";
  error.styleDropCandidateCount = context?.candidateCount ?? 0;
  return error;
};

export const getStyleDropPreviewClassifierReason = (
  error: unknown
): StyleDropPreviewClassifierReason | null => {
  if (!error || typeof error !== "object") return null;
  const reason = (error as StyleDropPreviewError).styleDropClassifierReason;
  return typeof reason === "string" && reason.trim() ? reason : null;
};

export const getStyleDropPreviewResolutionReason = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const reason = (error as StyleDropPreviewError).styleDropResolutionReason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
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

export const normalizeStyleDropPreviewError = (
  error: unknown
): { code: StyleDropPreviewErrorCode; classifierReason: StyleDropPreviewClassifierReason } => {
  const explicitClassifierReason = getStyleDropPreviewClassifierReason(error);
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message === STYLE_IMAGE_SOURCE_TOO_LARGE_ERROR) {
      return {
        code: STYLE_IMAGE_SOURCE_TOO_LARGE_ERROR,
        classifierReason: "source_image_too_large",
      };
    }
    if (message === EXPIRED_STYLE_IMAGE_SOURCE_ERROR) {
      return { code: EXPIRED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "reference_url_expired" };
    }
    if (message === BLOCKED_STYLE_IMAGE_SOURCE_ERROR) {
      return {
        code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
        classifierReason: explicitClassifierReason ?? "network_failed_to_fetch",
      };
    }
    if (message === "missing-dropped-style-image") {
      return { code: "missing-dropped-style-image", classifierReason: "missing_drop_payload" };
    }
    if (/401|403|404/.test(message)) {
      return { code: EXPIRED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "reference_url_expired" };
    }
    if (/aborted/i.test(message)) {
      return { code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "request_aborted" };
    }
  }
  return {
    code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
    classifierReason: explicitClassifierReason ?? "unknown",
  };
};

const STYLE_SOURCE_IMAGE_DATA_URL_MAX_CHARS =
  Math.ceil((STYLE_SOURCE_IMAGE_MAX_BYTES * 4) / 3) + 256;

const createStyleImageTooLargeError = (): StyleDropPreviewError =>
  createStyleDropPreviewError(STYLE_IMAGE_SOURCE_TOO_LARGE_ERROR, "source_image_too_large");

const assertStyleImageBlobWithinReadBudget = (blob: Blob): void => {
  if (blob.size > STYLE_SOURCE_IMAGE_MAX_BYTES) {
    throw createStyleImageTooLargeError();
  }
};

const assertStyleImageDataUrlWithinReadBudget = (sourceDataUrl: string): void => {
  if (sourceDataUrl.length > STYLE_SOURCE_IMAGE_DATA_URL_MAX_CHARS) {
    throw createStyleImageTooLargeError();
  }
};

const readStyleImageBlobAsDataUrl = async (blob: Blob): Promise<string> => {
  assertStyleImageBlobWithinReadBudget(blob);
  return readFileAsDataUrl(blob);
};

const resolveResponseContentLengthBytes = (response: Response): number | null => {
  const rawHeader = response.headers?.get("content-length") ?? null;
  if (!rawHeader) return null;
  const parsed = Number(rawHeader);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
};

const readResponseBlobWithinReadBudget = async (response: Response): Promise<Blob> => {
  const contentLengthBytes = resolveResponseContentLengthBytes(response);
  if (contentLengthBytes != null && contentLengthBytes > STYLE_SOURCE_IMAGE_MAX_BYTES) {
    throw createStyleImageTooLargeError();
  }
  if (!response.body) {
    const blob = await response.blob();
    assertStyleImageBlobWithinReadBudget(blob);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > STYLE_SOURCE_IMAGE_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw createStyleImageTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new Blob(chunks, {
    type: response.headers?.get("content-type") ?? undefined,
  });
};

/**
 * Returns true when a dropped file is a supported image candidate.
 */
export const isImageFileCandidate = (file: File): boolean => {
  if (file.type.startsWith("image/")) return true;
  return !file.type && IMAGE_FILE_EXTENSION_PATTERN.test(file.name);
};

const getFirstUriListValue = (value: string): string | null =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0 && !item.startsWith("#")) ?? null;

const dedupeStyleSourceUrls = (values: Array<string | null | undefined>): string[] => {
  const next: string[] = [];
  values.forEach((value) => {
    const normalized = value?.trim() ?? "";
    if (!normalized || next.includes(normalized)) return;
    next.push(normalized);
  });
  return next;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

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

const isSameOriginUrl = (value: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return new URL(value, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

const fetchDroppedImageResponse = async (sourceUrl: string): Promise<Response> => {
  const refreshedUrl = await refreshSupabaseSignedUrlIfNeeded(sourceUrl).catch(() => sourceUrl);
  const sameOrigin = isSameOriginUrl(refreshedUrl);
  const initialResponse = sameOrigin
    ? await fetch(refreshedUrl, { credentials: "include" })
    : await fetch(refreshedUrl);
  if ((initialResponse.status === 401 || initialResponse.status === 403) && sameOrigin) {
    return fetchWithAuth(refreshedUrl, {
      method: "GET",
      shortpulseLogScope: "generation",
      shortpulseSkipErrorLogging: true,
    });
  }
  return initialResponse;
};

const readImageDataUrlFromUrl = async (sourceUrl: string): Promise<string> => {
  if (/^data:image\//i.test(sourceUrl)) {
    assertStyleImageDataUrlWithinReadBudget(sourceUrl);
    return sourceUrl;
  }
  const response = await fetchDroppedImageResponse(sourceUrl);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error(EXPIRED_STYLE_IMAGE_SOURCE_ERROR);
    }
    if (response.status >= 400 && response.status < 500) {
      throw new Error(`download_http_4xx:${response.status}`);
    }
    if (response.status >= 500) {
      throw new Error(`download_http_5xx:${response.status}`);
    }
    throw new Error(BLOCKED_STYLE_IMAGE_SOURCE_ERROR);
  }
  const blob = await readResponseBlobWithinReadBudget(response);
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error("image_read_failed");
  }
  return await readStyleImageBlobAsDataUrl(blob);
};

const hasSnapshotReferenceImageHints = (snapshot: StyleDropSnapshot): boolean => {
  const normalizedTransferTypes = snapshot.transferTypes.map((type) => type.trim().toLowerCase());
  const normalizedImageUrl = normalizeReferenceTransferUrlCandidate(snapshot.imageUrl, {
    unwrapNextImage: false,
  });
  const normalizedReferenceUrl = normalizeReferenceTransferUrlCandidate(snapshot.referenceUrl, {
    unwrapNextImage: false,
  });
  const normalizedRenderUrl = normalizeReferenceTransferUrlCandidate(snapshot.referenceRenderUrl, {
    unwrapNextImage: false,
  });
  const normalizedUriUrl = normalizeReferenceTransferUrlCandidate(
    getFirstUriListValue(snapshot.uriList),
    {
      unwrapNextImage: false,
    }
  );
  const normalizedPlainTextUrl = URLISH_TEXT_PATTERN.test(snapshot.plainText.trim())
    ? normalizeReferenceTransferUrlCandidate(snapshot.plainText.trim(), { unwrapNextImage: false })
    : null;
  const hasReferenceTransferTypeHints = normalizedTransferTypes.some(
    (type) =>
      type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE.toLowerCase() ||
      type === INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE.toLowerCase() ||
      type === COMPOSER_IMAGE_DROP_SESSION_TYPE.toLowerCase() ||
      type === COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE.toLowerCase() ||
      type === COMPOSER_IMAGE_DROP_PAYLOAD_TYPE.toLowerCase() ||
      type === COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE.toLowerCase() ||
      type === "text/reference-origin" ||
      type === "text/reference-id" ||
      type === "text/reference-output-id" ||
      type === "text/reference-media-id" ||
      type === "text/reference-preview-storage-path" ||
      type === "text/reference-full-storage-path" ||
      type === "text/reference-source-surface" ||
      type === "text/reference-url" ||
      type === "text/reference-render-url" ||
      type === "image/url"
  );

  return Boolean(
    hasReferenceTransferTypeHints ||
    snapshot.internalReferenceDragToken.trim() ||
    snapshot.composerImageDropToken.trim() ||
    snapshot.composerImageDropPayload.trim() ||
    snapshot.referenceOrigin.trim() ||
    snapshot.referenceId.trim() ||
    snapshot.referenceOutputId.trim() ||
    snapshot.referenceMediaId.trim() ||
    snapshot.referencePreviewStoragePath.trim() ||
    snapshot.referenceFullStoragePath.trim() ||
    snapshot.referenceSourceSurface.trim() ||
    normalizedImageUrl ||
    normalizedReferenceUrl ||
    normalizedRenderUrl ||
    normalizedUriUrl ||
    normalizedPlainTextUrl
  );
};

const isServerCopyCandidateUrl = (value: string): boolean => /^(?:https?:\/\/|\/)/i.test(value);

const collectInternalServerCopySourceUrls = (candidateUrls: readonly string[]): string[] => {
  const next: string[] = [];
  for (const candidate of candidateUrls) {
    const normalized = candidate.trim();
    if (!normalized || !isServerCopyCandidateUrl(normalized)) continue;
    if (!next.includes(normalized)) next.push(normalized);
  }
  return next;
};

const collectSnapshotServerCopySourceUrls = ({
  snapshot,
  internalDropPayload,
  dragPayloadImageUrl,
  composerPayloadImageUrl,
  composerPayloadReferenceUrl,
}: {
  snapshot: StyleDropSnapshot;
  internalDropPayload: InternalReferenceDragPayload | null;
  dragPayloadImageUrl?: string | null;
  composerPayloadImageUrl?: string | null;
  composerPayloadReferenceUrl?: string | null;
}): string[] =>
  collectInternalServerCopySourceUrls(
    dedupeStyleSourceUrls([
      composerPayloadImageUrl,
      snapshot.referenceRenderUrl,
      snapshot.imageUrl,
      composerPayloadReferenceUrl,
      snapshot.referenceUrl,
      getFirstUriListValue(snapshot.uriList),
      dragPayloadImageUrl,
      internalDropPayload?.referenceRenderUrl,
      internalDropPayload?.referenceUrl,
    ])
  );

const resolveFallbackImageUrlViaServerCopy = async ({
  sourceUrl,
  payload,
  internalSource,
  promptText,
  classifierReason,
}: {
  sourceUrl: string;
  payload: InternalReferenceDragPayload;
  internalSource: ResolvedInternalStyleSource | null;
  promptText: string;
  classifierReason: StyleDropPreviewClassifierReason;
}): Promise<string | null> => {
  const generationId = internalSource?.generationId?.trim() ?? "";
  if (!generationId) return null;
  const response = await fetchWithAuth(SERVER_COPY_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: sourceUrl,
      mode: "image",
      source: "ai_studio",
      fileTypeHint: "image",
      generationId,
      index: Math.max(0, Math.floor(payload.imageIndex ?? 0)),
      previewStoragePathHint: internalSource?.previewStoragePath ?? null,
      fullStoragePathHint: internalSource?.fullStoragePath ?? null,
      previewUrlHint: internalSource?.preview.url ?? null,
      fullUrlHint: internalSource?.preview.url ?? null,
      promptText,
      metadata: {
        style_drop_server_copy_fallback: true,
        style_drop_classifier_reason: classifierReason,
        style_drop_output_id:
          internalSource?.outputId ?? payload.outputId ?? payload.referenceId ?? null,
        style_drop_media_id: internalSource?.mediaId ?? payload.mediaId ?? null,
      },
    }),
    shortpulseLogScope: "generation",
    shortpulseSkipErrorLogging: true,
  });
  const routePayload = await response.json().catch(() => null);
  if (!response.ok) return null;
  return resolveServerCopyDeliveryUrl(routePayload);
};

const collectSnapshotImageUrlCandidates = ({
  snapshot,
  dragPayloadImageUrl,
  composerPayloadImageUrl,
  composerPayloadReferenceUrl,
}: {
  snapshot: StyleDropSnapshot;
  dragPayloadImageUrl?: string | null;
  composerPayloadImageUrl?: string | null;
  composerPayloadReferenceUrl?: string | null;
}): string[] => {
  const plainText = snapshot.plainText.trim();
  const snapshotUriList = getFirstUriListValue(snapshot.uriList);
  return dedupeStyleSourceUrls([
    normalizeReferenceTransferUrlCandidate(composerPayloadImageUrl, { unwrapNextImage: false }),
    normalizeReferenceTransferUrlCandidate(snapshot.referenceRenderUrl, { unwrapNextImage: false }),
    normalizeReferenceTransferUrlCandidate(snapshot.imageUrl, { unwrapNextImage: false }),
    normalizeReferenceTransferUrlCandidate(composerPayloadReferenceUrl, { unwrapNextImage: false }),
    normalizeReferenceTransferUrlCandidate(snapshot.referenceUrl, { unwrapNextImage: false }),
    normalizeReferenceTransferUrlCandidate(snapshotUriList, { unwrapNextImage: false }),
    normalizeReferenceTransferUrlCandidate(dragPayloadImageUrl, { unwrapNextImage: false }),
    URLISH_TEXT_PATTERN.test(plainText)
      ? normalizeReferenceTransferUrlCandidate(plainText, { unwrapNextImage: false })
      : null,
  ]);
};

/**
 * Sanitizes drag-drop prompt fallback text used when extraction fails.
 */
export const normalizeStylePromptFallbackText = (value: string | null | undefined): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (/^file:\/\//i.test(trimmed)) return "";
  if (IMAGE_FILENAME_TEXT_PATTERN.test(trimmed)) return "";
  if (CAMERA_FILENAME_STEM_PATTERN.test(trimmed) && !/[,.]/.test(trimmed)) return "";
  return trimmed.slice(0, STYLE_PROMPT_MAX_CHARACTERS);
};

const resolveInternalSourceDataUrl = async (
  internalSource: ResolvedInternalStyleSource
): Promise<string> => {
  const blob = await internalSource.loadBlob();
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error(BLOCKED_STYLE_IMAGE_SOURCE_ERROR);
  }
  return await readStyleImageBlobAsDataUrl(blob);
};

/**
 * Resolves a single usable style source from either a dropped file or transfer payload.
 * This is the authoritative intake boundary for preview derivation and style extraction.
 */
export const resolveStyleSource = async ({
  file,
  dropSnapshot,
  transfer,
  resolveInternalStyleDrop,
}: {
  file?: File | null;
  dropSnapshot?: StyleDropSnapshot | null;
  transfer?: DataTransfer | null;
  resolveInternalStyleDrop?: ResolveInternalStyleDrop;
}): Promise<ResolvedStyleSource> => {
  if (file) {
    if (!isImageFileCandidate(file)) {
      throw createStyleDropPreviewError("missing-dropped-style-image", "non_image_payload");
    }
    return {
      kind: "file",
      sourceImageDataUrl: await readStyleImageBlobAsDataUrl(file),
      promptText: "",
      internalPayloadPresent: false,
      resolutionReason: null,
      resolutionStage: "primary",
      candidateCount: 0,
    };
  }

  const snapshot = dropSnapshot ?? (transfer ? captureStyleDropSnapshot(transfer) : null);
  if (!snapshot) {
    throw createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload");
  }

  const transferLikeSnapshot = buildStyleDropSnapshotTransfer(snapshot);
  const composerDropPayload = extractComposerImageDropPayload(transferLikeSnapshot);
  const internalDropPayload =
    extractInternalReferenceDragPayload(transferLikeSnapshot) ??
    buildInternalPayloadFromComposerDropPayload(composerDropPayload);
  const hasStructuredReferenceDrop = Boolean(internalDropPayload || composerDropPayload);
  const hasReferenceImageHints =
    hasStructuredReferenceDrop || hasSnapshotReferenceImageHints(snapshot);
  const droppedImageFile = !hasReferenceImageHints
    ? (snapshot.files.find((candidate) => isImageFileCandidate(candidate)) ?? null)
    : null;
  if (droppedImageFile) {
    return {
      kind: "file",
      sourceImageDataUrl: await readStyleImageBlobAsDataUrl(droppedImageFile),
      promptText: "",
      internalPayloadPresent: false,
      resolutionReason: null,
      resolutionStage: "primary",
      candidateCount: 0,
    };
  }
  const internalSource =
    internalDropPayload && resolveInternalStyleDrop
      ? await resolveInternalStyleDrop(internalDropPayload).catch(() => null)
      : null;
  const dragPayload = extractDragDropPayload(transferLikeSnapshot);
  const dragPayloadImageUrl =
    hasReferenceImageHints && !internalSource ? null : (dragPayload.imageUrl ?? null);
  const promptText = normalizeStylePromptFallbackText(
    dragPayload.promptText || composerDropPayload?.promptText || internalSource?.promptText || ""
  );
  let internalResolutionError: StyleDropPreviewError | null = null;
  let resolutionStage: "primary" | "server_copy_fallback" = "primary";

  if (internalSource) {
    try {
      return {
        kind: "internal",
        sourceImageDataUrl: await resolveInternalSourceDataUrl(internalSource),
        promptText,
        internalPayloadPresent: true,
        resolutionReason: internalSource.provenance.resolutionReason,
        resolutionStage: "primary",
        candidateCount: 1,
      };
    } catch (error) {
      const normalized = normalizeStyleDropPreviewError(error);
      internalResolutionError = createStyleDropPreviewError(
        normalized.code,
        normalized.classifierReason,
        {
          resolutionReason: internalSource.provenance.resolutionReason,
          resolutionStage,
          candidateCount: 1,
        }
      );
    }
  } else if (internalDropPayload) {
    internalResolutionError = createStyleDropPreviewError(
      BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
      "internal_source_unresolved",
      {
        resolutionReason: "internal_source_unresolved",
        resolutionStage,
        candidateCount: 0,
      }
    );
  }

  const sourceUrls = collectSnapshotImageUrlCandidates({
    snapshot,
    dragPayloadImageUrl,
    composerPayloadImageUrl: composerDropPayload?.displayArtifactUrl ?? null,
    composerPayloadReferenceUrl: composerDropPayload?.referenceUrl ?? null,
  });
  const serverCopySourceUrls = collectSnapshotServerCopySourceUrls({
    snapshot,
    internalDropPayload,
    dragPayloadImageUrl,
    composerPayloadImageUrl: composerDropPayload?.displayArtifactUrl ?? null,
    composerPayloadReferenceUrl: composerDropPayload?.referenceUrl ?? null,
  });
  const suppressedSyntheticFileCount =
    hasReferenceImageHints && snapshot.files.some((candidate) => isImageFileCandidate(candidate))
      ? 1
      : 0;
  const candidateCount =
    Math.max(sourceUrls.length, serverCopySourceUrls.length) + suppressedSyntheticFileCount;
  if (!sourceUrls.length && !serverCopySourceUrls.length) {
    if (internalResolutionError) throw internalResolutionError;
    throw createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload", {
      resolutionStage,
      candidateCount,
    });
  }

  let lastError: unknown = null;
  for (const sourceUrl of sourceUrls) {
    try {
      return {
        kind: "external",
        sourceImageDataUrl: await readImageDataUrlFromUrl(sourceUrl),
        promptText,
        internalPayloadPresent: Boolean(internalDropPayload),
        resolutionReason: null,
        resolutionStage,
        candidateCount,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const normalizedLastError = normalizeStyleDropPreviewError(
    lastError ??
      internalResolutionError ??
      createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload", {
        resolutionStage,
        candidateCount,
      })
  );
  const shouldAttemptServerCopy =
    Boolean(internalDropPayload) &&
    Boolean(internalSource?.generationId?.trim()) &&
    STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED &&
    serverCopySourceUrls.length > 0 &&
    (normalizedLastError.code === BLOCKED_STYLE_IMAGE_SOURCE_ERROR ||
      normalizedLastError.code === "missing-dropped-style-image");

  if (shouldAttemptServerCopy && internalDropPayload) {
    resolutionStage = "server_copy_fallback";
    for (const sourceUrl of serverCopySourceUrls) {
      const fallbackUrl = await resolveFallbackImageUrlViaServerCopy({
        sourceUrl,
        payload: internalDropPayload,
        internalSource,
        promptText,
        classifierReason: normalizedLastError.classifierReason,
      }).catch(() => null);
      if (!fallbackUrl) continue;
      try {
        return {
          kind: "internal",
          sourceImageDataUrl: await readImageDataUrlFromUrl(fallbackUrl),
          promptText,
          internalPayloadPresent: true,
          resolutionReason: "server_copy_delivery",
          resolutionStage,
          candidateCount,
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    const normalized = normalizeStyleDropPreviewError(lastError);
    throw createStyleDropPreviewError(normalized.code, normalized.classifierReason, {
      resolutionStage,
      candidateCount,
    });
  }

  if (internalResolutionError) {
    throw createStyleDropPreviewError(
      internalResolutionError.styleDropErrorCode ?? BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
      internalResolutionError.styleDropClassifierReason ?? "unknown",
      {
        resolutionReason: internalResolutionError.styleDropResolutionReason ?? null,
        resolutionStage,
        candidateCount,
      }
    );
  }
  throw createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload", {
    resolutionStage,
    candidateCount,
  });
};

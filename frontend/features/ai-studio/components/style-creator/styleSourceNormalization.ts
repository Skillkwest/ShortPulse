/**
 * Style-source normalization helpers.
 * Converts files, drops, and internal descriptors into one normalized source ready for derivation.
 */
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import {
  BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
  EXPIRED_STYLE_IMAGE_SOURCE_ERROR,
  IMAGE_FILE_EXTENSION_PATTERN,
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
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
  normalizeReferenceTransferUrlCandidate,
} from "../../utils/dragDrop";
import { refreshSupabaseSignedUrlIfNeeded } from "../../utils/imageUpload";

const IMAGE_FILENAME_TEXT_PATTERN =
  /(?:^|[\\/])[^\\/\n]+\.(?:avif|bmp|gif|heic|heif|jpe?g|png|webp|tiff?)$/i;
const CAMERA_FILENAME_STEM_PATTERN = /^(?:img|dsc|pxl|mvimg|screenshot)[-_ ]?\d[\w .:-]*$/i;
const URLISH_TEXT_PATTERN = /^(?:data:image\/|blob:|https?:\/\/|\/)/i;

export type StyleDropPreviewErrorCode =
  | "missing-dropped-style-image"
  | typeof BLOCKED_STYLE_IMAGE_SOURCE_ERROR
  | typeof EXPIRED_STYLE_IMAGE_SOURCE_ERROR;

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
  | "unknown";

type StyleDropPreviewError = Error & {
  styleDropErrorCode?: StyleDropPreviewErrorCode;
  styleDropClassifierReason?: StyleDropPreviewClassifierReason;
  styleDropResolutionReason?: string | null;
  styleDropResolutionStage?: "primary";
  styleDropCandidateCount?: number;
  styleDropServerCopyAttempted?: boolean;
};

export type ResolvedStyleSource = {
  kind: "file" | "internal" | "external";
  sourceImageDataUrl: string;
  promptText: string;
  internalPayloadPresent: boolean;
  resolutionReason: string | null;
  resolutionStage: "primary";
  candidateCount: number;
  serverCopyAttempted: boolean;
};

const createStyleDropPreviewError = (
  code: StyleDropPreviewErrorCode,
  classifierReason: StyleDropPreviewClassifierReason,
  context?: {
    resolutionReason?: string | null;
    candidateCount?: number;
  }
): StyleDropPreviewError => {
  const error = new Error(code) as StyleDropPreviewError;
  error.styleDropErrorCode = code;
  error.styleDropClassifierReason = classifierReason;
  error.styleDropResolutionReason = context?.resolutionReason ?? null;
  error.styleDropResolutionStage = "primary";
  error.styleDropCandidateCount = context?.candidateCount ?? 0;
  error.styleDropServerCopyAttempted = false;
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
  return stage === "primary" ? stage : null;
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

export const normalizeStyleDropPreviewError = (
  error: unknown
): { code: StyleDropPreviewErrorCode; classifierReason: StyleDropPreviewClassifierReason } => {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message === EXPIRED_STYLE_IMAGE_SOURCE_ERROR) {
      return { code: EXPIRED_STYLE_IMAGE_SOURCE_ERROR, classifierReason: "reference_url_expired" };
    }
    if (message === BLOCKED_STYLE_IMAGE_SOURCE_ERROR) {
      return {
        code: BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
        classifierReason: "network_failed_to_fetch",
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
    classifierReason: getStyleDropPreviewClassifierReason(error) ?? "unknown",
  };
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
  const blob = await response.blob();
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error("image_read_failed");
  }
  return await readFileAsDataUrl(blob);
};

const collectSnapshotImageUrlCandidates = ({
  snapshot,
  dragPayloadImageUrl,
}: {
  snapshot: StyleDropSnapshot;
  dragPayloadImageUrl?: string | null;
}): string[] => {
  const plainText = snapshot.plainText.trim();
  const snapshotUriList = getFirstUriListValue(snapshot.uriList);
  return dedupeStyleSourceUrls([
    normalizeReferenceTransferUrlCandidate(snapshot.referenceRenderUrl, { unwrapNextImage: false }),
    normalizeReferenceTransferUrlCandidate(snapshot.imageUrl, { unwrapNextImage: false }),
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
  return await readFileAsDataUrl(blob);
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
      sourceImageDataUrl: await readFileAsDataUrl(file),
      promptText: "",
      internalPayloadPresent: false,
      resolutionReason: null,
      resolutionStage: "primary",
      candidateCount: 0,
      serverCopyAttempted: false,
    };
  }

  const snapshot = dropSnapshot ?? (transfer ? captureStyleDropSnapshot(transfer) : null);
  if (!snapshot) {
    throw createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload");
  }

  const droppedImageFile =
    snapshot.files.find((candidate) => isImageFileCandidate(candidate)) ?? null;
  if (droppedImageFile) {
    return {
      kind: "file",
      sourceImageDataUrl: await readFileAsDataUrl(droppedImageFile),
      promptText: "",
      internalPayloadPresent: false,
      resolutionReason: null,
      resolutionStage: "primary",
      candidateCount: 0,
      serverCopyAttempted: false,
    };
  }

  const transferLikeSnapshot = buildStyleDropSnapshotTransfer(snapshot);
  const internalDropPayload = extractInternalReferenceDragPayload(transferLikeSnapshot);
  const internalSource =
    internalDropPayload && resolveInternalStyleDrop
      ? await resolveInternalStyleDrop(internalDropPayload).catch(() => null)
      : null;
  const dragPayload = extractDragDropPayload(transferLikeSnapshot);
  const promptText = normalizeStylePromptFallbackText(
    dragPayload.promptText || internalSource?.promptText || ""
  );

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
        serverCopyAttempted: false,
      };
    } catch (error) {
      const normalized = normalizeStyleDropPreviewError(error);
      throw createStyleDropPreviewError(normalized.code, normalized.classifierReason, {
        resolutionReason: internalSource.provenance.resolutionReason,
        candidateCount: 1,
      });
    }
  }

  if (internalDropPayload && resolveInternalStyleDrop) {
    throw createStyleDropPreviewError(
      BLOCKED_STYLE_IMAGE_SOURCE_ERROR,
      "internal_source_unresolved",
      {
        resolutionReason: "internal_source_unresolved",
        candidateCount: 0,
      }
    );
  }

  const sourceUrls = collectSnapshotImageUrlCandidates({
    snapshot,
    dragPayloadImageUrl: dragPayload.imageUrl,
  });
  if (!sourceUrls.length) {
    throw createStyleDropPreviewError("missing-dropped-style-image", "missing_drop_payload");
  }

  let lastError: unknown = null;
  for (const sourceUrl of sourceUrls) {
    try {
      return {
        kind: "external",
        sourceImageDataUrl: await readImageDataUrlFromUrl(sourceUrl),
        promptText,
        internalPayloadPresent: false,
        resolutionReason: null,
        resolutionStage: "primary",
        candidateCount: sourceUrls.length,
        serverCopyAttempted: false,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const normalized = normalizeStyleDropPreviewError(lastError);
  throw createStyleDropPreviewError(normalized.code, normalized.classifierReason, {
    candidateCount: sourceUrls.length,
  });
};

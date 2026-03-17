/**
 * Character Manager drop-payload parsing/trust helpers.
 * Centralizes URL/media-id extraction and MIME inference for drag-drop ingestion.
 */

import { isTrustedMediaDirectPreviewUrl } from "../../../lib/mediaPreviewTrustPolicy";

const DROPPED_IMAGE_URL_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

export type DroppedImageReference = {
  url: string;
  mimeType: string | null;
  mediaFileId: string | null;
};

/**
 * Parses a dropped URL candidate and rejects unsupported protocols/media kinds.
 */
export const parseDropUrlCandidate = (value: string | null | undefined): string | null => {
  const candidate = (value ?? "").trim();
  if (!candidate || /^data:video\//i.test(candidate)) return null;
  if (/^data:image\//i.test(candidate)) return candidate;
  if (/^blob:/i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

/**
 * Parses a dropped media id candidate.
 */
export const parseDropMediaFileId = (value: string | null | undefined): string | null => {
  const candidate = (value ?? "").trim();
  return candidate.length ? candidate : null;
};

/**
 * Returns whether a dropped image URL is trusted for Character Manager ingestion.
 * Keeps current behavior: internal trusted-host URLs do not require explicit user scope.
 */
export const isTrustedDroppedImageUrl = (url: string): boolean => {
  if (/^data:image\//i.test(url)) return true;
  if (/^blob:/i.test(url)) return true;
  return isTrustedMediaDirectPreviewUrl(url, { requireUserScope: false });
};

/**
 * Extracts first usable URI list entry from text/uri-list payloads.
 */
export const extractFirstUriListEntry = (value: string | null | undefined): string | null =>
  (value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0 && !entry.startsWith("#")) ?? null;

/**
 * Infers MIME type from dropped URL shape.
 */
export const inferMimeTypeFromUrl = (url: string): string | null => {
  if (/^data:image\//i.test(url)) {
    const match = url.match(/^data:(image\/[^;,]+)[;,]/i);
    return match?.[1]?.toLowerCase() ?? "image/png";
  }
  if (!DROPPED_IMAGE_URL_PATTERN.test(url)) return null;
  const extension = url.split("?")[0]?.split("#")[0]?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    case "bmp":
      return "image/bmp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return null;
  }
};

/**
 * Resolves a dropped external image reference from drag data.
 */
export const resolveDroppedImageReference = (
  transfer: DataTransfer | null | undefined
): DroppedImageReference | null => {
  if (!transfer) return null;
  const mediaFileId =
    parseDropMediaFileId(transfer.getData("text/reference-media-id")) ??
    parseDropMediaFileId(transfer.getData("text/reference-id")) ??
    parseDropMediaFileId(transfer.getData("application/x-shortpulse-media-id"));

  const explicitReferenceUrl = parseDropUrlCandidate(transfer.getData("text/reference-url"));
  if (explicitReferenceUrl && isTrustedDroppedImageUrl(explicitReferenceUrl)) {
    return {
      url: explicitReferenceUrl,
      mimeType: inferMimeTypeFromUrl(explicitReferenceUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  const uriListEntry = extractFirstUriListEntry(transfer.getData("text/uri-list"));
  const uriListUrl = parseDropUrlCandidate(uriListEntry);
  if (
    uriListUrl &&
    isTrustedDroppedImageUrl(uriListUrl) &&
    (DROPPED_IMAGE_URL_PATTERN.test(uriListUrl) || /^data:image\//i.test(uriListUrl))
  ) {
    return {
      url: uriListUrl,
      mimeType: inferMimeTypeFromUrl(uriListUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  const imageUrl = parseDropUrlCandidate(transfer.getData("image/url"));
  if (imageUrl && isTrustedDroppedImageUrl(imageUrl)) {
    return {
      url: imageUrl,
      mimeType: inferMimeTypeFromUrl(imageUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  const plainTextUrl = parseDropUrlCandidate(transfer.getData("text/plain"));
  if (
    plainTextUrl &&
    isTrustedDroppedImageUrl(plainTextUrl) &&
    (DROPPED_IMAGE_URL_PATTERN.test(plainTextUrl) || /^data:image\//i.test(plainTextUrl))
  ) {
    return {
      url: plainTextUrl,
      mimeType: inferMimeTypeFromUrl(plainTextUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  return null;
};

/**
 * Returns whether the drag payload contains a trusted dropped image reference.
 */
export const hasDroppedImageReferenceTransfer = (
  transfer: DataTransfer | null | undefined
): boolean => {
  if (!transfer) return false;
  const transferTypes = Array.from(transfer.types ?? []).map((value) => value.toLowerCase());
  if (
    transferTypes.includes("text/reference-url") ||
    transferTypes.includes("text/uri-list") ||
    transferTypes.includes("image/url")
  ) {
    return true;
  }
  return Boolean(resolveDroppedImageReference(transfer));
};

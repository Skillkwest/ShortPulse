/**
 * Shared file and transfer-URL classifiers for AI Studio drag/drop payloads.
 * Keeps media-kind and URL normalization out of the drag/drop orchestration facade.
 */
import { isRenderableAdaptiveUrl } from "../../../lib/adaptive-media";
import { isAudioUrl, isVideoUrl } from "../logic/stateParsers";
import type { StudioOutput } from "../types";

const imageUrlPattern = /^(data:image\/|blob:|https?:\/\/)/i;
const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const RELATIVE_MEDIA_PATH_HINT_PATTERN =
  /^\/(?:_next\/image|storage\/|.*\.(?:aac|avif|bmp|flac|gif|heic|heif|jpe?g|m4a|mp3|oga|ogg|png|wav|webp|m4v|mov|mp4|ogv|webm)(?:$|[?#]))/i;
export const VIDEO_STORAGE_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const IMAGE_FILE_NAME_PATTERN = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i;
const VIDEO_FILE_NAME_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)$/i;
const AUDIO_FILE_NAME_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|wav|webm)$/i;

export type NormalizeReferenceTransferUrlCandidateOptions = {
  unwrapNextImage?: boolean;
};

export const isBlobUrl = (value?: string | null): boolean =>
  Boolean(value && value.startsWith("blob:"));

export const isInlineTransferHeavyUrl = (value?: string | null): boolean =>
  Boolean(value && (value.startsWith("blob:") || value.startsWith("data:")));

export const isImageFile = (file: File | null | undefined): file is File => {
  if (!file) return false;
  if (file.type.trim().toLowerCase().startsWith("image/")) return true;
  return IMAGE_FILE_NAME_PATTERN.test(file.name.trim());
};

export const findImageFile = (files?: FileList): File | null => {
  if (!files) return null;
  return Array.from(files).find(isImageFile) ?? null;
};

export const isVideoFile = (file: File | null | undefined): file is File => {
  if (!file) return false;
  if (file.type.trim().toLowerCase().startsWith("video/")) return true;
  return VIDEO_FILE_NAME_PATTERN.test(file.name.trim());
};

export const findVideoFile = (files?: FileList): File | null => {
  if (!files) return null;
  return Array.from(files).find(isVideoFile) ?? null;
};

export const isAudioFile = (file: File | null | undefined): file is File => {
  if (!file) return false;
  if (file.type.trim().toLowerCase().startsWith("audio/")) return true;
  return AUDIO_FILE_NAME_PATTERN.test(file.name.trim());
};

export const findAudioFile = (files?: FileList): File | null => {
  if (!files) return null;
  return Array.from(files).find(isAudioFile) ?? null;
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

export const normalizeReferenceTransferUrlCandidate = (
  value: string | null | undefined,
  options?: NormalizeReferenceTransferUrlCandidateOptions
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

const isCurrentDocumentUrl = (value?: string | null): boolean => {
  if (!value || typeof window === "undefined") return false;
  try {
    const current = new URL(window.location.href);
    const candidate = new URL(value, window.location.href);
    return (
      candidate.origin === current.origin &&
      candidate.pathname === current.pathname &&
      candidate.search === current.search
    );
  } catch {
    return false;
  }
};

export const resolveDraggedUrl = (
  value: string,
  referenceUrl: string | null,
  matcher: (value?: string) => boolean
): string | null => {
  const candidate = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  if (!candidate) return null;
  if (matcher(candidate)) return candidate;
  if (!referenceUrl) return null;
  if ((isBlobUrl(candidate) || isCurrentDocumentUrl(candidate)) && matcher(referenceUrl)) {
    return referenceUrl;
  }
  return null;
};

export const looksLikeImageUrl = (value?: string): boolean => {
  if (!value) return false;
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  if (isVideoUrl(normalized) || isAudioUrl(normalized)) return false;
  return (
    isRenderableAdaptiveUrl(normalized) ||
    imageUrlPattern.test(normalized) ||
    RELATIVE_MEDIA_PATH_HINT_PATTERN.test(normalized)
  );
};

export const looksLikeVideoUrl = (value?: string): boolean => {
  if (!value) return false;
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  return isVideoUrl(normalized);
};

export const looksLikeAudioUrl = (value?: string): boolean => {
  if (!value) return false;
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  return isAudioUrl(normalized);
};

export const isLikelyImageTransferUrl = (value?: string): boolean =>
  looksLikeImageUrl(value) && !looksLikeVideoUrl(value) && !looksLikeAudioUrl(value);

export const resolveDatasetPlayableTransferUrl = (
  value: string | null | undefined,
  kind: "image" | "video" | "audio" | "any"
): string | null => {
  if (kind !== "video" && kind !== "audio") return null;
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  if (kind === "video" && looksLikeVideoUrl(normalized)) return normalized;
  if (kind === "audio" && looksLikeAudioUrl(normalized)) return normalized;
  return null;
};

export const resolveReferenceTransferUrl = (
  output: Pick<
    StudioOutput,
    "previewUrl" | "previewStoragePath" | "fullStoragePath" | "resultUrls"
  >,
  kind: "image" | "video" | "audio" | "any" = "any"
): string | null => {
  const candidates = [
    output.fullStoragePath,
    output.previewStoragePath,
    ...(output.resultUrls ?? []),
    output.previewUrl,
  ];
  const localCandidates: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeReferenceTransferUrlCandidate(candidate);
    if (!normalized) continue;
    if (isBlobUrl(normalized) || normalized.startsWith("data:")) {
      localCandidates.push(normalized);
      continue;
    }
    if (!isRenderableAdaptiveUrl(normalized)) continue;
    if (kind === "image" && isLikelyImageTransferUrl(normalized)) return normalized;
    if (kind === "video" && looksLikeVideoUrl(normalized)) return normalized;
    if (kind === "audio" && looksLikeAudioUrl(normalized)) return normalized;
    if (
      kind === "any" &&
      (isLikelyImageTransferUrl(normalized) ||
        looksLikeVideoUrl(normalized) ||
        looksLikeAudioUrl(normalized))
    ) {
      return normalized;
    }
  }

  for (const candidate of localCandidates) {
    if (kind === "image" && isLikelyImageTransferUrl(candidate)) return candidate;
    if (kind === "video" && looksLikeVideoUrl(candidate)) return candidate;
    if (kind === "audio" && looksLikeAudioUrl(candidate)) return candidate;
    if (
      kind === "any" &&
      (isLikelyImageTransferUrl(candidate) ||
        looksLikeVideoUrl(candidate) ||
        looksLikeAudioUrl(candidate))
    ) {
      return candidate;
    }
  }

  return null;
};

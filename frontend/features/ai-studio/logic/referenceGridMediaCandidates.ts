/**
 * Reference-grid media candidate normalization and kind inference.
 * Keeps URL trust checks and extension-based media typing separate from display authority assembly.
 */
import { asCanonicalStoragePath, isRenderableAdaptiveUrl } from "../../../lib/adaptive-media";
import { isSupabaseRenderImageUrl } from "../../../lib/mediaPreviewTrustPolicy";
import type { StudioOutput } from "../types";
import type { ReferenceGridMediaKindHint } from "./referenceGridMediaAdaptivePreview";

type ReferenceMediaCandidate = string | null | undefined;

const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp|svg)(?:$|[?#])/i;
const AUDIO_EXTENSION_PATTERN = /\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const RELATIVE_IMAGE_PREVIEW_ROUTE_PATTERN = /^\/api\/media\/preview(?:\/|\?|$)/i;
const DATA_OR_BLOB_AUDIO_PATTERN = /^(?:blob:|data:audio\/)/i;
const DATA_OR_BLOB_VIDEO_PATTERN = /^(?:blob:|data:video\/)/i;

/**
 * Returns true when a media candidate is directly renderable by an `<img>`/`<video>` tag.
 */
export const isRenderableReferenceMediaUrl = (value: ReferenceMediaCandidate): value is string =>
  isRenderableAdaptiveUrl(value);

export const normalizeRenderableUrl = (value: ReferenceMediaCandidate): string | null => {
  if (!isRenderableReferenceMediaUrl(value)) return null;
  const trimmed = value.trim();
  if (isSupabaseRenderImageUrl(trimmed)) return null;
  return trimmed;
};

export const hasDistinctDurablePreviewAsset = (
  output: Pick<StudioOutput, "previewStoragePath" | "fullStoragePath">
): boolean => {
  const previewPath = asCanonicalStoragePath(output.previewStoragePath);
  if (!previewPath) return false;
  const fullPath = asCanonicalStoragePath(output.fullStoragePath);
  if (previewPath.includes("/variants/")) return true;
  if (!fullPath) return true;
  return previewPath !== fullPath;
};

export const isAudioMediaCandidate = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return AUDIO_EXTENSION_PATTERN.test(trimmed) || DATA_OR_BLOB_AUDIO_PATTERN.test(trimmed);
};

export const isVideoMediaCandidate = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return VIDEO_EXTENSION_PATTERN.test(trimmed) || DATA_OR_BLOB_VIDEO_PATTERN.test(trimmed);
};

export const isImageMediaCandidate = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return (
    IMAGE_EXTENSION_PATTERN.test(trimmed) || RELATIVE_IMAGE_PREVIEW_ROUTE_PATTERN.test(trimmed)
  );
};

export const firstRenderableCandidate = (
  ...candidates: ReferenceMediaCandidate[]
): string | null => {
  for (const candidate of candidates) {
    const normalized = normalizeRenderableUrl(candidate);
    if (normalized) return normalized;
  }
  return null;
};

export const firstPlayableCandidate = (
  kind: ReferenceGridMediaKindHint,
  ...candidates: ReferenceMediaCandidate[]
): string | null => {
  if (kind !== "audio" && kind !== "video") return null;
  for (const candidate of candidates) {
    const normalized = normalizeRenderableUrl(candidate);
    if (!normalized) continue;
    if (kind === "audio" && isAudioMediaCandidate(normalized)) return normalized;
    if (kind === "video" && isVideoMediaCandidate(normalized)) return normalized;
  }
  return null;
};

export const inferReferenceMediaKind = ({
  mode,
  previewStoragePath,
  fullStoragePath,
  previewUrl,
  resultUrls,
}: {
  mode?: StudioOutput["mode"] | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  resultUrls?: string[] | null;
}): ReferenceGridMediaKindHint => {
  if (mode === "image" || mode === "video" || mode === "audio") {
    return mode;
  }

  const candidates = [previewStoragePath, fullStoragePath, previewUrl, ...(resultUrls ?? [])];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (AUDIO_EXTENSION_PATTERN.test(candidate)) return "audio";
    if (VIDEO_EXTENSION_PATTERN.test(candidate)) return "video";
    if (RELATIVE_IMAGE_PREVIEW_ROUTE_PATTERN.test(candidate)) return "image";
    if (IMAGE_EXTENSION_PATTERN.test(candidate)) return "image";
  }

  return null;
};

/**
 * Media library preview aspect-ratio helpers.
 * Resolves stable thumbnail aspect ratios from metadata with safe fallbacks.
 */
import { resolveImageDimensionsFromMetadata } from "../../../lib/mediaDimensionMetadata";

type MediaAspectRatioInput = {
  fileType?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

type MediaDragDimensionsInput = MediaAspectRatioInput & {
  visualAspectRatio?: number | null;
};

const MEDIA_IMAGE_FALLBACK_ASPECT_RATIO = 4 / 5;
const MEDIA_VIDEO_FALLBACK_ASPECT_RATIO = 16 / 9;
const MEDIA_ASPECT_RATIO_MIN = 0.3;
const MEDIA_ASPECT_RATIO_MAX = 3;
const MEDIA_DRAG_DIMENSION_BASE = 1024;

const toPositiveNumber = (value: unknown): number | null => {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (typeof numericValue !== "number") return null;
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue;
};

const clampAspectRatio = (ratio: number): number =>
  Math.min(MEDIA_ASPECT_RATIO_MAX, Math.max(MEDIA_ASPECT_RATIO_MIN, ratio));

const isVideoFileType = (fileType?: string | null): boolean =>
  (fileType ?? "").toLowerCase().startsWith("video");

const resolveMetadataAspectRatio = (metadata?: Record<string, unknown> | null): number | null => {
  if (!metadata) return null;
  const dimensions = resolveImageDimensionsFromMetadata(metadata);
  if (dimensions) {
    return clampAspectRatio(dimensions.width / dimensions.height);
  }
  const directRatio = toPositiveNumber(
    metadata.aspect_ratio ?? metadata.aspectRatio ?? metadata.ratio
  );
  if (!directRatio) return null;
  return clampAspectRatio(directRatio);
};

const resolveRowAspectRatio = ({
  width,
  height,
}: {
  width?: number | string | null;
  height?: number | string | null;
}): number | null => {
  const resolvedWidth = toPositiveNumber(width);
  const resolvedHeight = toPositiveNumber(height);
  if (!resolvedWidth || !resolvedHeight) return null;
  return clampAspectRatio(resolvedWidth / resolvedHeight);
};

/**
 * Resolves a stable card aspect ratio for media previews.
 * Inputs: media file type and optional metadata payload from stored media rows.
 * Output: positive aspect ratio clamped to sane bounds for masonry layout stability.
 */
export const resolveMediaCardAspectRatio = ({
  fileType,
  width,
  height,
  metadata,
}: MediaAspectRatioInput): number => {
  const rowRatio = resolveRowAspectRatio({ width, height });
  if (rowRatio) return rowRatio;
  const metadataRatio = resolveMetadataAspectRatio(metadata);
  if (metadataRatio) return metadataRatio;
  return isVideoFileType(fileType)
    ? MEDIA_VIDEO_FALLBACK_ASPECT_RATIO
    : MEDIA_IMAGE_FALLBACK_ASPECT_RATIO;
};

/**
 * Resolves intrinsic-like dimensions for drag payloads when native dimensions are missing.
 * Values are ratio-preserving and only used for Canvas drop sizing heuristics.
 */
export const resolveMediaDragDimensions = ({
  fileType,
  width,
  height,
  metadata,
  visualAspectRatio,
}: MediaDragDimensionsInput): { width: number; height: number } => {
  const resolvedWidth = toPositiveNumber(width);
  const resolvedHeight = toPositiveNumber(height);
  if (resolvedWidth && resolvedHeight) {
    return {
      width: Math.max(1, Math.round(resolvedWidth)),
      height: Math.max(1, Math.round(resolvedHeight)),
    };
  }

  const visualAspect = toPositiveNumber(visualAspectRatio);
  const aspect = visualAspect
    ? clampAspectRatio(visualAspect)
    : resolveMediaCardAspectRatio({ fileType, width, height, metadata });
  if (aspect >= 1) {
    return {
      width: Math.max(1, Math.round(MEDIA_DRAG_DIMENSION_BASE * aspect)),
      height: MEDIA_DRAG_DIMENSION_BASE,
    };
  }
  return {
    width: MEDIA_DRAG_DIMENSION_BASE,
    height: Math.max(1, Math.round(MEDIA_DRAG_DIMENSION_BASE / Math.max(0.01, aspect))),
  };
};

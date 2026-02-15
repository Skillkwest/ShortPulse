/**
 * Media library preview aspect-ratio helpers.
 * Resolves stable thumbnail aspect ratios from metadata with safe fallbacks.
 */

type MediaAspectRatioInput = {
  fileType?: string | null;
  metadata?: Record<string, unknown> | null;
};

const MEDIA_IMAGE_FALLBACK_ASPECT_RATIO = 4 / 5;
const MEDIA_VIDEO_FALLBACK_ASPECT_RATIO = 9 / 16;
const MEDIA_ASPECT_RATIO_MIN = 0.3;
const MEDIA_ASPECT_RATIO_MAX = 3;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

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
  const directRatio = toPositiveNumber(
    metadata.aspect_ratio ?? metadata.aspectRatio ?? metadata.ratio
  );
  if (directRatio) return clampAspectRatio(directRatio);

  const dimensions = asRecord(metadata.dimensions);
  const width = toPositiveNumber(
    metadata.width ??
      metadata.image_width ??
      metadata.video_width ??
      metadata.pixel_width ??
      dimensions?.width
  );
  const height = toPositiveNumber(
    metadata.height ??
      metadata.image_height ??
      metadata.video_height ??
      metadata.pixel_height ??
      dimensions?.height
  );
  if (!width || !height) return null;
  return clampAspectRatio(width / height);
};

/**
 * Resolves a stable card aspect ratio for media previews.
 * Inputs: media file type and optional metadata payload from stored media rows.
 * Output: positive aspect ratio clamped to sane bounds for masonry layout stability.
 */
export const resolveMediaCardAspectRatio = ({
  fileType,
  metadata,
}: MediaAspectRatioInput): number => {
  const metadataRatio = resolveMetadataAspectRatio(metadata);
  if (metadataRatio) return metadataRatio;
  return isVideoFileType(fileType)
    ? MEDIA_VIDEO_FALLBACK_ASPECT_RATIO
    : MEDIA_IMAGE_FALLBACK_ASPECT_RATIO;
};

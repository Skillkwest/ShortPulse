/**
 * Media dimension metadata utilities.
 * Normalizes and writes canonical image dimension keys (`width`, `height`, `aspect_ratio`).
 */

export type ImageDimensions = {
  width: number;
  height: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.max(1, Math.round(value));
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.max(1, Math.round(parsed));
  }
  return null;
};

/**
 * Reads image dimensions from canonical or legacy metadata keys.
 */
export const resolveImageDimensionsFromMetadata = (
  metadata: Record<string, unknown> | null | undefined
): ImageDimensions | null => {
  if (!metadata) return null;
  const dimensions = asRecord(metadata.dimensions);
  const width = toPositiveInteger(
    metadata.width ??
      metadata.image_width ??
      metadata.video_width ??
      metadata.pixel_width ??
      dimensions?.width
  );
  const height = toPositiveInteger(
    metadata.height ??
      metadata.image_height ??
      metadata.video_height ??
      metadata.pixel_height ??
      dimensions?.height
  );
  if (!width || !height) return null;
  return { width, height };
};

/**
 * Merges canonical image-dimension fields into metadata.
 */
export const withCanonicalImageDimensions = (
  metadata: Record<string, unknown> | null | undefined,
  dimensions: ImageDimensions | null
): Record<string, unknown> => {
  const base = asRecord(metadata) ?? {};
  if (!dimensions) return { ...base };
  return {
    ...base,
    width: dimensions.width,
    height: dimensions.height,
    aspect_ratio: Number((dimensions.width / dimensions.height).toFixed(6)),
  };
};

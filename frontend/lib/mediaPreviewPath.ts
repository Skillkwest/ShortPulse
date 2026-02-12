/**
 * Resolves the preferred storage path for lightweight media previews.
 * Falls back to canonical `storage_path` when no variant path metadata is available.
 */

type MediaRowLike = {
  storage_path?: string | null;
  file_type?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const firstNonEmpty = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const resolveFromMetadata = (metadata: Record<string, unknown> | null | undefined) => {
  const root = toRecord(metadata);
  const variantPaths = toRecord(root.variant_paths ?? root.variantPaths);
  const variants = toRecord(root.variants);

  const thumbVariant = toRecord(variants.thumb_240 ?? variants.thumb240);
  const posterVariant = toRecord(variants.poster_720 ?? variants.poster720);
  const previewVariant = toRecord(variants.preview_loop_360p ?? variants.previewLoop360p);

  const imagePreviewPath = firstNonEmpty(
    asText(root.thumb_variant_path),
    asText(variantPaths.thumb),
    asText(variantPaths.image),
    asText(thumbVariant.storage_path),
    asText(thumbVariant.path)
  );

  const videoPreviewPath = firstNonEmpty(
    asText(root.preview_variant_path),
    asText(root.poster_variant_path),
    asText(variantPaths.preview),
    asText(variantPaths.poster),
    asText(previewVariant.storage_path),
    asText(previewVariant.path),
    asText(posterVariant.storage_path),
    asText(posterVariant.path)
  );

  return { imagePreviewPath, videoPreviewPath };
};

/**
 * Chooses a preview variant path when available; otherwise returns the original storage path.
 */
export const resolvePreviewStoragePath = (row: MediaRowLike): string | null => {
  const fallback = asText(row.storage_path);
  const type = (row.file_type ?? "").toLowerCase();
  const isVideo = type.startsWith("video");
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);

  if (isVideo) {
    return firstNonEmpty(
      asText(row.preview_variant_path),
      asText(row.poster_variant_path),
      metadataPaths.videoPreviewPath,
      fallback
    );
  }

  return firstNonEmpty(asText(row.thumb_variant_path), metadataPaths.imagePreviewPath, fallback);
};

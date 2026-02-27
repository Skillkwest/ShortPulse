/**
 * Resolves the preferred storage path for lightweight media previews.
 * Falls back to canonical `storage_path` when no variant path metadata is available.
 */
import { filterTrustedMediaDirectPreviewUrls } from "./mediaPreviewTrustPolicy";

type MediaRowLike = {
  storage_path?: string | null;
  file_type?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

const MEDIA_BUCKET = "media_library";
const UUID_SEGMENT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asHttpUrl = (value: unknown): string | null => {
  const text = asText(value);
  if (!text || !/^https?:\/\//i.test(text)) return null;
  return text;
};

const isLikelyStoragePath = (value: string): boolean => {
  if (!value.includes("/")) return false;
  if (value.includes("\\")) return false;
  if (TRAVERSAL_SEGMENT_REGEX.test(value)) return false;
  if (/^(?:blob:|data:)/i.test(value)) return false;
  return true;
};

const decodePathPart = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extractPathFromUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodePathPart(segment));
    const bucketIndex = segments.indexOf(MEDIA_BUCKET);
    if (bucketIndex >= 0 && bucketIndex < segments.length - 1) {
      return segments.slice(bucketIndex + 1).join("/");
    }
    // Support custom domains serving object keys directly as URL paths.
    if (segments.length >= 2 && !segments.includes("storage") && !segments.includes("object")) {
      return segments.join("/");
    }
    return null;
  } catch {
    return null;
  }
};

const asStoragePath = (value: unknown): string | null => {
  const text = asText(value);
  if (!text) return null;
  if (/^(?:blob:|data:)/i.test(text)) return null;

  const fromUrl = /^https?:\/\//i.test(text) ? extractPathFromUrl(text) : null;
  const base = fromUrl ?? text;
  const normalized = decodePathPart(base)
    .replace(/^\/+/, "")
    .replace(/^media_library\//, "")
    .split("?")[0]
    .trim();
  if (!normalized || !isLikelyStoragePath(normalized)) return null;
  return normalized;
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
    asStoragePath(root.thumb_variant_path),
    asStoragePath(variantPaths.thumb),
    asStoragePath(variantPaths.image),
    asStoragePath(thumbVariant.storage_path),
    asStoragePath(thumbVariant.path)
  );

  const videoPreviewPath = firstNonEmpty(
    asStoragePath(root.preview_variant_path),
    asStoragePath(root.poster_variant_path),
    asStoragePath(variantPaths.preview),
    asStoragePath(variantPaths.poster),
    asStoragePath(previewVariant.storage_path),
    asStoragePath(previewVariant.path),
    asStoragePath(posterVariant.storage_path),
    asStoragePath(posterVariant.path)
  );

  return { imagePreviewPath, videoPreviewPath };
};

/**
 * Chooses a preview variant path when available; otherwise returns the original storage path.
 */
export const resolvePreviewStoragePath = (row: MediaRowLike): string | null => {
  const fallback = asStoragePath(row.storage_path);
  const type = (row.file_type ?? "").toLowerCase();
  const isVideo = type.startsWith("video");
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);

  if (isVideo) {
    return firstNonEmpty(
      asStoragePath(row.preview_variant_path),
      asStoragePath(row.poster_variant_path),
      metadataPaths.videoPreviewPath,
      fallback
    );
  }

  return firstNonEmpty(
    asStoragePath(row.thumb_variant_path),
    metadataPaths.imagePreviewPath,
    fallback
  );
};

/**
 * Returns ordered storage-path candidates to try when signing a media preview.
 * The first item is the preferred path.
 */
export const resolveMediaSigningStoragePaths = (
  row: MediaRowLike,
  userId?: string | null
): string[] => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  const preferredPath = resolvePreviewStoragePath(row);
  const candidates = [
    preferredPath,
    asStoragePath(row.storage_path),
    asStoragePath(row.preview_variant_path),
    asStoragePath(row.poster_variant_path),
    asStoragePath(row.thumb_variant_path),
    metadataPaths.videoPreviewPath,
    metadataPaths.imagePreviewPath,
  ];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    deduped.push(candidate);
  }

  if (!userId) return deduped;
  const prefix = `${userId}/`;
  const expanded: string[] = [];
  for (const path of deduped) {
    if (path.startsWith(prefix)) {
      expanded.push(path);
      continue;
    }
    const normalizedPath = path.replace(/^\/+/, "");
    const [firstSegment, ...restSegments] = normalizedPath.split("/");
    if (firstSegment && restSegments.length && UUID_SEGMENT_REGEX.test(firstSegment)) {
      expanded.push(`${prefix}${restSegments.join("/")}`);
    }
    expanded.push(`${prefix}${normalizedPath}`);
    expanded.push(path);
  }

  const expandedDeduped: string[] = [];
  const seenExpanded = new Set<string>();
  for (const path of expanded) {
    if (!path || seenExpanded.has(path)) continue;
    seenExpanded.add(path);
    expandedDeduped.push(path);
  }

  const scoped = expandedDeduped.filter((path) => path.startsWith(prefix));
  const unscoped = expandedDeduped.filter((path) => !path.startsWith(prefix));
  return [...scoped, ...unscoped];
};

/**
 * Returns URL-shaped preview candidates that can be used directly when signing fails.
 */
export const resolveMediaDirectPreviewUrls = (
  row: MediaRowLike,
  userId?: string | null
): string[] => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  const type = (row.file_type ?? "").toLowerCase();
  const isVideo = type.startsWith("video");

  const candidates = isVideo
    ? [
        asHttpUrl(row.preview_variant_path),
        asHttpUrl(row.poster_variant_path),
        asHttpUrl(metadataPaths.videoPreviewPath),
        asHttpUrl(row.storage_path),
      ]
    : [
        asHttpUrl(row.thumb_variant_path),
        asHttpUrl(metadataPaths.imagePreviewPath),
        asHttpUrl(row.storage_path),
      ];

  const deduped = Array.from(
    new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))
  );
  return filterTrustedMediaDirectPreviewUrls(deduped, {
    userId,
    requireUserScope: Boolean(userId),
  });
};

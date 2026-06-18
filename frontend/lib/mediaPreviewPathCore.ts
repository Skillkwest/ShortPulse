import { filterTrustedMediaDirectPreviewUrls } from "./mediaPreviewTrustPolicy";
import { resolveMediaRowKind } from "./mediaRowKind";

export type MediaRowLike = {
  storage_path?: string | null;
  preview_storage_path?: string | null;
  file_type?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

export type MediaPreviewPathKind = "durable" | "original" | "unknown";

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

type ResolvedMetadataPaths = ReturnType<typeof resolveFromMetadata>;

const resolveDurablePreviewStoragePathWithMetadata = (
  row: MediaRowLike,
  metadataPaths: ResolvedMetadataPaths
): string | null => {
  const isVideo = resolveMediaRowKind(row) === "video";

  if (isVideo) {
    return firstNonEmpty(
      asStoragePath(row.preview_variant_path),
      asStoragePath(row.poster_variant_path),
      metadataPaths.videoPreviewPath
    );
  }

  return firstNonEmpty(asStoragePath(row.thumb_variant_path), metadataPaths.imagePreviewPath);
};

const resolvePreviewStoragePathWithMetadata = (
  row: MediaRowLike,
  metadataPaths: ResolvedMetadataPaths
): string | null => {
  const fallback = asStoragePath(row.storage_path);
  return firstNonEmpty(resolveDurablePreviewStoragePathWithMetadata(row, metadataPaths), fallback);
};

const expandScopedStoragePathCandidates = (
  path: string | null,
  userId?: string | null
): string[] => {
  if (!path) return [];
  if (!userId) return [path];
  const prefix = `${userId}/`;
  if (path.startsWith(prefix)) return [path];
  const normalizedPath = path.replace(/^\/+/, "");
  const [firstSegment, ...restSegments] = normalizedPath.split("/");
  const expanded: string[] = [];
  if (firstSegment && restSegments.length && UUID_SEGMENT_REGEX.test(firstSegment)) {
    expanded.push(`${prefix}${restSegments.join("/")}`);
  }
  expanded.push(`${prefix}${normalizedPath}`);
  expanded.push(path);
  return Array.from(new Set(expanded.filter(Boolean)));
};

const buildMediaSigningStoragePaths = (
  row: MediaRowLike,
  metadataPaths: ResolvedMetadataPaths,
  userId?: string | null
): string[] => {
  const preferredPath = resolvePreviewStoragePathWithMetadata(row, metadataPaths);
  const candidates = [
    preferredPath,
    asStoragePath(row.storage_path),
    asStoragePath(row.preview_storage_path),
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
  const expanded = deduped.flatMap((path) => expandScopedStoragePathCandidates(path, userId));

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

const buildMediaDirectPreviewUrls = (
  row: MediaRowLike,
  metadataPaths: ResolvedMetadataPaths,
  userId?: string | null
): string[] => {
  const isVideo = resolveMediaRowKind(row) === "video";

  const candidates = isVideo
    ? [
        asHttpUrl(row.preview_variant_path),
        asHttpUrl(row.preview_storage_path),
        asHttpUrl(row.poster_variant_path),
        asHttpUrl(metadataPaths.videoPreviewPath),
        asHttpUrl(row.storage_path),
      ]
    : [
        asHttpUrl(row.preview_storage_path),
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

export const resolveDurablePreviewStoragePath = (row: MediaRowLike): string | null => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  return resolveDurablePreviewStoragePathWithMetadata(row, metadataPaths);
};

export const resolveVideoPosterStoragePath = (row: MediaRowLike): string | null => {
  if (resolveMediaRowKind(row) !== "video") return null;

  const root = toRecord(row.metadata);
  const variantPaths = toRecord(root.variant_paths ?? root.variantPaths);
  const variants = toRecord(root.variants);
  const posterVariant = toRecord(variants.poster_720 ?? variants.poster720);
  const thumbVariant = toRecord(variants.thumb_240 ?? variants.thumb240);

  return firstNonEmpty(
    asStoragePath(row.poster_variant_path),
    asStoragePath(row.thumb_variant_path),
    asStoragePath(root.poster_variant_path),
    asStoragePath(root.thumb_variant_path),
    asStoragePath(variantPaths.poster),
    asStoragePath(variantPaths.thumb),
    asStoragePath(variantPaths.image),
    asStoragePath(posterVariant.storage_path),
    asStoragePath(posterVariant.path),
    asStoragePath(thumbVariant.storage_path),
    asStoragePath(thumbVariant.path)
  );
};

export const resolveVideoPosterSigningStoragePaths = (
  row: MediaRowLike,
  userId?: string | null
): string[] => {
  const preferredPath = resolveVideoPosterStoragePath(row);
  const candidates = [
    preferredPath,
    asStoragePath(row.poster_variant_path),
    asStoragePath(row.thumb_variant_path),
  ];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    for (const expandedCandidate of expandScopedStoragePathCandidates(candidate, userId)) {
      if (!expandedCandidate || seen.has(expandedCandidate)) continue;
      seen.add(expandedCandidate);
      deduped.push(expandedCandidate);
    }
  }
  return deduped;
};

export const resolveVideoBrowseSigningCandidates = (
  row: MediaRowLike,
  userId?: string | null
): {
  posterPaths: string[];
  hoverVideoPath: string | null;
} => {
  if (resolveMediaRowKind(row) !== "video") {
    return {
      posterPaths: [],
      hoverVideoPath: null,
    };
  }

  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  const allCandidates = buildMediaSigningStoragePaths(row, metadataPaths, userId);
  const posterPreferredPath = firstNonEmpty(
    asStoragePath(row.poster_variant_path),
    asStoragePath(row.thumb_variant_path),
    metadataPaths.imagePreviewPath
  );
  const posterCandidates = [
    posterPreferredPath,
    asStoragePath(row.poster_variant_path),
    asStoragePath(row.thumb_variant_path),
    metadataPaths.imagePreviewPath,
  ];

  const posterPaths: string[] = [];
  const seenPoster = new Set<string>();
  for (const candidate of posterCandidates) {
    for (const expandedCandidate of expandScopedStoragePathCandidates(candidate, userId)) {
      if (!expandedCandidate || seenPoster.has(expandedCandidate)) continue;
      seenPoster.add(expandedCandidate);
      posterPaths.push(expandedCandidate);
    }
  }

  const posterPathSet = new Set(posterPaths);
  const hoverVideoPath = allCandidates.find((candidate) => !posterPathSet.has(candidate)) ?? null;

  return {
    posterPaths,
    hoverVideoPath,
  };
};

export const resolvePreviewStoragePath = (row: MediaRowLike): string | null => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  return resolvePreviewStoragePathWithMetadata(row, metadataPaths);
};

export const classifyMediaPreviewPath = (
  row: MediaRowLike,
  resolvedPath: string | null | undefined,
  userId?: string | null
): MediaPreviewPathKind => {
  const normalizedResolvedPath = asStoragePath(resolvedPath);
  if (!normalizedResolvedPath) return "unknown";

  const durableCandidates = new Set(
    expandScopedStoragePathCandidates(resolveDurablePreviewStoragePath(row), userId)
  );
  if (durableCandidates.has(normalizedResolvedPath)) {
    return "durable";
  }

  const originalCandidates = new Set(
    expandScopedStoragePathCandidates(asStoragePath(row.storage_path), userId)
  );
  if (originalCandidates.has(normalizedResolvedPath)) {
    return "original";
  }

  return "unknown";
};

export const resolvePreferredMediaSigningStoragePath = (
  row: MediaRowLike,
  userId?: string | null
): string | null => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  const preferredPath = resolvePreviewStoragePathWithMetadata(row, metadataPaths);
  if (!preferredPath) return null;
  return expandScopedStoragePathCandidates(preferredPath, userId)[0] ?? null;
};

export const resolveMediaSigningStoragePaths = (
  row: MediaRowLike,
  userId?: string | null
): string[] => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  return buildMediaSigningStoragePaths(row, metadataPaths, userId);
};

export const resolveMediaPreviewCandidates = (
  row: MediaRowLike,
  userId?: string | null
): {
  storagePaths: string[];
  directUrl: string | null;
} => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  return {
    storagePaths: buildMediaSigningStoragePaths(row, metadataPaths, userId),
    directUrl: buildMediaDirectPreviewUrls(row, metadataPaths, userId)[0] ?? null,
  };
};

export const resolvePreferredMediaDirectPreviewUrl = (
  row: MediaRowLike,
  userId?: string | null
): string | null => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  return buildMediaDirectPreviewUrls(row, metadataPaths, userId)[0] ?? null;
};

export const resolveMediaDirectPreviewUrls = (
  row: MediaRowLike,
  userId?: string | null
): string[] => {
  const metadataPaths = resolveFromMetadata(row.metadata ?? null);
  return buildMediaDirectPreviewUrls(row, metadataPaths, userId);
};

export const resolveMediaStoragePathCandidate = (value: unknown): string | null =>
  asStoragePath(value);

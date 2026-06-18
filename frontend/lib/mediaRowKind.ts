export type MediaRowKind = "image" | "video" | "audio" | "unknown";

export const MEDIA_ROW_VIDEO_EXTENSIONS = ["m4v", "mov", "mp4", "ogv", "webm"] as const;
export const MEDIA_ROW_AUDIO_EXTENSIONS = [
  "aac",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "wav",
] as const;
export const MEDIA_ROW_IMAGE_EXTENSIONS = [
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpg",
  "jpeg",
  "png",
  "svg",
  "webp",
] as const;

export type MediaRowKindInput = {
  file_type?: string | null;
  storage_path?: string | null;
  preview_storage_path?: string | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  companion_art_storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

const VIDEO_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogv|webm)(?:$|[?#])/i;
const AUDIO_PATH_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i;
const AMBIGUOUS_OGG_PATH_PATTERN = /\.ogg(?:$|[?#])/i;
const IMAGE_PATH_PATTERN = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:$|[?#])/i;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasPathKind = (candidates: Array<string | null | undefined>, pattern: RegExp): boolean =>
  candidates.some((candidate) => Boolean(candidate && pattern.test(candidate)));

export const resolveMediaKindFromFileType = (fileType?: string | null): MediaRowKind | null => {
  const normalized = fileType?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.startsWith("video")) return "video";
  if (normalized.startsWith("audio")) return "audio";
  if (normalized.startsWith("image")) return "image";
  return null;
};

const resolveMediaKindFromMetadata = (
  metadata?: Record<string, unknown> | null
): MediaRowKind | null => {
  const root = asRecord(metadata);
  if (!root) return null;
  const workflowReload = asRecord(root.workflow_reload);
  const workflowPayload = asRecord(workflowReload?.payload);
  const rawKind =
    asText(root.media_kind) ??
    asText(root.mediaKind) ??
    asText(root.kind) ??
    asText(workflowPayload?.media_kind) ??
    asText(workflowPayload?.mediaKind) ??
    asText(workflowPayload?.kind);
  return resolveMediaKindFromFileType(rawKind);
};

const collectMetadataPathCandidates = (metadata?: Record<string, unknown> | null) => {
  const root = asRecord(metadata);
  if (!root) {
    return {
      playable: [] as Array<string | null>,
      image: [] as Array<string | null>,
    };
  }

  const variantPaths = asRecord(root.variant_paths ?? root.variantPaths);
  const variants = asRecord(root.variants);
  const previewVariant = asRecord(variants?.preview_loop_360p ?? variants?.previewLoop360p);
  const posterVariant = asRecord(variants?.poster_720 ?? variants?.poster720);
  const thumbVariant = asRecord(variants?.thumb_240 ?? variants?.thumb240);

  return {
    playable: [
      asText(root.storage_path),
      asText(root.preview_storage_path),
      asText(root.preview_variant_path),
      asText(root.audio_storage_path),
      asText(variantPaths?.preview),
      asText(variantPaths?.audio),
      asText(previewVariant?.storage_path),
      asText(previewVariant?.path),
    ],
    image: [
      asText(root.thumb_variant_path),
      asText(root.poster_variant_path),
      asText(root.companion_art_storage_path),
      asText(variantPaths?.thumb),
      asText(variantPaths?.poster),
      asText(variantPaths?.image),
      asText(thumbVariant?.storage_path),
      asText(thumbVariant?.path),
      asText(posterVariant?.storage_path),
      asText(posterVariant?.path),
    ],
  };
};

export const resolveMediaRowKind = (row: MediaRowKindInput): MediaRowKind => {
  const metadataPaths = collectMetadataPathCandidates(row.metadata);
  const playablePathCandidates = [
    row.storage_path ?? null,
    row.preview_storage_path ?? null,
    row.preview_variant_path ?? null,
    ...metadataPaths.playable,
  ];

  // Playable paths are stronger than stale file_type values. Poster/thumb paths
  // are intentionally excluded here so image thumbnails do not manufacture video.
  if (hasPathKind(playablePathCandidates, VIDEO_PATH_PATTERN)) return "video";
  const fileTypeKind = resolveMediaKindFromFileType(row.file_type);
  if (fileTypeKind === "video" && hasPathKind(playablePathCandidates, AMBIGUOUS_OGG_PATH_PATTERN)) {
    return "video";
  }
  if (hasPathKind(playablePathCandidates, AUDIO_PATH_PATTERN)) return "audio";

  if (fileTypeKind) return fileTypeKind;

  const metadataKind = resolveMediaKindFromMetadata(row.metadata);
  if (metadataKind) return metadataKind;

  const imagePathCandidates = [
    row.storage_path ?? null,
    row.preview_storage_path ?? null,
    row.thumb_variant_path ?? null,
    row.poster_variant_path ?? null,
    row.companion_art_storage_path ?? null,
    ...metadataPaths.image,
  ];
  if (hasPathKind(imagePathCandidates, IMAGE_PATH_PATTERN)) return "image";

  return "unknown";
};

export const isMediaRowVideo = (row: MediaRowKindInput): boolean =>
  resolveMediaRowKind(row) === "video";

export const isMediaRowAudio = (row: MediaRowKindInput): boolean =>
  resolveMediaRowKind(row) === "audio";

export const isMediaRowImage = (row: MediaRowKindInput): boolean =>
  resolveMediaRowKind(row) === "image";

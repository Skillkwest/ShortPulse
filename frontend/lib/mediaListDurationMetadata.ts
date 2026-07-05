/**
 * Normalizes duration metadata for media-list rows before they reach card renderers.
 */

type MediaListDurationMetadataArgs = {
  metadata?: Record<string, unknown> | null;
  durationSeconds?: number | string | null;
};

const DURATION_METADATA_KEYS = [
  "durationMs",
  "duration_ms",
  "durationSeconds",
  "duration_seconds",
  "resolvedDurationMs",
  "resolved_duration_ms",
  "resolvedDurationSeconds",
  "resolved_duration_seconds",
  "videoDurationMs",
  "video_duration_ms",
  "videoDurationSeconds",
  "video_duration_seconds",
  "audioDurationMs",
  "audio_duration_ms",
  "audioDurationSeconds",
  "audio_duration_seconds",
  "source_duration_ms",
  "source_duration_seconds",
];

const normalizePositiveFiniteNumber = (value: unknown): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const hasExistingDurationMetadata = (metadata: Record<string, unknown>): boolean =>
  DURATION_METADATA_KEYS.some((key) => normalizePositiveFiniteNumber(metadata[key]) !== null);

/**
 * Adds top-level `media_files.duration_seconds` to row metadata when no duration metadata exists.
 */
export const mergeMediaListDurationMetadata = ({
  metadata,
  durationSeconds,
}: MediaListDurationMetadataArgs): Record<string, unknown> | null | undefined => {
  const normalizedDurationSeconds = normalizePositiveFiniteNumber(durationSeconds);
  if (normalizedDurationSeconds === null) return metadata;
  const existingMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : null;
  if (existingMetadata && hasExistingDurationMetadata(existingMetadata)) return existingMetadata;
  const durationMs = Math.max(1, Math.round(normalizedDurationSeconds * 1000));
  return {
    ...(existingMetadata ?? {}),
    duration_ms: durationMs,
    duration_seconds: durationMs / 1000,
  };
};

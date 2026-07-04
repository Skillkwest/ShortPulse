/**
 * Duration metadata normalization shared by media-library persistence paths.
 */
const normalizeDurationMetadataCandidateMs = (
  value: unknown,
  unit: "ms" | "seconds"
): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const durationMs = unit === "seconds" ? value * 1000 : value;
  return Math.max(1, Math.round(durationMs));
};

export const resolveDurationMetadataPatch = (
  metadata: Record<string, unknown>
): Record<string, number> | null => {
  const candidates: Array<{ value: unknown; unit: "ms" | "seconds" }> = [
    { value: metadata.duration_ms, unit: "ms" },
    { value: metadata.durationMs, unit: "ms" },
    { value: metadata.video_duration_ms, unit: "ms" },
    { value: metadata.videoDurationMs, unit: "ms" },
    { value: metadata.resolved_duration_ms, unit: "ms" },
    { value: metadata.resolvedDurationMs, unit: "ms" },
    { value: metadata.duration_seconds, unit: "seconds" },
    { value: metadata.durationSeconds, unit: "seconds" },
    { value: metadata.video_duration_seconds, unit: "seconds" },
    { value: metadata.videoDurationSeconds, unit: "seconds" },
    { value: metadata.resolved_duration_seconds, unit: "seconds" },
    { value: metadata.resolvedDurationSeconds, unit: "seconds" },
  ];
  for (const candidate of candidates) {
    const durationMs = normalizeDurationMetadataCandidateMs(candidate.value, candidate.unit);
    if (durationMs === null) continue;
    return {
      duration_ms: durationMs,
      duration_seconds: durationMs / 1000,
    };
  }
  return null;
};

export const hasDurationMetadata = (metadata: Record<string, unknown>): boolean =>
  resolveDurationMetadataPatch(metadata) !== null;

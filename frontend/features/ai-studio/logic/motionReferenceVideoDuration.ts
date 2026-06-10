/**
 * Motion Control video duration guardrails shared by reference intake surfaces.
 */
export const MOTION_REFERENCE_MAX_DURATION_MS = 30_000;

export const MOTION_REFERENCE_VIDEO_TOO_LONG_MESSAGE =
  "Motion Control supports motion reference clips up to 30 seconds. Trim this video and try again.";

/**
 * Returns user-facing copy when a known motion reference video duration exceeds provider limits.
 */
export const resolveMotionReferenceVideoDurationError = (
  durationMs: number | null | undefined
): string | null => {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  return durationMs > MOTION_REFERENCE_MAX_DURATION_MS
    ? MOTION_REFERENCE_VIDEO_TOO_LONG_MESSAGE
    : null;
};

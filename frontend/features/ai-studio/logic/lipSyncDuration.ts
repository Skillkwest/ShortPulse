/**
 * Lip Sync duration guardrails shared by AI Studio UI and submit validation.
 */

const LIP_SYNC_720P_AUDIO_LIMIT_SECONDS = 60;
const LIP_SYNC_1080P_AUDIO_LIMIT_SECONDS = 30;

/**
 * Resolves the provider audio duration limit for a Lip Sync resolution.
 */
export const resolveLipSyncAudioLimitSeconds = (resolution?: string | null): number =>
  resolution?.trim().toLowerCase() === "720p"
    ? LIP_SYNC_720P_AUDIO_LIMIT_SECONDS
    : LIP_SYNC_1080P_AUDIO_LIMIT_SECONDS;

/**
 * Returns product-safe copy when known Lip Sync audio duration exceeds provider limits.
 */
export const resolveLipSyncAudioDurationGuardrail = ({
  durationMs,
  resolution,
}: {
  durationMs?: number | null;
  resolution?: string | null;
}): string | null => {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  const limitSeconds = resolveLipSyncAudioLimitSeconds(resolution);
  if (durationMs < limitSeconds * 1000) return null;
  return limitSeconds === LIP_SYNC_1080P_AUDIO_LIMIT_SECONDS
    ? "Use voice audio under 30 seconds for 1080p Lip Sync, or switch to 720p for audio up to 60 seconds."
    : "Use voice audio under 60 seconds for 720p Lip Sync.";
};

/**
 * Shared voice clone runtime contract.
 * Keeps the client and server aligned on the minimum viable sample guidance
 * required before we attempt an upstream ElevenLabs clone request.
 */

export const MIN_VOICE_CLONE_DURATION_SECONDS = 60;

export const MIN_VOICE_CLONE_DURATION_LABEL = "1 minute";

export const VOICE_CLONE_MIN_DURATION_ERROR =
  "Voice clone samples must be at least 1 minute long. Record a longer clip and try again.";

export const VOICE_CLONE_MIN_DURATION_GUIDANCE =
  "For reliable voice cloning, record at least 1 minute of clear speech.";

/**
 * Returns the user-facing validation message for a clone sample duration.
 * Null means the duration is either unknown or already satisfies the minimum.
 */
export const resolveVoiceCloneDurationError = (
  durationSeconds: number | null | undefined
): string | null => {
  if (!Number.isFinite(durationSeconds) || durationSeconds == null) {
    return null;
  }
  return durationSeconds < MIN_VOICE_CLONE_DURATION_SECONDS ? VOICE_CLONE_MIN_DURATION_ERROR : null;
};

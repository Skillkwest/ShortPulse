/**
 * Background recovery scheduling policy for AI Studio task polling.
 */
export const BACKGROUND_RECOVERY_INTERVAL_MS = 30 * 1000;
export const BACKGROUND_RECOVERY_MAX_ATTEMPTS = 30;
export const BACKGROUND_RECOVERY_MAX_ATTEMPTS_NO_MEDIA = 2;

export type BackgroundRecoveryReasonCode =
  | "no_media_after_terminal_success"
  | "poll_timeout"
  | "status_poll_error"
  | "output_lookup_missing";

/**
 * Returns max retry attempts for background recovery by reason code.
 */
export const getBackgroundRecoveryMaxAttempts = (
  reasonCode: BackgroundRecoveryReasonCode
): number =>
  reasonCode === "no_media_after_terminal_success"
    ? BACKGROUND_RECOVERY_MAX_ATTEMPTS_NO_MEDIA
    : BACKGROUND_RECOVERY_MAX_ATTEMPTS;

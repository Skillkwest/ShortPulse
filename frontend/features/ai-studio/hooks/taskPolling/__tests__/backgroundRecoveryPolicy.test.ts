/**
 * Unit coverage for background recovery scheduling policy.
 */
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_RECOVERY_INTERVAL_MS,
  getBackgroundRecoveryMaxAttempts,
  BACKGROUND_RECOVERY_MAX_ATTEMPTS,
  BACKGROUND_RECOVERY_MAX_ATTEMPTS_NO_MEDIA,
} from "../backgroundRecoveryPolicy";

describe("backgroundRecoveryPolicy", () => {
  it("returns no-media specific retry budget", () => {
    expect(getBackgroundRecoveryMaxAttempts("no_media_after_terminal_success")).toBe(
      BACKGROUND_RECOVERY_MAX_ATTEMPTS_NO_MEDIA
    );
  });

  it("returns default retry budget for other reasons", () => {
    expect(getBackgroundRecoveryMaxAttempts("poll_timeout")).toBe(BACKGROUND_RECOVERY_MAX_ATTEMPTS);
    expect(getBackgroundRecoveryMaxAttempts("status_poll_error")).toBe(
      BACKGROUND_RECOVERY_MAX_ATTEMPTS
    );
  });

  it("uses the shorter background recovery interval", () => {
    expect(BACKGROUND_RECOVERY_INTERVAL_MS).toBe(30_000);
  });
});

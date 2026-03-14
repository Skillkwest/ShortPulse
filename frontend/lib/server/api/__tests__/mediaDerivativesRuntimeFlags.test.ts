/**
 * Unit tests for media derivative runtime flag parsing/clamping.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readMediaDerivativesRuntimeFlags } from "../mediaDerivativesRuntimeFlags";

const restoreEnv = { ...process.env };

afterEach(() => {
  process.env = { ...restoreEnv };
});

describe("readMediaDerivativesRuntimeFlags", () => {
  it("returns defaults when env is unset", () => {
    delete process.env.SHORTPULSE_MEDIA_DERIVATIVES_ENABLED;
    delete process.env.SHORTPULSE_MEDIA_DERIVATIVES_BATCH_SIZE;

    const flags = readMediaDerivativesRuntimeFlags();

    expect(flags.enabled).toBe(false);
    expect(flags.batchSize).toBe(20);
    expect(flags.maxAttempts).toBe(5);
  });

  it("parses and clamps custom values", () => {
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_ENABLED = "true";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_BATCH_SIZE = "-8";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_MAX_ATTEMPTS = "7";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_THUMB_240_QUALITY = "10";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_THUMB_480_QUALITY = "120";

    const flags = readMediaDerivativesRuntimeFlags();

    expect(flags.enabled).toBe(true);
    expect(flags.batchSize).toBe(1);
    expect(flags.maxAttempts).toBe(7);
    expect(flags.thumb240Quality).toBe(20);
    expect(flags.thumb480Quality).toBe(100);
  });
});

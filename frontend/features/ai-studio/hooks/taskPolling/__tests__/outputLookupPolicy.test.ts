/**
 * Unit coverage for output lookup miss/hard-stop policy.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateOutputLookupMiss,
  OUTPUT_LOOKUP_MISS_HARD_STOP_MS,
  OUTPUT_LOOKUP_MISS_MAX_RETRIES,
} from "../outputLookupPolicy";

describe("outputLookupPolicy", () => {
  it("uses fast retry before miss budget is exhausted", () => {
    const now = Date.now();
    const result = evaluateOutputLookupMiss({
      currentMisses: 0,
      missingSinceMs: now - 2000,
      nowMs: now,
    });

    expect(result.lookupMisses).toBe(1);
    expect(result.shouldHardStop).toBe(false);
    expect(result.shouldEmitRetryingBreadcrumb).toBe(false);
    expect(result.retryDelayMs).toBe(400);
  });

  it("switches to recovery retry delay after miss budget", () => {
    const now = Date.now();
    const result = evaluateOutputLookupMiss({
      currentMisses: OUTPUT_LOOKUP_MISS_MAX_RETRIES + 1,
      missingSinceMs: now - 2000,
      nowMs: now,
    });

    expect(result.retryDelayMs).toBe(2000);
  });

  it("hard-stops when missing duration crosses threshold", () => {
    const now = Date.now();
    const result = evaluateOutputLookupMiss({
      currentMisses: 2,
      missingSinceMs: now - OUTPUT_LOOKUP_MISS_HARD_STOP_MS - 1,
      nowMs: now,
    });

    expect(result.shouldHardStop).toBe(true);
  });
});

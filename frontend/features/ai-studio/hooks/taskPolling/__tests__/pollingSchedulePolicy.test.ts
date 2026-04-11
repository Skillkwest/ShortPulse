/**
 * Unit coverage for task polling cadence and retry-budget policy.
 */
import { describe, expect, it } from "vitest";
import {
  getPollDelayMs,
  getPollMaxWaitMs,
  getStatusConcurrencyRetryDelayMs,
  isStatusErrorRetryBudgetExhausted,
  resolveNoMediaRetryPolicy,
} from "../pollingSchedulePolicy";

describe("pollingSchedulePolicy", () => {
  it("uses provider-specific max wait budget", () => {
    expect(getPollMaxWaitMs("fal")).toBe(18 * 60 * 1000);
    expect(getPollMaxWaitMs("fal-kling")).toBe(30 * 60 * 1000);
  });

  it("backs off poll delay with max cap", () => {
    expect(getPollDelayMs(0)).toBe(900);
    expect(getPollDelayMs(1)).toBe(1200);
    expect(getPollDelayMs(99)).toBe(3000);
  });

  it("expands retry delay when status concurrency is saturated", () => {
    expect(getStatusConcurrencyRetryDelayMs(2200)).toBe(2800);
    expect(getStatusConcurrencyRetryDelayMs(3900)).toBe(4000);
  });

  it("resolves no-media retry policy for image and video providers", () => {
    const imagePolicy = resolveNoMediaRetryPolicy({
      provider: "fal",
      noMediaAttempt: 1,
      fallbackDelayMs: 5000,
    });
    expect(imagePolicy.maxNoMediaAttempts).toBe(6);
    expect(imagePolicy.retryDelayMs).toBe(600);

    const videoPolicy = resolveNoMediaRetryPolicy({
      provider: "fal-kling",
      noMediaAttempt: 1,
      fallbackDelayMs: 5000,
    });
    expect(videoPolicy.maxNoMediaAttempts).toBe(30);
    expect(videoPolicy.retryDelayMs).toBe(5000);
  });

  it("enforces status poll error retry budget", () => {
    expect(isStatusErrorRetryBudgetExhausted({ message: "404 not found", attempt: 4 })).toBe(false);
    expect(isStatusErrorRetryBudgetExhausted({ message: "404 not found", attempt: 5 })).toBe(true);
    expect(isStatusErrorRetryBudgetExhausted({ message: "network reset", attempt: 30 })).toBe(true);
  });
});

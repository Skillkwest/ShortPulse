/**
 * Regression tests for failure classification/resolution and retry helpers.
 */
import { describe, expect, it } from "vitest";
import {
  classifyStudioAgentFailure,
  computeStudioAgentRetryDelayMs,
  resolveStudioAgentFailureResolution,
  shouldRetryStudioAgentFailure,
} from "../studioAgentFailurePolicy";

describe("studioAgentFailurePolicy", () => {
  it("classifies safety refusal and maps to canonical refusal", () => {
    const failureClass = classifyStudioAgentFailure({
      status: 400,
      detail: "content policy violation",
      safetyRefusal: true,
    });
    expect(failureClass).toBe("safety_refusal");
    expect(resolveStudioAgentFailureResolution({ failureClass })).toBe("canonical_refusal");
  });

  it("classifies transient infra and maps to assistant fallback", () => {
    const failureClass = classifyStudioAgentFailure({
      status: 503,
      detail: "service unavailable",
    });
    expect(failureClass).toBe("infra_transient");
    expect(resolveStudioAgentFailureResolution({ failureClass })).toBe("assistant_fallback");
  });

  it("classifies parse/repair failures as non-retryable output contract failures", () => {
    const failureClass = classifyStudioAgentFailure({
      status: 502,
      detail: "Fast-path output parse/repair failed",
    });
    expect(failureClass).toBe("output_contract");
    expect(resolveStudioAgentFailureResolution({ failureClass })).toBe("assistant_fallback");
    expect(
      shouldRetryStudioAgentFailure({
        failureClass,
        attempt: 1,
        maxAttempts: 2,
      })
    ).toBe(false);
  });

  it("classifies auth/config failures as hard errors", () => {
    const failureClass = classifyStudioAgentFailure({
      status: 401,
      detail: "invalid api key",
    });
    expect(failureClass).toBe("auth_config");
    expect(resolveStudioAgentFailureResolution({ failureClass })).toBe("hard_error");
  });

  it("retries only transient failures within attempt budget", () => {
    expect(
      shouldRetryStudioAgentFailure({
        failureClass: "infra_transient",
        attempt: 1,
        maxAttempts: 2,
      })
    ).toBe(true);
    expect(
      shouldRetryStudioAgentFailure({
        failureClass: "infra_transient",
        attempt: 2,
        maxAttempts: 2,
      })
    ).toBe(false);
    expect(
      shouldRetryStudioAgentFailure({
        failureClass: "auth_config",
        attempt: 1,
        maxAttempts: 2,
      })
    ).toBe(false);
  });

  it("computes bounded backoff delays with jitter", () => {
    const delay = computeStudioAgentRetryDelayMs({
      attempt: 2,
      baseDelayMs: 100,
      maxDelayMs: 300,
      jitterRatio: 0.25,
      randomValue: 0.9,
    });
    expect(delay).toBeGreaterThanOrEqual(150);
    expect(delay).toBeLessThanOrEqual(250);
  });
});

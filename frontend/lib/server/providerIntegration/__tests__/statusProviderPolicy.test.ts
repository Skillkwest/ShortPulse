/**
 * Unit coverage for provider-owned status lifecycle and upstream retry policy.
 */

import { describe, expect, it } from "vitest";
import {
  isProviderCompletedStatus,
  isProviderFailedStatus,
  isProviderRetryableUpstreamResponse,
  resolveProviderSuccessfulPayloadStatus,
} from "../statusProviderPolicy";

describe("statusProviderPolicy", () => {
  it("classifies completed and failed lifecycle statuses for fal", () => {
    expect(
      isProviderCompletedStatus({
        provider: "fal",
        status: "completed",
      })
    ).toBe(true);
    expect(
      isProviderCompletedStatus({
        provider: "fal",
        status: "running",
      })
    ).toBe(false);
    expect(
      isProviderFailedStatus({
        provider: "fal",
        status: "error",
      })
    ).toBe(true);
    expect(
      isProviderFailedStatus({
        provider: "fal",
        status: "running",
      })
    ).toBe(false);
  });

  it("resolves successful payload status from mixed candidate values", () => {
    expect(
      resolveProviderSuccessfulPayloadStatus({
        provider: "fal",
        candidates: [undefined, "IN_PROGRESS", "completed", "queued"],
      })
    ).toBe("completed");
    expect(
      resolveProviderSuccessfulPayloadStatus({
        provider: "fal",
        candidates: [undefined, null, "running"],
      })
    ).toBe("completed");
  });

  it("classifies retryable upstream responses by status code and fal headers", () => {
    const retryableByStatus = new Response("{}", { status: 503 });
    const retryableByHeader = new Response("{}", {
      status: 400,
      headers: { "x-fal-retryable": "true" },
    });
    const nonRetryableByNeedsRetryFalse = new Response("{}", {
      status: 500,
      headers: { "x-fal-needs-retry": "false" },
    });
    const retryableByNeedsRetryTrue = new Response("{}", {
      status: 500,
      headers: { "x-fal-needs-retry": "true" },
    });
    const conflictingHeadersNeedsRetryWins = new Response("{}", {
      status: 500,
      headers: {
        "x-fal-needs-retry": "false",
        "x-fal-retryable": "true",
      },
    });
    const nonRetryable = new Response("{}", { status: 422 });

    expect(
      isProviderRetryableUpstreamResponse({
        provider: "fal",
        response: retryableByStatus,
      })
    ).toBe(true);
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "fal",
        response: retryableByHeader,
      })
    ).toBe(true);
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "fal",
        response: nonRetryableByNeedsRetryFalse,
      })
    ).toBe(false);
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "fal",
        response: retryableByNeedsRetryTrue,
      })
    ).toBe(true);
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "fal",
        response: conflictingHeadersNeedsRetryWins,
      })
    ).toBe(false);
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "fal",
        response: nonRetryable,
      })
    ).toBe(false);
  });

  it("supports kie lifecycle and retry semantics", () => {
    expect(
      isProviderCompletedStatus({
        provider: "kie",
        status: "finished",
      })
    ).toBe(true);
    expect(
      isProviderFailedStatus({
        provider: "kie",
        status: "rejected",
      })
    ).toBe(true);
    expect(
      resolveProviderSuccessfulPayloadStatus({
        provider: "kie",
        candidates: [null, "processing", "finished"],
      })
    ).toBe("finished");
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "kie",
        response: new Response("{}", {
          status: 400,
          headers: { "x-kie-retryable": "true" },
        }),
      })
    ).toBe(true);
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "kie",
        response: new Response("{}", { status: 400 }),
        payload: { code: "rate_limit" },
      })
    ).toBe(true);
    expect(
      isProviderRetryableUpstreamResponse({
        provider: "kie",
        response: new Response("{}", {
          status: 400,
          headers: { "x-kie-needs-retry": "false" },
        }),
        payload: { code: "rate_limit" },
      })
    ).toBe(false);
  });

  it("fails closed for unsupported providers", () => {
    expect(() =>
      isProviderCompletedStatus({
        provider: "openai",
        status: "completed",
      })
    ).toThrow("Unsupported provider for completed-status policy");
    expect(() =>
      isProviderFailedStatus({
        provider: "openai",
        status: "failed",
      })
    ).toThrow("Unsupported provider for failed-status policy");
    expect(() =>
      resolveProviderSuccessfulPayloadStatus({
        provider: "openai",
        candidates: ["completed"],
      })
    ).toThrow("Unsupported provider for successful-payload status policy");
    expect(() =>
      isProviderRetryableUpstreamResponse({
        provider: "openai",
        response: new Response("{}", { status: 503 }),
      })
    ).toThrow("Unsupported provider for retryable-upstream policy");
  });
});

/**
 * Unit coverage for provider-aware status/result payload parsing helpers.
 */

import { describe, expect, it } from "vitest";
import {
  providerPayloadHasMedia,
  readProviderContentPolicyMessage,
  readProviderLifecycleStatus,
  readProviderResponseUrl,
} from "../statusProviderPayload";

describe("statusProviderPayload", () => {
  it("reads fal lifecycle status aliases", () => {
    expect(
      readProviderLifecycleStatus({
        provider: "fal",
        payload: { state: "Completed" },
      })
    ).toBe("completed");
  });

  it("reads fal response URLs from nested payload shapes", () => {
    const payload = {
      data: {
        responseUrl: "https://queue.fal.run/fal-ai/model/requests/req-1",
      },
    };

    expect(readProviderResponseUrl({ provider: "fal", payload })).toBe(
      "https://queue.fal.run/fal-ai/model/requests/req-1"
    );
  });

  it("detects fal media payloads", () => {
    const payload = {
      data: {
        images: [{ url: "https://cdn.shortpulse.test/image.png" }],
      },
    };

    expect(providerPayloadHasMedia({ provider: "fal", payload })).toBe(true);
  });

  it("reads fal content-policy messages", () => {
    const payload = {
      detail: [
        {
          type: "content_policy_violation",
          msg: "Blocked by policy.",
        },
      ],
    };

    expect(readProviderContentPolicyMessage({ provider: "fal", payload })).toBe(
      "Blocked by policy."
    );
  });

  it("supports kie payload parsing", () => {
    expect(
      readProviderLifecycleStatus({
        provider: "kie",
        payload: { state: "running" },
      })
    ).toBe("running");

    expect(
      readProviderResponseUrl({
        provider: "kie",
        payload: { response_url: "https://queue.kie.ai/v1/requests/1" },
      })
    ).toBe("https://queue.kie.ai/v1/requests/1");

    expect(
      providerPayloadHasMedia({
        provider: "kie",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toBe(true);

    expect(
      readProviderContentPolicyMessage({
        provider: "kie",
        payload: { error_message: "Blocked by moderation." },
      })
    ).toBe("Blocked by moderation.");
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      readProviderLifecycleStatus({
        provider: "openai",
        payload: { status: "running" },
      })
    ).toThrow("Unsupported provider for payload status parsing");
  });
});

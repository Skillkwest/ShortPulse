/**
 * Unit coverage for provider-aware status/result payload parsing helpers.
 */

import { describe, expect, it } from "vitest";
import {
  providerPayloadHasMedia,
  readProviderContentPolicyMessage,
  readProviderLifecycleStatus,
  readProviderMediaUrls,
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
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { state: "running" },
      })
    ).toBe("running");

    expect(
      readProviderResponseUrl({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { response_url: "https://queue.kie.ai/v1/requests/1" },
      })
    ).toBe("https://queue.kie.ai/v1/requests/1");

    expect(
      providerPayloadHasMedia({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toBe(true);
    expect(
      readProviderMediaUrls({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toEqual(["https://cdn.shortpulse.test/video.mp4"]);

    expect(
      readProviderContentPolicyMessage({
        provider: "kie",
        payload: { error_message: "Blocked by moderation." },
      })
    ).toBe("Blocked by moderation.");
  });

  it("normalizes nested kie record-info envelopes before lifecycle/media decisions", () => {
    const payload = {
      status: { malformed: true },
      response_url: { malformed: true },
      data: {
        successFlag: 1,
        responseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_123",
        response: {
          responseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_123",
          resultUrls: ["https://cdn.shortpulse.test/kie-envelope.mp4"],
        },
      },
    };

    expect(
      readProviderLifecycleStatus({
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
        payload,
      })
    ).toBe("completed");
    expect(
      readProviderResponseUrl({
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
        payload,
      })
    ).toBe("https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_123");
    expect(
      providerPayloadHasMedia({
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
        payload,
      })
    ).toBe(true);
    expect(
      readProviderMediaUrls({
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
        payload,
      })
    ).toEqual(["https://cdn.shortpulse.test/kie-envelope.mp4"]);
  });

  it("fails closed for malformed or unsupported kie status/result payloads", () => {
    expect(
      readProviderLifecycleStatus({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { status: { value: "running" } },
      })
    ).toBeNull();

    expect(
      readProviderResponseUrl({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { response_url: { href: "https://queue.kie.ai/v1/requests/1" } },
      })
    ).toBeNull();

    expect(
      providerPayloadHasMedia({
        provider: "kie",
        modelId: "kie-ai/unknown",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toBe(false);
    expect(
      readProviderMediaUrls({
        provider: "kie",
        modelId: "kie-ai/unknown",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toEqual([]);
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      readProviderLifecycleStatus({
        provider: "openai",
        payload: { status: "running" },
      })
    ).toThrow("Unsupported provider for payload status parsing");
    expect(() =>
      readProviderMediaUrls({
        provider: "openai",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toThrow("Unsupported provider for media URL parsing");
  });
});

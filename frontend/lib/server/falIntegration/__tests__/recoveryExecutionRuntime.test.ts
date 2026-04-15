import { describe, expect, it } from "vitest";
import {
  canTransitionToSuccess,
  clampPrompt,
  collectRecoveredUrls,
  resolveExtension,
  resolveFileType,
  resolveRetryDelaySeconds,
  sanitizeFilename,
} from "../recoveryExecutionRuntime";

describe("recoveryExecutionRuntime", () => {
  it("resolves bounded retry delays using exponential backoff", () => {
    expect(resolveRetryDelaySeconds(0)).toBe(30);
    expect(resolveRetryDelaySeconds(1)).toBe(30);
    expect(resolveRetryDelaySeconds(2)).toBe(60);
    expect(resolveRetryDelaySeconds(3)).toBe(120);
    expect(resolveRetryDelaySeconds(10)).toBe(180);
    expect(resolveRetryDelaySeconds(1, "terminal_success_no_media")).toBe(10);
    expect(resolveRetryDelaySeconds(2, "terminal_success_no_media")).toBe(20);
    expect(resolveRetryDelaySeconds(10, "terminal_success_no_media")).toBe(60);
  });

  it("allows fail->success only for terminal_success_no_media recovery states", () => {
    expect(
      canTransitionToSuccess({
        status: "pending",
        failureReasonCode: null,
        recoveryState: "queued",
      })
    ).toBe(true);
    expect(
      canTransitionToSuccess({
        status: "submitted",
        failureReasonCode: null,
        recoveryState: "recovering",
      })
    ).toBe(true);
    expect(
      canTransitionToSuccess({
        status: "fail",
        failureReasonCode: "terminal_success_no_media",
        recoveryState: "queued",
      })
    ).toBe(true);
    expect(
      canTransitionToSuccess({
        status: "fail",
        failureReasonCode: "provider_error",
        recoveryState: "queued",
      })
    ).toBe(false);
    expect(
      canTransitionToSuccess({
        status: "running",
        failureReasonCode: null,
        recoveryState: "none",
      })
    ).toBe(true);
  });

  it("collects recovered urls from observation media and payload with dedupe", () => {
    const urls = collectRecoveredUrls({
      mediaUrls: [" https://cdn.shortpulse.test/a.png ", "https://cdn.shortpulse.test/a.png"],
      payload: {
        data: {
          images: [{ url: "https://cdn.shortpulse.test/b.png" }],
        },
      },
    });
    expect(urls).toEqual([
      "https://cdn.shortpulse.test/a.png",
      "https://cdn.shortpulse.test/b.png",
    ]);
  });

  it("collects recovered urls from Fal webhook payload envelopes", () => {
    const urls = collectRecoveredUrls({
      provider: "fal",
      mediaUrls: [],
      payload: {
        payload: {
          images: [{ url: "https://cdn.shortpulse.test/from-webhook.png" }],
        },
      },
    });

    expect(urls).toEqual(["https://cdn.shortpulse.test/from-webhook.png"]);
  });

  it("collects recovered urls from kie model-aware payloads", () => {
    const urls = collectRecoveredUrls({
      provider: "kie",
      modelId: "kie-ai/kling-3.0",
      mediaUrls: [],
      payload: {
        result: {
          outputs: [{ video_url: "https://cdn.shortpulse.test/kie-video.mp4" }],
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/kie-video.mp4"]);
  });

  it("resolves media type and extension from content type and url fallback", () => {
    expect(resolveFileType("video/mp4", "https://cdn.shortpulse.test/image.png")).toBe("video");
    expect(resolveFileType(null, "https://cdn.shortpulse.test/clip.webm?sig=1")).toBe("video");
    expect(resolveFileType(null, "https://cdn.shortpulse.test/no-ext")).toBe("image");

    expect(resolveExtension("image/jpeg", "https://cdn.shortpulse.test/x")).toBe("jpg");
    expect(resolveExtension(null, "https://cdn.shortpulse.test/y.webp?token=1")).toBe("webp");
    expect(resolveExtension("video/custom", "https://cdn.shortpulse.test/no-ext")).toBe("mp4");
  });

  it("normalizes filenames and prompt bases", () => {
    expect(sanitizeFilename("portrait / one?.png")).toBe("portrait_one_.png");
    expect(clampPrompt("   ")).toBe("ai-studio-generation");
    expect(clampPrompt("x".repeat(60))).toBe(`${"x".repeat(48)}...`);
  });
});

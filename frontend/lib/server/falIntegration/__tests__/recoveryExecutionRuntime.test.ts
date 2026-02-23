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
    expect(resolveRetryDelaySeconds(0)).toBe(120);
    expect(resolveRetryDelaySeconds(1)).toBe(120);
    expect(resolveRetryDelaySeconds(2)).toBe(240);
    expect(resolveRetryDelaySeconds(3)).toBe(480);
    expect(resolveRetryDelaySeconds(10)).toBe(900);
  });

  it("allows fail->success only for terminal_success_no_media recovery states", () => {
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

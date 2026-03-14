/**
 * Tests for canvas drop URL resolution helpers.
 * Ensures canvas image drops select renderable URLs for quick-slot and all-refs drags.
 */
import { describe, expect, it } from "vitest";
import { resolveCanvasDropImageSourceUrl } from "../canvasDropResolvers";

const makeOutput = (overrides?: {
  previewUrl?: string | undefined;
  fullStoragePath?: string | null | undefined;
  previewStoragePath?: string | null | undefined;
  resultUrls?: string[] | undefined;
}) => ({
  previewUrl: overrides?.previewUrl,
  fullStoragePath: overrides?.fullStoragePath ?? null,
  previewStoragePath: overrides?.previewStoragePath ?? null,
  resultUrls: overrides?.resultUrls,
});

describe("resolveCanvasDropImageSourceUrl", () => {
  it("uses indexed result URL when it is renderable", () => {
    const sourceUrl = resolveCanvasDropImageSourceUrl({
      output: makeOutput({
        previewUrl: "https://example.com/preview.png",
        resultUrls: ["https://example.com/full.png"],
      }),
      imageIndex: 0,
      payloadReferenceUrl: null,
    });

    expect(sourceUrl).toBe("https://example.com/full.png");
  });

  it("falls back to output preview URL when indexed result URL is not renderable", () => {
    const sourceUrl = resolveCanvasDropImageSourceUrl({
      output: makeOutput({
        previewUrl: "https://example.com/preview.png",
        resultUrls: ["tmpwk6qxaqk.jpeg"],
      }),
      imageIndex: 0,
      payloadReferenceUrl: null,
    });

    expect(sourceUrl).toBe("https://example.com/preview.png");
  });

  it("falls back to payload reference URL when output has no renderable image URL", () => {
    const sourceUrl = resolveCanvasDropImageSourceUrl({
      output: makeOutput({
        previewUrl: "",
        resultUrls: ["tmpwk6qxaqk.jpeg"],
      }),
      imageIndex: 0,
      payloadReferenceUrl: "https://example.com/payload-fallback.png",
    });

    expect(sourceUrl).toBe("https://example.com/payload-fallback.png");
  });

  it("accepts root-relative renderable preview URLs for image drops", () => {
    const sourceUrl = resolveCanvasDropImageSourceUrl({
      output: makeOutput({
        previewUrl: "/api/media/preview?id=123",
        resultUrls: [],
      }),
      imageIndex: 0,
      payloadReferenceUrl: null,
    });

    expect(sourceUrl).toBe("/api/media/preview?id=123");
  });

  it("rejects video-like payload fallback URLs for image drops", () => {
    const sourceUrl = resolveCanvasDropImageSourceUrl({
      output: makeOutput({
        previewUrl: "",
        resultUrls: [],
      }),
      imageIndex: 0,
      payloadReferenceUrl: "/api/media/video.mp4",
    });

    expect(sourceUrl).toBeNull();
  });
});

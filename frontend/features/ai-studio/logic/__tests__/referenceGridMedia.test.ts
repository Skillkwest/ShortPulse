import { describe, expect, it } from "vitest";
import { resolveReferenceCardUrls } from "../referenceGridMedia";

describe("referenceGridMedia", () => {
  it("falls back to resultUrls when storage and preview URLs are unavailable", () => {
    const resolved = resolveReferenceCardUrls({
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: undefined,
      resultUrls: ["https://cdn.example.com/fallback.png"],
    });

    expect(resolved.previewUrl).toBe("https://cdn.example.com/fallback.png");
    expect(resolved.fullUrl).toBe("https://cdn.example.com/fallback.png");
  });

  it("resolves adaptive preview quality band by pressure level", () => {
    const level0 = resolveReferenceCardUrls(
      {
        previewStoragePath: "https://cdn.example.com/thumb-960.webp",
        fullStoragePath: "https://cdn.example.com/full.png",
        previewUrl: "https://cdn.example.com/legacy.png",
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 0,
        cardLongEdgePx: 300,
        devicePixelRatio: 2,
      }
    );
    const level2 = resolveReferenceCardUrls(
      {
        previewStoragePath: "https://cdn.example.com/thumb-640.webp",
        fullStoragePath: "https://cdn.example.com/full.png",
        previewUrl: "https://cdn.example.com/legacy.png",
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 2,
        cardLongEdgePx: 460,
        devicePixelRatio: 2,
      }
    );

    expect(level0.previewQualityBand).toBe("high");
    expect(level0.targetLongEdgePx).toBe(600);
    expect(level2.previewQualityBand).toBe("compact");
    expect(level2.targetLongEdgePx).toBe(640);
  });
});

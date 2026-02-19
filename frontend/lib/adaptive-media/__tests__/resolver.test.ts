import { describe, expect, it } from "vitest";
import { asCanonicalStoragePath, resolveAdaptiveMedia } from "../resolver";

describe("adaptive-media resolver", () => {
  it("resolves strict preview ladder using URL candidates", () => {
    const result = resolveAdaptiveMedia({
      surface: "reference-grid",
      mediaKind: "image",
      source: "remote",
      urls: {
        previewUrl: "https://example.com/preview.jpg",
        resultUrls: ["https://example.com/fallback.jpg"],
      },
      storage: {
        previewStoragePath: null,
        fullStoragePath: "https://example.com/full.jpg",
      },
      strictPreviewLadder: true,
      adaptivePreviewQuality: false,
      pressureLevel: 0,
    });

    expect(result.previewUrl).toBe("https://example.com/full.jpg");
    expect(result.fullUrl).toBe("https://example.com/full.jpg");
    expect(result.fallbackChain[0]).toBe("https://example.com/full.jpg");
  });

  it("wraps non-supabase image URLs with Next optimizer when adaptive quality is enabled", () => {
    const result = resolveAdaptiveMedia({
      surface: "reference-grid",
      mediaKind: "image",
      source: "remote",
      urls: {
        previewUrl: "https://cdn.example.com/image.jpg",
      },
      storage: {},
      strictPreviewLadder: false,
      adaptivePreviewQuality: true,
      pressureLevel: 0,
    });

    expect(result.previewUrl).toContain("/_next/image?url=");
    expect(result.previewUrl).toContain("q=");
  });

  it("normalizes canonical storage paths and rejects runtime URLs", () => {
    expect(asCanonicalStoragePath(" user-1/images/file.png ")).toBe("user-1/images/file.png");
    expect(asCanonicalStoragePath("https://example.com/file.png")).toBeNull();
    expect(asCanonicalStoragePath("blob:abc")).toBeNull();
    expect(asCanonicalStoragePath("data:image/png;base64,abc")).toBeNull();
  });
});

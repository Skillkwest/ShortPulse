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
    expect(level0.targetLongEdgePx).toBe(640);
    expect(level2.previewQualityBand).toBe("compact");
    expect(level2.targetLongEdgePx).toBe(448);
  });

  it("uses next image optimizer for supabase object URLs", () => {
    const resolved = resolveReferenceCardUrls(
      {
        previewStoragePath:
          "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/ref.png?token=abc123",
        fullStoragePath:
          "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/ref.png?token=abc123",
        previewUrl: undefined,
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 2,
        cardLongEdgePx: 300,
        devicePixelRatio: 2,
      }
    );

    expect(resolved.previewUrl?.startsWith("/_next/image?url=")).toBe(true);
    expect(resolved.previewUrl).toContain(
      `url=${encodeURIComponent(
        "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/ref.png?token=abc123"
      )}`
    );
    expect(resolved.previewUrl).toContain("w=448");
    expect(resolved.previewUrl).toContain("q=24");
    expect(resolved.fullUrl).not.toContain("width=");
  });

  it("applies direct supabase render image transforms when already on render endpoint", () => {
    const sourceUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/render/image/sign/media_library/u/a/ref.png?token=abc123";
    const resolved = resolveReferenceCardUrls(
      {
        previewStoragePath: sourceUrl,
        fullStoragePath: sourceUrl,
        previewUrl: undefined,
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 2,
        cardLongEdgePx: 300,
        devicePixelRatio: 2,
      }
    );

    expect(resolved.previewUrl).toContain("/storage/v1/render/image/");
    expect(resolved.previewUrl).toContain("width=448");
    expect(resolved.previewUrl).toContain("quality=24");
  });

  it("falls back to next image optimizer for non-supabase remote images", () => {
    const sourceUrl = "https://cdn.example.com/ref.jpg?token=abc";
    const resolved = resolveReferenceCardUrls(
      {
        previewStoragePath: sourceUrl,
        fullStoragePath: sourceUrl,
        previewUrl: undefined,
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 2,
      }
    );

    expect(resolved.previewUrl?.startsWith("/_next/image?url=")).toBe(true);
    expect(resolved.previewUrl).toContain(`url=${encodeURIComponent(sourceUrl)}`);
    expect(resolved.previewUrl).toContain("w=448");
    expect(resolved.previewUrl).toContain("q=24");
    expect(resolved.fullUrl).toBe(sourceUrl);
  });

  it("falls back to next image optimizer for relative image URLs", () => {
    const sourceUrl = "/api/media/preview/ref-123?token=abc";
    const resolved = resolveReferenceCardUrls(
      {
        previewStoragePath: sourceUrl,
        fullStoragePath: sourceUrl,
        previewUrl: undefined,
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 1,
      }
    );

    expect(resolved.previewUrl?.startsWith("/_next/image?url=")).toBe(true);
    expect(resolved.previewUrl).toContain(`url=${encodeURIComponent(sourceUrl)}`);
    expect(resolved.previewUrl).toContain("w=512");
    expect(resolved.previewUrl).toContain("q=26");
  });

  it("does not transform relative video URLs", () => {
    const sourceUrl = "/api/media/video/ref-123.mp4?token=abc";
    const resolved = resolveReferenceCardUrls(
      {
        previewStoragePath: sourceUrl,
        fullStoragePath: sourceUrl,
        previewUrl: undefined,
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 2,
      }
    );

    expect(resolved.previewUrl).toBe(sourceUrl);
  });
});

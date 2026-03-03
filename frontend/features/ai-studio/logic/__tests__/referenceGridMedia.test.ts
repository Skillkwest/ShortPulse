import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveReferenceCardUrls } from "../referenceGridMedia";

const importResolver = async () => {
  vi.resetModules();
  return import("../referenceGridMedia");
};

describe("referenceGridMedia", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
    expect(resolved.previewUrl).toContain("q=34");
    expect(resolved.fullUrl).not.toContain("width=");
  });

  it("uses adaptive optimization for supabase object URLs without image extension when mode is image", () => {
    const sourceUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/reference_asset_12345?token=abc123";
    const resolved = resolveReferenceCardUrls(
      {
        mode: "image",
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
    expect(resolved.previewUrl).toContain("q=34");
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
    expect(resolved.previewUrl).toContain("quality=34");
  });

  it("applies direct supabase render transforms without image extension when mode is image", () => {
    const sourceUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/render/image/sign/media_library/u/a/reference_asset_12345?token=abc123";
    const resolved = resolveReferenceCardUrls(
      {
        mode: "image",
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

    expect(resolved.previewUrl).toContain("/storage/v1/render/image/");
    expect(resolved.previewUrl).toContain("width=512");
    expect(resolved.previewUrl).toContain("quality=34");
  });

  it("does not transform supabase object URLs without extension when mode is video", () => {
    const sourceUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/reference_asset_12345?token=abc123";
    const resolved = resolveReferenceCardUrls(
      {
        mode: "video",
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

  it("falls back to next image optimizer for non-supabase remote images", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");

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
    expect(resolved.previewUrl).toContain("q=34");
    expect(resolved.fullUrl).toBe(sourceUrl);
  });

  it("does not route fal media image URLs through the next image optimizer", () => {
    const sourceUrl = "https://v3b.fal.media/files/b/0a8f2961/example-image.png";
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
    expect(resolved.previewUrl).toContain("q=34");
  });

  it("ignores root-relative workspace storage key paths and falls back to preview URL", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");

    const invalidStorageKeyPath =
      "/82004e53-a9bd-48c8-85ff-20dbeb658d21/uploads/images/9cccad0b-e38d-4623-96d9-80e70837bc29-0.jpg";
    const signedPreviewUrl = "https://cdn.example.com/media/ref-123.jpg?token=signed";
    const resolved = resolveReferenceCardUrls(
      {
        previewStoragePath: invalidStorageKeyPath,
        fullStoragePath: invalidStorageKeyPath,
        previewUrl: signedPreviewUrl,
        resultUrls: [],
      },
      {
        adaptivePreviewQuality: true,
        pressureLevel: 0,
      }
    );

    expect(resolved.previewUrl?.startsWith("/_next/image?url=")).toBe(true);
    expect(resolved.previewUrl).toContain(`url=${encodeURIComponent(signedPreviewUrl)}`);
    expect(resolved.fullUrl).toBe(signedPreviewUrl);
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

  it("does not compact legacy long-edge target when heavy-load compaction flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION", "false");
    const resolver = await importResolver();

    const sourceUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/render/image/sign/media_library/u/a/ref.png?token=abc123";
    const resolved = resolver.resolveReferenceCardUrls(
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

    expect(resolved.targetLongEdgePx).toBe(448);
    expect(resolved.previewUrl).toContain("width=448");
    expect(resolved.previewUrl).toContain("quality=34");
  });

  it("compacts legacy long-edge target at pressure level 2 when flag is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION", "true");
    const resolver = await importResolver();

    const sourceUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/render/image/sign/media_library/u/a/ref.png?token=abc123";
    const resolved = resolver.resolveReferenceCardUrls(
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

    expect(resolved.targetLongEdgePx).toBe(385);
    expect(resolved.previewUrl).toContain("width=385");
    expect(resolved.previewUrl).toContain("quality=34");
  });
});

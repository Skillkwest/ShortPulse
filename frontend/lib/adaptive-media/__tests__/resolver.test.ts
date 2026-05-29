import { afterEach, describe, expect, it, vi } from "vitest";
import { asCanonicalStoragePath, resolveAdaptiveMedia } from "../resolver";

describe("adaptive-media resolver", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("does not wrap untrusted external image URLs with Next optimizer by default", () => {
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

    expect(result.previewUrl).toBe("https://cdn.example.com/image.jpg");
  });

  it("wraps allowlisted external image URLs with Next optimizer when enabled", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");

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

  it("uses the smaller optimizer width for tuned media-library panel grids", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");
    vi.resetModules();
    const { resolveAdaptiveMedia: resolveAdaptiveMediaWithTunedPolicy } =
      await import("../resolver");

    const result = resolveAdaptiveMediaWithTunedPolicy({
      surface: "media-library-panel-grid",
      mediaKind: "image",
      source: "remote",
      urls: {
        previewUrl: "https://cdn.example.com/image.jpg",
      },
      storage: {},
      strictPreviewLadder: false,
      adaptivePreviewQuality: true,
      pressureLevel: 1,
      cardLongEdgePx: 188,
      devicePixelRatio: 1,
    });

    expect(result.decision.targetLongEdgePx).toBe(240);
    expect(result.previewUrl).toContain("w=256");
  });

  it("does not wrap fal media URLs with Next optimizer when adaptive quality is enabled", () => {
    const result = resolveAdaptiveMedia({
      surface: "reference-grid",
      mediaKind: "image",
      source: "remote",
      urls: {
        previewUrl: "https://v3b.fal.media/files/b/0a8fb9ad/example.png",
      },
      storage: {},
      strictPreviewLadder: false,
      adaptivePreviewQuality: true,
      pressureLevel: 0,
    });

    expect(result.previewUrl).toBe("https://v3b.fal.media/files/b/0a8fb9ad/example.png");
  });

  it("routes supabase signed object URLs through native render images in right-rail grid surfaces", () => {
    const sourceUrl =
      "https://project.supabase.co/storage/v1/object/sign/media_library/user-1/images/a.png?token=abc";
    const result = resolveAdaptiveMedia({
      surface: "reference-grid",
      mediaKind: "image",
      source: "remote",
      urls: {
        previewUrl: sourceUrl,
      },
      storage: {},
      strictPreviewLadder: false,
      adaptivePreviewQuality: true,
      pressureLevel: 2,
    });

    expect(result.previewUrl).toContain("/storage/v1/render/image/sign/");
    expect(result.previewUrl).toContain("width=320");
    expect(result.previewUrl).toContain("quality=28");
    expect(result.previewUrl).toContain("token=abc");
    expect(result.fullUrl).toBe(sourceUrl);
  });

  it("normalizes canonical storage paths and rejects runtime URLs", () => {
    expect(asCanonicalStoragePath(" user-1/images/file.png ")).toBe("user-1/images/file.png");
    expect(asCanonicalStoragePath("https://example.com/file.png")).toBeNull();
    expect(asCanonicalStoragePath("blob:abc")).toBeNull();
    expect(asCanonicalStoragePath("data:image/png;base64,abc")).toBeNull();
  });
});

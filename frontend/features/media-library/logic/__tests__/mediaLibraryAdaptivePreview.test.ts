import { describe, expect, it } from "vitest";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../mediaLibraryAdaptivePreview";

const signedImageUrl =
  "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/upload/cat.jpg?token=abc";

describe("resolveMediaLibraryAdaptiveCardPreviewUrl", () => {
  it("returns original URL when adaptive preview is disabled", () => {
    const resolved = resolveMediaLibraryAdaptiveCardPreviewUrl({
      surface: "media-library-grid",
      signedUrl: signedImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: false,
    });
    expect(resolved).toBe(signedImageUrl);
  });

  it("uses pressure-aware adaptive transforms for image previews", () => {
    const highQuality = resolveMediaLibraryAdaptiveCardPreviewUrl({
      surface: "media-library-grid",
      signedUrl: signedImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 0,
      adaptivePreviewQualityEnabled: true,
    });
    const balancedQuality = resolveMediaLibraryAdaptiveCardPreviewUrl({
      surface: "media-library-grid",
      signedUrl: signedImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
    });

    expect(highQuality).toContain("/_next/image?");
    expect(highQuality).toContain("&q=40");
    expect(balancedQuality).toContain("/_next/image?");
    expect(balancedQuality).toContain("&q=34");
  });

  it("bypasses adaptive transform when fallback mode is active", () => {
    const resolved = resolveMediaLibraryAdaptiveCardPreviewUrl({
      surface: "media-library-modal-grid",
      signedUrl: signedImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
      shouldBypassAdaptivePreview: true,
    });
    expect(resolved).toBe(signedImageUrl);
  });
});

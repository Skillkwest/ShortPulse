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

  it("keeps signed storage URLs unchanged when adaptive preview is enabled", () => {
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

    expect(highQuality).toBe(signedImageUrl);
    expect(balancedQuality).toBe(signedImageUrl);
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

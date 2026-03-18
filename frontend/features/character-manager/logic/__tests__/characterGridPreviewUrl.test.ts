import { describe, expect, it } from "vitest";
import { resolveCharacterGridPreviewUrl } from "../characterGridPreviewUrl";

describe("characterGridPreviewUrl", () => {
  it("returns null for empty input", () => {
    expect(
      resolveCharacterGridPreviewUrl({
        url: "  ",
        adaptivePreviewEnabled: true,
        pressureLevel: 0,
        cardLongEdgePx: 320,
        devicePixelRatio: 1,
      })
    ).toBeNull();
  });

  it("returns the original URL when adaptive preview is disabled", () => {
    expect(
      resolveCharacterGridPreviewUrl({
        url: "https://cdn.test/original.png",
        adaptivePreviewEnabled: false,
        pressureLevel: 2,
        cardLongEdgePx: 320,
        devicePixelRatio: 1,
      })
    ).toBe("https://cdn.test/original.png");
  });

  it("keeps durable variant URLs unchanged when adaptive preview is enabled", () => {
    const variantUrl =
      "https://supabase.test/storage/v1/object/sign/media_library/user-1/variants/thumb-320.png?token=abc";

    expect(
      resolveCharacterGridPreviewUrl({
        url: variantUrl,
        adaptivePreviewEnabled: true,
        pressureLevel: 2,
        cardLongEdgePx: 320,
        devicePixelRatio: 1,
      })
    ).toBe(variantUrl);
  });

  it("compacts non-variant remote URLs when adaptive preview is enabled", () => {
    const resolved = resolveCharacterGridPreviewUrl({
      url: "http://localhost/media/original.png",
      adaptivePreviewEnabled: true,
      pressureLevel: 1,
      cardLongEdgePx: 320,
      devicePixelRatio: 1,
    });

    expect(resolved).toContain("/_next/image?url=");
  });
});

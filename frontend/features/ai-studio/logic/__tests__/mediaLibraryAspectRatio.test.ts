/**
 * Unit tests for media-library aspect-ratio resolution.
 * Guards metadata parsing, clamping, and fallback paths used by AI Studio modal previews.
 */
import { describe, expect, it } from "vitest";
import { resolveMediaCardAspectRatio } from "../mediaLibraryAspectRatio";

describe("resolveMediaCardAspectRatio", () => {
  it("uses image fallback when metadata is missing", () => {
    expect(resolveMediaCardAspectRatio({ fileType: "image/png", metadata: null })).toBe(4 / 5);
  });

  it("uses video fallback when metadata is missing for video files", () => {
    expect(resolveMediaCardAspectRatio({ fileType: "video/mp4", metadata: null })).toBe(9 / 16);
  });

  it("prefers explicit aspect ratio metadata values", () => {
    expect(
      resolveMediaCardAspectRatio({ fileType: "image/png", metadata: { aspect_ratio: 1.75 } })
    ).toBe(1.75);
    expect(
      resolveMediaCardAspectRatio({ fileType: "image/png", metadata: { aspectRatio: "1.2" } })
    ).toBe(1.2);
    expect(resolveMediaCardAspectRatio({ fileType: "image/png", metadata: { ratio: 0.9 } })).toBe(
      0.9
    );
  });

  it("derives aspect ratio from width and height metadata", () => {
    expect(
      resolveMediaCardAspectRatio({
        fileType: "image/jpeg",
        metadata: { width: 1440, height: 1080 },
      })
    ).toBeCloseTo(1.3333, 3);

    expect(
      resolveMediaCardAspectRatio({
        fileType: "image/jpeg",
        metadata: { dimensions: { width: "1920", height: "1080" } },
      })
    ).toBeCloseTo(1.7777, 3);
  });

  it("clamps extreme metadata ratios to stable bounds", () => {
    expect(
      resolveMediaCardAspectRatio({ fileType: "image/png", metadata: { aspect_ratio: 99 } })
    ).toBe(3);
    expect(
      resolveMediaCardAspectRatio({ fileType: "image/png", metadata: { aspect_ratio: 0.01 } })
    ).toBe(0.3);
  });

  it("falls back when metadata shape is invalid", () => {
    expect(
      resolveMediaCardAspectRatio({
        fileType: "image/png",
        metadata: { width: "nope", height: null, aspect_ratio: "NaN" },
      })
    ).toBe(4 / 5);
  });
});

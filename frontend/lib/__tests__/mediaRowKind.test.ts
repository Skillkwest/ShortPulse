import { describe, expect, it } from "vitest";
import { resolveMediaRowKind } from "../mediaRowKind";

describe("mediaRowKind", () => {
  it("treats durable playable video paths as stronger than stale image file_type", () => {
    expect(
      resolveMediaRowKind({
        file_type: "image/png",
        storage_path: "user-1/uploads/restored-video.mp4",
        poster_variant_path: "user-1/uploads/restored-video-poster.jpg",
      })
    ).toBe("video");
  });

  it("does not classify poster/thumb image paths alone as video", () => {
    expect(
      resolveMediaRowKind({
        file_type: "image/png",
        storage_path: "user-1/uploads/restored-frame.png",
        poster_variant_path: "user-1/variants/videos/media-1/poster_720.jpg",
        thumb_variant_path: "user-1/variants/videos/media-1/thumb_240.jpg",
      })
    ).toBe("image");
  });

  it("uses preview variants to recover video and audio rows with missing file_type", () => {
    expect(
      resolveMediaRowKind({
        file_type: null,
        storage_path: "user-1/uploads/unknown.bin",
        preview_variant_path: "user-1/variants/videos/media-1/preview_loop_360p.webm",
      })
    ).toBe("video");

    expect(
      resolveMediaRowKind({
        file_type: null,
        storage_path: "user-1/uploads/unknown.bin",
        preview_variant_path: "user-1/variants/audio/media-1/preview.mp3",
      })
    ).toBe("audio");
  });

  it("treats extension-only ogg paths as audio while preserving explicit video MIME authority", () => {
    expect(
      resolveMediaRowKind({
        file_type: null,
        storage_path: "user-1/uploads/sound.ogg",
      })
    ).toBe("audio");

    expect(
      resolveMediaRowKind({
        file_type: "video/ogg",
        storage_path: "user-1/uploads/clip.ogg",
      })
    ).toBe("video");

    expect(
      resolveMediaRowKind({
        file_type: null,
        storage_path: "user-1/uploads/clip.ogv",
      })
    ).toBe("video");
  });
});

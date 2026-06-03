import { describe, expect, it, vi } from "vitest";
import { resolveCanvasLibraryMediaDisplayAuthority } from "../canvasMediaDisplayAuthority";
import type { CanvasLibraryMediaPayload } from "../canvasMediaDisplayAuthority";

const basePayload = {
  id: "media-1",
  url: "https://cdn.example.com/original.png",
  fileType: "image",
} satisfies CanvasLibraryMediaPayload;

describe("canvasMediaDisplayAuthority", () => {
  it("uses signed image preview storage before direct or full media URLs", async () => {
    const signStoragePath = vi.fn(
      async (storagePath: string) => `https://signed.example.com/${storagePath}`
    );

    const result = await resolveCanvasLibraryMediaDisplayAuthority(
      {
        ...basePayload,
        previewStoragePath: "user-1/variants/images/media-1/thumb.webp",
        fullStoragePath: "user-1/originals/media-1.png",
        previewUrl: "https://cdn.example.com/preview.png",
        fullUrl: "https://cdn.example.com/full.png",
      },
      signStoragePath
    );

    expect(signStoragePath).toHaveBeenCalledWith("user-1/variants/images/media-1/thumb.webp");
    expect(result.mediaUrl).toBe(
      "https://signed.example.com/user-1/variants/images/media-1/thumb.webp"
    );
  });

  it("uses signed video poster storage for the board poster", async () => {
    const signStoragePath = vi.fn(
      async (storagePath: string) => `https://signed.example.com/${storagePath}`
    );

    const result = await resolveCanvasLibraryMediaDisplayAuthority(
      {
        id: "video-1",
        url: "https://cdn.example.com/original-video.mp4",
        fileType: "video",
        previewStoragePath: "user-1/variants/videos/video-1/preview-loop.mp4",
        previewPosterStoragePath: "user-1/variants/videos/video-1/poster.webp",
        previewPosterUrl: "https://cdn.example.com/poster.webp",
        fullUrl: "https://cdn.example.com/full-video.mp4",
      },
      signStoragePath
    );

    expect(signStoragePath).toHaveBeenCalledWith("user-1/variants/videos/video-1/preview-loop.mp4");
    expect(signStoragePath).toHaveBeenCalledWith("user-1/variants/videos/video-1/poster.webp");
    expect(result.mediaUrl).toBe(
      "https://signed.example.com/user-1/variants/videos/video-1/preview-loop.mp4"
    );
    expect(result.posterUrl).toBe(
      "https://signed.example.com/user-1/variants/videos/video-1/poster.webp"
    );
  });

  it("uses full media URLs only after signed preview, direct preview, and source URL miss", async () => {
    const signStoragePath = vi.fn(async () => null);

    const result = await resolveCanvasLibraryMediaDisplayAuthority(
      {
        ...basePayload,
        url: "",
        previewUrl: null,
        fullUrl: "https://cdn.example.com/full-last.png",
      },
      signStoragePath
    );

    expect(result.mediaUrl).toBe("https://cdn.example.com/full-last.png");
  });
});

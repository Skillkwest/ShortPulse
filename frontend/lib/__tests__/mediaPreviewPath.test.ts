import { describe, expect, it } from "vitest";
import {
  classifyMediaPreviewPath,
  resolveDurablePreviewStoragePath,
  resolveMediaPreviewCandidates,
  resolveMediaSigningStoragePaths,
  resolvePreferredMediaSigningStoragePath,
  resolvePreviewStoragePath,
  resolveVideoBrowseSigningCandidates,
  resolveVideoPosterSigningStoragePaths,
  resolveVideoPosterStoragePath,
} from "../mediaPreviewPath";

describe("mediaPreviewPath", () => {
  it("prefers durable image preview variants over the original storage path", () => {
    expect(
      resolveDurablePreviewStoragePath({
        file_type: "image",
        storage_path: "user-1/uploads/images/original.png",
        thumb_variant_path: "user-1/variants/images/media-1/thumb_480",
      })
    ).toBe("user-1/variants/images/media-1/thumb_480");
  });

  it("prefers durable video preview variants from metadata when columns are absent", () => {
    expect(
      resolveDurablePreviewStoragePath({
        file_type: "video",
        storage_path: "user-1/uploads/videos/original.mp4",
        metadata: {
          variants: {
            preview_loop_360p: {
              storage_path: "user-1/variants/videos/media-1/preview_loop_360p",
            },
          },
        },
      })
    ).toBe("user-1/variants/videos/media-1/preview_loop_360p");
  });

  it("falls back to the original storage path when no durable preview exists", () => {
    expect(
      resolvePreviewStoragePath({
        file_type: "image",
        storage_path: "user-1/uploads/images/original.png",
      })
    ).toBe("user-1/uploads/images/original.png");
  });

  it("classifies durable preview paths distinctly from original fallback paths", () => {
    const row = {
      file_type: "image",
      storage_path: "user-1/uploads/images/original.png",
      thumb_variant_path: "user-1/variants/images/media-1/thumb_480",
    };

    expect(classifyMediaPreviewPath(row, row.thumb_variant_path, "user-1")).toBe("durable");
    expect(classifyMediaPreviewPath(row, row.storage_path, "user-1")).toBe("original");
  });

  it("expands unscoped preview candidates into user-scoped signing paths first", () => {
    const row = {
      file_type: "image",
      storage_path: "uploads/images/original.png",
      thumb_variant_path: "variants/images/media-1/thumb_480",
    };

    expect(resolveMediaSigningStoragePaths(row, "user-1")).toEqual([
      "user-1/variants/images/media-1/thumb_480",
      "user-1/uploads/images/original.png",
      "variants/images/media-1/thumb_480",
      "uploads/images/original.png",
    ]);
  });

  it("resolves the preferred signable preview path without building the full candidate list", () => {
    const row = {
      file_type: "image",
      storage_path: "uploads/images/original.png",
      thumb_variant_path: "variants/images/media-1/thumb_480",
    };

    expect(resolvePreferredMediaSigningStoragePath(row, "user-1")).toBe(
      "user-1/variants/images/media-1/thumb_480"
    );
  });

  it("resolves signing paths and trusted direct urls from one preview-candidate helper", () => {
    const row = {
      file_type: "image",
      storage_path: "https://cdn.example.com/user-1/uploads/images/original.png",
      thumb_variant_path: "variants/images/media-1/thumb_480",
    };

    expect(resolveMediaPreviewCandidates(row, "user-1")).toEqual({
      storagePaths: [
        "user-1/variants/images/media-1/thumb_480",
        "user-1/uploads/images/original.png",
        "variants/images/media-1/thumb_480",
      ],
      directUrls: [],
    });
  });

  it("prefers explicit video poster variants over loop previews", () => {
    expect(
      resolveVideoPosterStoragePath({
        file_type: "video/mp4",
        storage_path: "user-1/uploads/videos/original.mp4",
        preview_variant_path: "user-1/variants/videos/media-1/preview_loop_360p.mp4",
        poster_variant_path: "user-1/variants/videos/media-1/poster_720.jpg",
      })
    ).toBe("user-1/variants/videos/media-1/poster_720.jpg");
  });

  it("resolves video poster variants from metadata when columns are absent", () => {
    expect(
      resolveVideoPosterStoragePath({
        file_type: "video/mp4",
        storage_path: "user-1/uploads/videos/original.mp4",
        metadata: {
          variant_paths: {
            poster: "user-1/variants/videos/media-2/poster_720.jpg",
          },
          variants: {
            preview_loop_360p: {
              storage_path: "user-1/variants/videos/media-2/preview_loop_360p.mp4",
            },
          },
        },
      })
    ).toBe("user-1/variants/videos/media-2/poster_720.jpg");
  });

  it("expands unscoped video poster candidates into user-scoped signing paths first", () => {
    expect(
      resolveVideoPosterSigningStoragePaths(
        {
          file_type: "video/mp4",
          poster_variant_path: "variants/videos/media-3/poster_720.jpg",
        },
        "user-1"
      )
    ).toEqual([
      "user-1/variants/videos/media-3/poster_720.jpg",
      "variants/videos/media-3/poster_720.jpg",
    ]);
  });

  it("resolves video browse poster and hover candidates from one shared pass", () => {
    expect(
      resolveVideoBrowseSigningCandidates(
        {
          file_type: "video/mp4",
          storage_path: "uploads/videos/original.mp4",
          preview_variant_path: "variants/videos/media-4/preview_loop_360p.mp4",
          poster_variant_path: "variants/videos/media-4/poster_720.jpg",
        },
        "user-1"
      )
    ).toEqual({
      posterPaths: [
        "user-1/variants/videos/media-4/poster_720.jpg",
        "variants/videos/media-4/poster_720.jpg",
      ],
      hoverVideoPath: "user-1/variants/videos/media-4/preview_loop_360p.mp4",
    });
  });
});

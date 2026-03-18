import { describe, expect, it } from "vitest";
import { resolveDurablePreviewStoragePath, resolvePreviewStoragePath } from "../mediaPreviewPath";

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
});

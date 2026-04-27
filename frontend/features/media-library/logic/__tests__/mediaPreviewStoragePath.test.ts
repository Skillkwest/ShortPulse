import { describe, expect, it } from "vitest";
import { resolveMediaPreviewStoragePath } from "../mediaPreviewStoragePath";

describe("mediaPreviewStoragePath", () => {
  it("prefers the first signable preview candidate", () => {
    const path = resolveMediaPreviewStoragePath(
      {
        storage_path: "user-1/uploads/full.png",
        thumb_variant_path: "user-1/variants/thumb.png",
        file_type: "image/png",
      },
      "user-1"
    );

    expect(path).toBe("user-1/variants/thumb.png");
  });

  it("falls back to the canonical storage path when no preview candidate exists", () => {
    const path = resolveMediaPreviewStoragePath(
      {
        storage_path: "user-1/uploads/full.png",
        file_type: "image/png",
      },
      "user-1"
    );

    expect(path).toBe("user-1/uploads/full.png");
  });
});

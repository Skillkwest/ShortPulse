import { describe, expect, it } from "vitest";
import { createInternalMediaRefFromResolvedSource } from "../referenceInputInternalMediaRegistry";

describe("createInternalMediaRefFromResolvedSource", () => {
  it("preserves durable media file identity for submit-time admission", () => {
    const ref = createInternalMediaRefFromResolvedSource({
      mediaId: "media-1",
      fullStoragePath: "user-1/generations/images/original.png",
      previewStoragePath: "user-1/generations/images/preview.png",
    });

    expect(ref).toEqual({
      version: 1,
      kind: "storage_object",
      bucket: "media_library",
      storagePath: "user-1/generations/images/original.png",
      mediaFileId: "media-1",
    });
  });
});

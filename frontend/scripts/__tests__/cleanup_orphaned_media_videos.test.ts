import { describe, expect, it } from "vitest";
import {
  buildCleanupStoragePaths,
  selectCleanupCandidates,
  wasRowDeleted,
} from "../cleanup_orphaned_media_videos.mjs";

describe("cleanup_orphaned_media_videos", () => {
  it("selects only fully orphaned video rows for cleanup", () => {
    expect(
      selectCleanupCandidates([
        { id: "keep-1", disposition: "durable_preview_available" },
        { id: "delete-1", disposition: "fully_orphaned" },
        { id: "keep-2", disposition: "source_recoverable" },
      ])
    ).toEqual([{ id: "delete-1", disposition: "fully_orphaned" }]);
  });

  it("deduplicates stale storage paths before cleanup", () => {
    expect(
      buildCleanupStoragePaths({
        storagePath: "user-1/uploads/videos/a.mp4",
        previewVariantPath: null,
        posterVariantPath: "user-1/variants/videos/a/poster_720.jpg",
      })
    ).toEqual(["user-1/uploads/videos/a.mp4", "user-1/variants/videos/a/poster_720.jpg"]);

    expect(
      buildCleanupStoragePaths({
        storagePath: "user-1/uploads/videos/a.mp4",
        previewVariantPath: "user-1/uploads/videos/a.mp4",
        posterVariantPath: "user-1/variants/videos/a/poster_720.jpg",
      })
    ).toEqual(["user-1/uploads/videos/a.mp4", "user-1/variants/videos/a/poster_720.jpg"]);
  });

  it("requires an actual deleted row before reporting success", () => {
    expect(wasRowDeleted([])).toBe(false);
    expect(wasRowDeleted(null)).toBe(false);
    expect(wasRowDeleted([{ id: "row-1" }])).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { resolveVisibleMediaRows } from "../resolveVisibleMediaRows";

describe("resolveVisibleMediaRows", () => {
  const rows = [
    {
      id: "image-1",
      filename: "cat.png",
      storage_path: "user-1/uploads/cat.png",
      file_type: "image/png",
      source: "upload",
    },
    {
      id: "image-2",
      filename: "dog.png",
      storage_path: "user-1/uploads/dog.png",
      file_type: "image/png",
      source: "upload",
    },
    {
      id: "video-1",
      filename: "cat.mp4",
      storage_path: "user-1/uploads/cat.mp4",
      file_type: "video/mp4",
      source: "upload",
    },
  ];

  it("returns no rows when there is no active media tab", () => {
    expect(
      resolveVisibleMediaRows({
        rows,
        activeMediaTab: null,
        activeMediaQuery: "",
        cachedMediaQuery: "",
      })
    ).toEqual([]);
  });

  it("skips redundant query filtering when the cache already matches the active query", () => {
    expect(
      resolveVisibleMediaRows({
        rows,
        activeMediaTab: "uploaded_images",
        activeMediaQuery: "cat",
        cachedMediaQuery: "cat",
      }).map((row) => row.id)
    ).toEqual(["image-1", "image-2"]);
  });

  it("applies query filtering when the visible rows are from a stale query scope", () => {
    expect(
      resolveVisibleMediaRows({
        rows,
        activeMediaTab: "uploaded_images",
        activeMediaQuery: "cat",
        cachedMediaQuery: "",
      }).map((row) => row.id)
    ).toEqual(["image-1"]);
  });
});

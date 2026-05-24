import { describe, expect, it } from "vitest";
import {
  resolveProjectCardPreviewSigningStoragePaths,
  resolveProjectPreviewImageUrlsFromSnapshot,
} from "../projectsService";

describe("resolveProjectPreviewImageUrlsFromSnapshot", () => {
  it("prefers the first four quick-slot image previews", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["quick-1", "quick-2", "quick-3", "quick-4", "quick-5", "quick-6"],
        active: [
          { id: "quick-1", mode: "image", previewUrl: "https://cdn.example.com/quick-1.png" },
          { id: "quick-2", mode: "image", previewUrl: "https://cdn.example.com/quick-2.png" },
          { id: "quick-3", mode: "image", resultUrls: ["https://cdn.example.com/quick-3.png"] },
          { id: "quick-4", mode: "image", previewUrl: "https://cdn.example.com/quick-4.png" },
          { id: "quick-5", mode: "image", previewUrl: "https://cdn.example.com/quick-5.png" },
          { id: "quick-6", mode: "image", previewUrl: "https://cdn.example.com/quick-6.png" },
          { id: "grid-1", mode: "image", previewUrl: "https://cdn.example.com/grid-1.png" },
        ],
        archived: [],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([
      "https://cdn.example.com/quick-1.png",
      "https://cdn.example.com/quick-2.png",
      "https://cdn.example.com/quick-3.png",
      "https://cdn.example.com/quick-4.png",
    ]);
  });

  it("falls back to the first four visible reference-grid images when quick slot has none", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["video-1"],
        active: [
          { id: "video-1", mode: "video", previewUrl: "https://cdn.example.com/video-1.mp4" },
          { id: "grid-1", mode: "image", previewUrl: "https://cdn.example.com/grid-1.png" },
          { id: "grid-2", mode: "image", resultUrls: ["https://cdn.example.com/grid-2.png"] },
          {
            id: "grid-hidden",
            mode: "image",
            previewUrl: "https://cdn.example.com/grid-hidden.png",
            hiddenInReferenceGrid: true,
          },
          { id: "grid-3", mode: "image", previewUrl: "https://cdn.example.com/grid-3.png" },
          { id: "grid-4", mode: "image", previewUrl: "https://cdn.example.com/grid-4.png" },
          { id: "grid-5", mode: "image", previewUrl: "https://cdn.example.com/grid-5.png" },
          { id: "grid-6", mode: "image", previewUrl: "https://cdn.example.com/grid-6.png" },
        ],
        archived: [],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([
      "https://cdn.example.com/grid-1.png",
      "https://cdn.example.com/grid-2.png",
      "https://cdn.example.com/grid-3.png",
      "https://cdn.example.com/grid-4.png",
    ]);
  });

  it("returns no previews when neither quick slot nor reference grid has images", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["audio-1"],
        active: [{ id: "audio-1", mode: "audio", previewUrl: "https://cdn.example.com/audio.mp3" }],
        archived: [{ id: "text-1", mode: "text" }],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([]);
  });

  it("ignores failed image outputs when resolving project previews from raw snapshots", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["failed-quick", "success-quick"],
        active: [
          {
            id: "failed-quick",
            mode: "image",
            taskState: "fail",
            previewUrl: "https://cdn.example.com/failed-quick.png",
          },
          {
            id: "success-quick",
            mode: "image",
            taskState: "success",
            previewUrl: "https://cdn.example.com/success-quick.png",
          },
          {
            id: "failed-grid",
            mode: "image",
            taskState: "fail",
            previewUrl: "https://cdn.example.com/failed-grid.png",
          },
          {
            id: "success-grid",
            mode: "image",
            taskState: "success",
            previewUrl: "https://cdn.example.com/success-grid.png",
          },
        ],
        archived: [
          {
            id: "failed-archived",
            mode: "image",
            taskState: "fail",
            previewUrl: "https://cdn.example.com/failed-archived.png",
          },
        ],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([
      "https://cdn.example.com/success-quick.png",
    ]);
  });
});

describe("resolveProjectCardPreviewSigningStoragePaths", () => {
  it("prefers the smaller thumb derivative before thumb_480 variants", () => {
    expect(
      resolveProjectCardPreviewSigningStoragePaths("user-1/variants/images/media-1/thumb_480")
    ).toEqual([
      "user-1/variants/images/media-1/thumb_240",
      "user-1/variants/images/media-1/thumb_480",
    ]);
  });

  it("keeps non-derivative storage paths unchanged", () => {
    expect(
      resolveProjectCardPreviewSigningStoragePaths("user-1/generations/images/project-1.png")
    ).toEqual(["user-1/generations/images/project-1.png"]);
  });

  it("drops out-of-scope storage paths when a user scope is provided", () => {
    expect(
      resolveProjectCardPreviewSigningStoragePaths(
        "user-2/generations/images/project-1.png",
        "user-1"
      )
    ).toEqual([]);
  });

  it("returns no signing paths when storage is unavailable", () => {
    expect(resolveProjectCardPreviewSigningStoragePaths(null)).toEqual([]);
  });
});

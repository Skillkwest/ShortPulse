import { describe, expect, it } from "vitest";
import {
  buildVideoPosterExtractionArgs,
  VIDEO_POSTER_FILTER,
  VIDEO_POSTER_SEEK_SECONDS,
  VIDEO_PREVIEW_SCALE_FILTER,
} from "../videoPosterVariant";

describe("videoPosterVariant", () => {
  it("uses an even-dimension scale filter for preview-loop extraction", () => {
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("scale=360:-2");
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("ceil(iw/2)*2");
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("ceil(ih/2)*2");
  });

  it("seeks into videos and selects a representative frame for posters", () => {
    expect(VIDEO_POSTER_SEEK_SECONDS).toBe(0.5);
    expect(VIDEO_POSTER_FILTER).toContain("thumbnail");
    expect(VIDEO_POSTER_FILTER).toContain("scale=720:-2");

    expect(
      buildVideoPosterExtractionArgs({
        inputPath: "/tmp/source.mp4",
        outputPath: "/tmp/poster.jpg",
      })
    ).toEqual([
      "-y",
      "-ss",
      "0.5",
      "-i",
      "/tmp/source.mp4",
      "-vf",
      VIDEO_POSTER_FILTER,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      "/tmp/poster.jpg",
    ]);
  });
});

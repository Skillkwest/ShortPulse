import { describe, expect, it } from "vitest";
import {
  buildVideoPreviewVariantExtractionArgs,
  buildVideoPosterExtractionArgs,
  VIDEO_POSTER_FILTER,
  VIDEO_POSTER_JPEG_QUALITY,
  VIDEO_POSTER_SEEK_SECONDS,
  VIDEO_PREVIEW_CRF,
  VIDEO_PREVIEW_FPS,
  VIDEO_PREVIEW_PRESET,
  VIDEO_PREVIEW_PROFILE,
  VIDEO_PREVIEW_SCALE_FILTER,
  VIDEO_PREVIEW_SECONDS,
} from "../videoPosterVariant";

describe("videoPosterVariant", () => {
  it("uses an even-dimension scale filter for preview-loop extraction", () => {
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("scale=360:-2");
    expect(VIDEO_PREVIEW_SECONDS).toBe(3);
    expect(VIDEO_PREVIEW_CRF).toBe(30);
    expect(VIDEO_PREVIEW_FPS).toBeNull();
    expect(VIDEO_PREVIEW_PROFILE).toBeNull();
    expect(VIDEO_PREVIEW_PRESET).toBe("veryfast");
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("ceil(iw/2)*2");
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("ceil(ih/2)*2");
  });

  it("builds default bounded preview-loop ffmpeg args", () => {
    expect(
      buildVideoPreviewVariantExtractionArgs({
        inputPath: "/tmp/source.mp4",
        outputPath: "/tmp/preview.mp4",
      })
    ).toEqual([
      "-y",
      "-i",
      "/tmp/source.mp4",
      "-an",
      "-t",
      "3",
      "-vf",
      VIDEO_PREVIEW_SCALE_FILTER,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "/tmp/preview.mp4",
    ]);
  });

  it("can build full-duration display derivative args for dashboard tutorials", () => {
    const args = buildVideoPreviewVariantExtractionArgs({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/display.mp4",
      scaleFilter:
        "scale=720:-2:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
      previewSeconds: null,
      crf: 24,
      fps: 30,
      profile: "main",
      preset: "slow",
      maxRate: "900k",
      bufSize: "1800k",
    });

    expect(args).not.toContain("-t");
    expect(args).toContain(
      "scale=720:-2:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2,fps=30"
    );
    expect(args).toContain("24");
    expect(args).toContain("-profile:v");
    expect(args).toContain("main");
    expect(args).toContain("-preset");
    expect(args).toContain("slow");
    expect(args).toContain("-maxrate");
    expect(args).toContain("900k");
    expect(args).toContain("-bufsize");
    expect(args).toContain("1800k");
    expect(args).toContain("+faststart");
  });

  it("seeks into videos and selects a representative frame for posters", () => {
    expect(VIDEO_POSTER_SEEK_SECONDS).toBe(0.5);
    expect(VIDEO_POSTER_JPEG_QUALITY).toBe(2);
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

  it("can build lower-weight poster args for dashboard tutorial thumbnails", () => {
    expect(
      buildVideoPosterExtractionArgs({
        inputPath: "/tmp/source.mp4",
        outputPath: "/tmp/poster.jpg",
        posterFilter: "thumbnail,scale=480:-2:force_original_aspect_ratio=decrease",
        jpegQuality: 5,
      })
    ).toEqual([
      "-y",
      "-ss",
      "0.5",
      "-i",
      "/tmp/source.mp4",
      "-vf",
      "thumbnail,scale=480:-2:force_original_aspect_ratio=decrease",
      "-frames:v",
      "1",
      "-q:v",
      "5",
      "/tmp/poster.jpg",
    ]);
  });
});

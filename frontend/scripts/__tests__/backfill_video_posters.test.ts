import { describe, expect, it } from "vitest";
import {
  normalizeCandidateRow,
  parseArgs,
  resolvePosterStoragePath,
} from "../backfill_video_posters.mjs";

describe("backfill_video_posters", () => {
  it("parses dry-run defaults", () => {
    const args = parseArgs(["node", "backfill_video_posters.mjs"]);

    expect(args.apply).toBe(false);
    expect(args.limit).toBe(25);
    expect(args.seekSeconds).toBe(0.5);
    expect(args.ffmpegPath).toBe("ffmpeg");
  });

  it("parses apply mode and scoped filters", () => {
    const args = parseArgs([
      "node",
      "backfill_video_posters.mjs",
      "--apply",
      "--limit",
      "7",
      "--media-file-id",
      "11111111-1111-4111-8111-111111111111",
      "--user-id",
      "22222222-2222-4222-8222-222222222222",
      "--seek-seconds",
      "1.25",
      "--ffmpeg-path",
      "/opt/bin/ffmpeg",
    ]);

    expect(args.apply).toBe(true);
    expect(args.limit).toBe(7);
    expect(args.mediaFileId).toBe("11111111-1111-4111-8111-111111111111");
    expect(args.userId).toBe("22222222-2222-4222-8222-222222222222");
    expect(args.seekSeconds).toBe(1.25);
    expect(args.ffmpegPath).toBe("/opt/bin/ffmpeg");
  });

  it("normalizes valid video candidates only", () => {
    expect(
      normalizeCandidateRow({
        id: "media-1",
        user_id: "user-1",
        storage_path: "user-1/generations/videos/video-1.mp4",
        file_type: "video/mp4",
        poster_variant_path: null,
        filename: "clip.mp4",
      })
    ).toEqual({
      id: "media-1",
      userId: "user-1",
      storagePath: "user-1/generations/videos/video-1.mp4",
      fileType: "video/mp4",
      posterVariantPath: null,
      filename: "clip.mp4",
    });

    expect(
      normalizeCandidateRow({
        id: "media-2",
        user_id: "user-1",
        storage_path: "user-1/generations/images/image-1.png",
        file_type: "image/png",
      })
    ).toBeNull();
  });

  it("builds deterministic poster storage paths", () => {
    expect(
      resolvePosterStoragePath({
        userId: "user-7",
        mediaFileId: "media-7",
      })
    ).toBe("user-7/variants/videos/media-7/poster_720.jpg");
  });
});

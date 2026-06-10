import { describe, expect, it } from "vitest";
import {
  fetchCandidates,
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
    expect(args.force).toBe(false);
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

  it("requires media-file-id for force mode", () => {
    expect(() => parseArgs(["node", "backfill_video_posters.mjs", "--force"])).toThrow(
      /--media-file-id/i
    );

    const args = parseArgs([
      "node",
      "backfill_video_posters.mjs",
      "--force",
      "--media-file-id",
      "11111111-1111-4111-8111-111111111111",
    ]);

    expect(args.force).toBe(true);
    expect(args.mediaFileId).toBe("11111111-1111-4111-8111-111111111111");
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

  it("keeps normal candidate fetches scoped to rows missing posters", async () => {
    const calls: string[] = [];
    const query = {
      data: [],
      error: null,
      select: () => {
        calls.push("select");
        return query;
      },
      ilike: () => {
        calls.push("ilike");
        return query;
      },
      is: (column: string, value: unknown) => {
        calls.push(`is:${column}:${String(value)}`);
        return query;
      },
      not: () => {
        calls.push("not");
        return query;
      },
      order: () => {
        calls.push("order");
        return query;
      },
      limit: () => {
        calls.push("limit");
        return query;
      },
      eq: () => {
        calls.push("eq");
        return query;
      },
    };
    const supabase = {
      from: () => query,
    };

    await fetchCandidates({
      supabase,
      limit: 25,
      mediaFileId: null,
      userId: null,
      force: false,
    });

    expect(calls).toContain("is:poster_variant_path:null");
  });

  it("allows force candidate fetches to include existing poster rows", async () => {
    const calls: string[] = [];
    const query = {
      data: [
        {
          id: "media-1",
          user_id: "user-1",
          storage_path: "user-1/generations/videos/video-1.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/media-1/poster_720.jpg",
          filename: "clip.mp4",
        },
      ],
      error: null,
      select: () => {
        calls.push("select");
        return query;
      },
      ilike: () => {
        calls.push("ilike");
        return query;
      },
      is: (column: string, value: unknown) => {
        calls.push(`is:${column}:${String(value)}`);
        return query;
      },
      not: () => {
        calls.push("not");
        return query;
      },
      order: () => {
        calls.push("order");
        return query;
      },
      limit: () => {
        calls.push("limit");
        return query;
      },
      eq: (column: string, value: string) => {
        calls.push(`eq:${column}:${value}`);
        return query;
      },
    };
    const supabase = {
      from: () => query,
    };

    const candidates = await fetchCandidates({
      supabase,
      limit: 1,
      mediaFileId: "media-1",
      userId: null,
      force: true,
    });

    expect(calls).not.toContain("is:poster_variant_path:null");
    expect(calls).toContain("eq:id:media-1");
    expect(candidates).toEqual([
      {
        id: "media-1",
        userId: "user-1",
        storagePath: "user-1/generations/videos/video-1.mp4",
        fileType: "video/mp4",
        posterVariantPath: "user-1/variants/videos/media-1/poster_720.jpg",
        filename: "clip.mp4",
      },
    ]);
  });
});

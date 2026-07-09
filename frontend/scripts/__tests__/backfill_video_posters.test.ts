import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertApplyTargetConfirmed,
  fetchCandidates,
  inferSupabaseProjectIdFromUrl,
  normalizeCandidateRow,
  parseArgs,
  processCandidate,
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
      "--confirm-project-id",
      "bgdhqbenqltxildlgkyu",
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
    expect(args.confirmProjectId).toBe("bgdhqbenqltxildlgkyu");
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

  it("infers and enforces the active Supabase project id for apply mode", () => {
    expect(inferSupabaseProjectIdFromUrl("https://bgdhqbenqltxildlgkyu.supabase.co/rest/v1/")).toBe(
      "bgdhqbenqltxildlgkyu"
    );

    expect(() =>
      assertApplyTargetConfirmed({
        apply: true,
        confirmProjectId: null,
        actualProjectId: "bgdhqbenqltxildlgkyu",
      })
    ).toThrow(/--confirm-project-id bgdhqbenqltxildlgkyu/i);

    expect(() =>
      assertApplyTargetConfirmed({
        apply: true,
        confirmProjectId: "wrong-project",
        actualProjectId: "bgdhqbenqltxildlgkyu",
      })
    ).toThrow(/does not match active project/i);
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

  it("uploads generated poster variants with durable cache-control", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shortpulse-poster-test-"));
    const fakeFfmpegPath = path.join(tempDir, "fake-ffmpeg.mjs");
    const onePixelJpeg =
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGwP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCcf/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8BP//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8BP//Z";
    await fs.writeFile(
      fakeFfmpegPath,
      [
        "#!/usr/bin/env node",
        "import fs from 'node:fs';",
        `const jpeg = Buffer.from('${onePixelJpeg}', 'base64');`,
        "const outputPath = process.argv.at(-1);",
        "fs.writeFileSync(outputPath, jpeg);",
      ].join("\n"),
      { mode: 0o755 }
    );

    const uploads: Array<{ path: string; options: Record<string, unknown> }> = [];
    const variants: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    const supabase = {
      storage: {
        from(bucket: string) {
          expect(bucket).toBe("media_library");
          return {
            download: async () => ({
              data: Buffer.from("source-video"),
              error: null,
            }),
            upload: async (
              storagePath: string,
              _body: Buffer,
              options: Record<string, unknown>
            ) => {
              uploads.push({ path: storagePath, options });
              return { error: null };
            },
          };
        },
      },
      from(table: string) {
        if (table === "media_asset_variants") {
          return {
            select() {
              const query = {
                eq() {
                  return query;
                },
                limit() {
                  return {
                    maybeSingle: async () => ({
                      data: null,
                      error: null,
                    }),
                  };
                },
              };
              return query;
            },
            upsert(payload: Record<string, unknown>) {
              variants.push(payload);
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "media_files") {
          return {
            update(payload: { poster_variant_path: string }) {
              return {
                eq(field: string, value: string) {
                  const scoped = { ...payload, [field]: value };
                  return {
                    eq(nextField: string, nextValue: string) {
                      updates.push({ ...scoped, [nextField]: nextValue });
                      return Promise.resolve({ error: null });
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    };

    try {
      await expect(
        processCandidate({
          supabase,
          candidate: {
            id: "media-11",
            userId: "user-11",
            storagePath: "user-11/generations/videos/source.mp4",
          },
          ffmpegPath: fakeFfmpegPath,
          seekSeconds: 0.5,
          timeoutMs: 5000,
        })
      ).resolves.toEqual({
        id: "media-11",
        status: "backfilled",
        posterPath: "user-11/variants/videos/media-11/poster_720.jpg",
      });

      expect(uploads).toHaveLength(1);
      expect(uploads[0]?.options).toMatchObject({
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      });
      expect(variants[0]).toMatchObject({
        media_file_id: "media-11",
        storage_path: "user-11/variants/videos/media-11/poster_720.jpg",
        byte_size: Buffer.from(onePixelJpeg, "base64").byteLength,
      });
      expect(updates[0]).toMatchObject({
        poster_variant_path: "user-11/variants/videos/media-11/poster_720.jpg",
        id: "media-11",
        user_id: "user-11",
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

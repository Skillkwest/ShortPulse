import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertApplyTargetConfirmed,
  formatProcessError,
  inferSupabaseProjectIdFromUrl,
  normalizeCandidateRow,
  parseArgs,
  processCandidate,
  resolvePreviewStoragePath,
} from "../backfill_video_previews.mjs";

type VariantLookupQuery = {
  eq: () => VariantLookupQuery;
  limit: () => {
    maybeSingle: () => Promise<{
      data: { storage_path: string } | null;
      error: null;
    }>;
  };
};

type MediaFilesUpdate = {
  preview_variant_path: string;
  id: string;
  user_id: string;
};

describe("backfill_video_previews", () => {
  it("parses dry-run defaults", () => {
    const args = parseArgs(["node", "backfill_video_previews.mjs"]);

    expect(args.apply).toBe(false);
    expect(args.limit).toBe(25);
    expect(args.seekSeconds).toBe(0.5);
    expect(args.previewSeconds).toBe(3);
    expect(args.ffmpegPath).toBe("ffmpeg");
  });

  it("parses apply mode and scoped filters", () => {
    const args = parseArgs([
      "node",
      "backfill_video_previews.mjs",
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
      "--preview-seconds",
      "4.5",
      "--ffmpeg-path",
      "/opt/bin/ffmpeg",
    ]);

    expect(args.apply).toBe(true);
    expect(args.limit).toBe(7);
    expect(args.mediaFileId).toBe("11111111-1111-4111-8111-111111111111");
    expect(args.confirmProjectId).toBe("bgdhqbenqltxildlgkyu");
    expect(args.userId).toBe("22222222-2222-4222-8222-222222222222");
    expect(args.seekSeconds).toBe(1.25);
    expect(args.previewSeconds).toBe(4.5);
    expect(args.ffmpegPath).toBe("/opt/bin/ffmpeg");
  });

  it("rejects invalid user-id filters", () => {
    expect(() =>
      parseArgs(["node", "backfill_video_previews.mjs", "--user-id", "not-a-uuid"])
    ).toThrow(/--user-id/i);
  });

  it("normalizes valid video candidates only", () => {
    expect(
      normalizeCandidateRow({
        id: "media-1",
        user_id: "user-1",
        storage_path: "user-1/generations/videos/video-1.mp4",
        file_type: "video/mp4",
        preview_variant_path: null,
        filename: "clip.mp4",
      })
    ).toEqual({
      id: "media-1",
      userId: "user-1",
      storagePath: "user-1/generations/videos/video-1.mp4",
      storageScopeOk: true,
      fileType: "video/mp4",
      previewVariantPath: null,
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

  it("flags unscoped candidate storage paths", () => {
    expect(
      normalizeCandidateRow({
        id: "media-3",
        user_id: "user-3",
        storage_path: "someone-else/generations/videos/video-3.mp4",
        file_type: "video/mp4",
      })
    ).toEqual({
      id: "media-3",
      userId: "user-3",
      storagePath: "someone-else/generations/videos/video-3.mp4",
      storageScopeOk: false,
      fileType: "video/mp4",
      previewVariantPath: null,
      filename: null,
    });
  });

  it("builds deterministic preview storage paths", () => {
    expect(
      resolvePreviewStoragePath({
        userId: "user-7",
        mediaFileId: "media-7",
      })
    ).toBe("user-7/variants/videos/media-7/preview_loop_360p.mp4");
  });

  it("formats structured storage response errors", async () => {
    const response = new Response(JSON.stringify({ message: "Object not found" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    });

    await expect(
      formatProcessError({
        message: "{}",
        originalError: response,
      })
    ).resolves.toBe("Object not found");
  });

  it("infers the active Supabase project id from the configured URL", () => {
    expect(inferSupabaseProjectIdFromUrl("https://bgdhqbenqltxildlgkyu.supabase.co/rest/v1/")).toBe(
      "bgdhqbenqltxildlgkyu"
    );
  });

  it("rejects apply mode when the confirmed project id is missing or mismatched", () => {
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

  it("resyncs an existing ready variant before classifying a row as missing_source", async () => {
    const updates: MediaFilesUpdate[] = [];
    const supabase = {
      from(table: string) {
        if (table === "media_asset_variants") {
          return {
            select() {
              const query: VariantLookupQuery = {
                eq() {
                  return query;
                },
                limit() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        storage_path: "user-9/variants/videos/media-9/preview_loop_360p.mp4",
                      },
                      error: null,
                    }),
                  };
                },
              };
              return query;
            },
          };
        }
        if (table === "media_files") {
          return {
            update(payload: { preview_variant_path: string }) {
              return {
                eq(field: string, value: string) {
                  const scoped = { ...payload, [field]: value };
                  return {
                    eq(nextField: string, nextValue: string) {
                      updates.push({ ...scoped, [nextField]: nextValue } as MediaFilesUpdate);
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

    await expect(
      processCandidate({
        supabase,
        candidate: {
          id: "media-9",
          userId: "user-9",
          storagePath: "user-9/generations/videos/source.mp4",
          storageScopeOk: true,
          sourceStatus: "missing",
        },
        ffmpegPath: "ffmpeg",
        seekSeconds: 0.5,
        previewSeconds: 3,
        timeoutMs: 5000,
      })
    ).resolves.toEqual({
      id: "media-9",
      status: "synced_existing_variant",
      previewPath: "user-9/variants/videos/media-9/preview_loop_360p.mp4",
    });

    expect(updates).toEqual([
      {
        preview_variant_path: "user-9/variants/videos/media-9/preview_loop_360p.mp4",
        id: "media-9",
        user_id: "user-9",
      },
    ]);
  });

  it("classifies missing-source rows only after confirming no ready variant exists", async () => {
    const supabase = {
      from(table: string) {
        if (table === "media_asset_variants") {
          return {
            select() {
              const query: VariantLookupQuery = {
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
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    };

    await expect(
      processCandidate({
        supabase,
        candidate: {
          id: "media-10",
          userId: "user-10",
          storagePath: "user-10/generations/videos/source.mp4",
          storageScopeOk: true,
          sourceStatus: "missing",
        },
        ffmpegPath: "ffmpeg",
        seekSeconds: 0.5,
        previewSeconds: 3,
        timeoutMs: 5000,
      })
    ).resolves.toEqual({
      id: "media-10",
      status: "missing_source",
      error: "Object not found",
    });
  });

  it("uploads generated preview variants with durable cache-control", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shortpulse-preview-test-"));
    const fakeFfmpegPath = path.join(tempDir, "fake-ffmpeg.mjs");
    await fs.writeFile(
      fakeFfmpegPath,
      [
        "#!/usr/bin/env node",
        "import fs from 'node:fs';",
        "const outputPath = process.argv.at(-1);",
        "fs.writeFileSync(outputPath, Buffer.from('preview-bytes'));",
      ].join("\n"),
      { mode: 0o755 }
    );

    const uploads: Array<{ path: string; options: Record<string, unknown> }> = [];
    const variants: Array<Record<string, unknown>> = [];
    const updates: MediaFilesUpdate[] = [];
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
              const query: VariantLookupQuery = {
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
            update(payload: { preview_variant_path: string }) {
              return {
                eq(field: string, value: string) {
                  const scoped = { ...payload, [field]: value };
                  return {
                    eq(nextField: string, nextValue: string) {
                      updates.push({ ...scoped, [nextField]: nextValue } as MediaFilesUpdate);
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
            storageScopeOk: true,
            sourceStatus: "available",
          },
          ffmpegPath: fakeFfmpegPath,
          seekSeconds: 0.5,
          previewSeconds: 3,
          timeoutMs: 5000,
        })
      ).resolves.toEqual({
        id: "media-11",
        status: "backfilled",
        previewPath: "user-11/variants/videos/media-11/preview_loop_360p.mp4",
      });

      expect(uploads).toHaveLength(1);
      expect(uploads[0]?.options).toMatchObject({
        contentType: "video/mp4",
        upsert: true,
        cacheControl: "31536000",
      });
      expect(variants[0]).toMatchObject({
        media_file_id: "media-11",
        storage_path: "user-11/variants/videos/media-11/preview_loop_360p.mp4",
        byte_size: "preview-bytes".length,
      });
      expect(updates[0]).toMatchObject({
        preview_variant_path: "user-11/variants/videos/media-11/preview_loop_360p.mp4",
        id: "media-11",
        user_id: "user-11",
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

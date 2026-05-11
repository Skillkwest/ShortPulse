import { describe, expect, it } from "vitest";
import {
  buildMarkdownReport,
  buildListRequestBody,
  buildProbeWarnings,
  collectProbeIdsFromRows,
  collectProbePathsFromRows,
  parseArgs,
  resolveSurfacePreset,
} from "../media_library_phase0_bundle.mjs";

describe("media_library_phase0_bundle", () => {
  it("parses defaults", () => {
    const args = parseArgs([]);

    expect(args.runProbe).toBe(false);
    expect(args.surface).toBe("media-library-panel");
    expect(args.mediaKind).toBe("all");
    expect(args.profile).toBe("expanded");
    expect(args.samples).toBe(6);
    expect(args.warmup).toBe(2);
  });

  it("resolves known presets", () => {
    expect(resolveSurfacePreset("panel")).toEqual({
      surface: "media-library-panel",
      mediaKind: "all",
      profile: "expanded",
    });
    expect(resolveSurfacePreset("images")).toEqual({
      surface: "media-library-panel",
      mediaKind: "images",
      profile: "minimal",
    });
    expect(resolveSurfacePreset("missing")).toBeNull();
  });

  it("parses probe and explicit options", () => {
    const args = parseArgs([
      "--run-probe",
      "--base-url",
      "https://example.com",
      "--token",
      "abc",
      "--surface",
      "media-library-route",
      "--media-kind",
      "images",
      "--profile",
      "minimal",
      "--samples",
      "4",
      "--warmup",
      "1",
      "--timeout-ms",
      "5000",
      "--no-write",
    ]);

    expect(args.runProbe).toBe(true);
    expect(args.baseUrl).toBe("https://example.com");
    expect(args.token).toBe("abc");
    expect(args.surface).toBe("media-library-route");
    expect(args.mediaKind).toBe("images");
    expect(args.profile).toBe("minimal");
    expect(args.samples).toBe(4);
    expect(args.warmup).toBe(1);
    expect(args.timeoutMs).toBe(5000);
    expect(args.writeFile).toBe(false);
  });

  it("applies presets before explicit overrides", () => {
    const args = parseArgs(["--preset", "route", "--media-kind", "videos"]);

    expect(args.preset).toBe("route");
    expect(args.surface).toBe("media-library-route");
    expect(args.mediaKind).toBe("videos");
    expect(args.profile).toBe("expanded");
  });

  it("builds list requests with current surface defaults", () => {
    expect(
      buildListRequestBody({
        surface: "media-library-panel",
        mediaKind: "all",
        profile: "expanded",
        limit: 0,
      })
    ).toMatchObject({
      surface: "media-library-panel",
      mediaKind: "all",
      profile: "expanded",
      limit: 36,
      includeLibraryTotalCount: true,
    });

    expect(
      buildListRequestBody({
        surface: "media-library-route",
        mediaKind: "all",
        profile: "expanded",
        limit: 0,
      })
    ).toMatchObject({
      limit: 60,
      includeLibraryTotalCount: false,
    });
  });

  it("derives canonical probe paths and ids from mixed rows", () => {
    const rows = [
      {
        id: "img-1",
        file_type: "image/png",
        thumb_variant_path: "user-1/variants/images/img-1/thumb.jpg",
        storage_path: "user-1/uploads/images/img-1.png",
      },
      {
        id: "vid-1",
        file_type: "video/mp4",
        poster_variant_path: "user-1/variants/videos/vid-1/poster.jpg",
        preview_variant_path: "user-1/variants/videos/vid-1/hover.mp4",
        storage_path: "user-1/uploads/videos/vid-1.mp4",
      },
      {
        id: "vid-2",
        file_type: "video/mp4",
        preview_variant_path: "user-1/variants/videos/vid-2/hover.mp4",
        storage_path: "user-1/uploads/videos/vid-2.mp4",
      },
      {
        id: "aud-1",
        file_type: "audio/mpeg",
        storage_path: "user-1/uploads/audio/aud-1.mp3",
      },
    ];

    expect(collectProbePathsFromRows(rows)).toEqual([
      "user-1/variants/images/img-1/thumb.jpg",
      "user-1/variants/videos/vid-1/poster.jpg",
      "user-1/variants/videos/vid-2/hover.mp4",
      "user-1/uploads/audio/aud-1.mp3",
    ]);
    expect(collectProbeIdsFromRows(rows)).toEqual(["img-1", "vid-1", "vid-2", "aud-1"]);
  });

  it("warns when the probe baseline is weak", () => {
    expect(
      buildProbeWarnings({
        sampleRowCount: 0,
        samplePathCount: 0,
        sampleIdCount: 0,
        results: [
          {
            label: "POST /api/media/list",
            allOk: false,
          },
        ],
      })
    ).toHaveLength(4);
  });

  it("builds markdown with live probe results", () => {
    const markdown = buildMarkdownReport({
      args: parseArgs([]),
      probe: {
        sampleRowCount: 12,
        samplePathCount: 6,
        sampleIdCount: 5,
        results: [
          {
            label: "POST /api/media/list",
            samples: 6,
            p50Ms: 45.2,
            p95Ms: 67.8,
            minMs: 40.1,
            maxMs: 70.5,
            statusSummary: "200:6",
          },
        ],
      },
    });

    expect(markdown).toContain("# Media Library Phase 0 Bundle");
    expect(markdown).toContain("POST /api/media/list");
    expect(markdown).toContain("Sample rows observed: 12");
    expect(markdown).toContain("Suggested Next Commands");
  });
});

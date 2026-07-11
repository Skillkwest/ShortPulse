import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";

vi.mock("../../../logic/referenceGridMedia", async () => {
  const actual = await vi.importActual<typeof import("../../../logic/referenceGridMedia")>(
    "../../../logic/referenceGridMedia"
  );
  return {
    ...actual,
    resolveReferenceCardUrls: vi.fn(actual.resolveReferenceCardUrls),
  };
});

import { resolveReferenceCardUrls } from "../../../logic/referenceGridMedia";
import {
  REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT,
  useReferenceGridResolvedMediaController,
} from "../useReferenceGridResolvedMediaController";
import { projectReferenceGridMediaOutput } from "../../logic/referenceGridMediaOutput";

const createImageOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "image",
    previewStoragePath: "https://cdn.example.com/preview.jpg",
    fullStoragePath: "https://cdn.example.com/full.jpg",
    previewUrl: null,
    resultUrls: null,
  }) as unknown as StudioOutput;

describe("useReferenceGridResolvedMediaController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses cached media resolution for repeated output and surface requests", () => {
    const output = createImageOutput("out-1");
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    const first = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });
    const second = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("keeps cache entries separated by surface and target edge", () => {
    const output = createImageOutput("out-1");
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });
    result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "quick-slot",
      cardLongEdgePx: 512,
    });
    result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "quick-slot",
      cardLongEdgePx: 384,
    });

    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(3);
  });

  it("evicts least recently used resolved media entries when the cache reaches its cap", () => {
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );
    const resolveOutput = (id: string) =>
      result.current.resolveCardMedia({
        item: projectReferenceGridMediaOutput(createImageOutput(id)),
        mediaSurface: "reference-grid",
        cardLongEdgePx: 512,
      });

    for (let index = 0; index < REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT; index += 1) {
      resolveOutput(`out-${index}`);
    }
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(
      REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT
    );

    const firstResolvedMedia = resolveOutput("out-0");
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(
      REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT
    );

    resolveOutput(`out-${REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT}`);
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(
      REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT + 1
    );

    expect(resolveOutput("out-0")).toBe(firstResolvedMedia);
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(
      REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT + 1
    );

    resolveOutput("out-1");
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(
      REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT + 2
    );
  });

  it("keeps weak generated outputs previewable without upgrading fallback authority", () => {
    const output = {
      ...createImageOutput("out-generated-weak"),
      mediaSource: "generated",
      generationId: undefined,
      savedMediaIds: [],
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: "https://provider.example.com/generated-preview.png",
      resultUrls: ["https://provider.example.com/generated-full.png"],
    } as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.authorityTier).toBe("preview-only");
    expect(resolved.previewUrl).toBe("https://provider.example.com/generated-preview.png");
    expect(resolved.fullUrl).toBeNull();
    expect(resolved.fallbackUrl).toBe("https://provider.example.com/generated-preview.png");
  });

  it("trusts canonical resolved card urls before raw generated fallback fields", () => {
    vi.mocked(resolveReferenceCardUrls).mockReturnValueOnce({
      previewUrl: "https://storage.example.com/generated-preview.png",
      fullUrl: "https://storage.example.com/generated-full.png",
      authorityTier: "tracked",
      previewQualityBand: "high",
      targetLongEdgePx: 960,
    });

    const output = {
      ...createImageOutput("out-generated-tracked"),
      mediaSource: "generated",
      generationId: "gen-1",
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: "https://provider.example.com/generated-preview.png",
      resultUrls: ["https://provider.example.com/generated-full.png"],
    } as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.previewUrl).toBe("https://storage.example.com/generated-preview.png");
    expect(resolved.fullUrl).toBe("https://storage.example.com/generated-full.png");
    expect(resolved.fallbackUrl).toBe("https://storage.example.com/generated-full.png");
  });

  it("uses signed preview storage urls with signed full storage fallback for restored image cards", () => {
    const output = {
      ...createImageOutput("out-restored-storage-only"),
      mediaSource: "generated",
      generationId: "gen-1",
      previewStoragePath: "user-1/variants/images/gen-1/preview.webp",
      fullStoragePath: "user-1/generations/images/gen-1.png",
      previewUrl: undefined,
      resultUrls: undefined,
    } as unknown as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
        signedStorageUrlByPath: new Map([
          [
            "user-1/variants/images/gen-1/preview.webp",
            "https://signed.shortpulse.test/gen-1-preview.webp",
          ],
          ["user-1/generations/images/gen-1.png", "https://signed.shortpulse.test/gen-1-full.png"],
        ]),
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.previewUrl).toBe("https://signed.shortpulse.test/gen-1-preview.webp");
    expect(resolved.fullUrl).toBe("https://signed.shortpulse.test/gen-1-full.png");
    expect(resolved.fallbackUrl).toBe("https://signed.shortpulse.test/gen-1-full.png");
    expect(resolved.isImagePreview).toBe(true);
  });

  it("keeps resolved-media cache entries when signed storage map identity changes with the same urls", () => {
    const output = {
      ...createImageOutput("out-restored-storage-stable-map"),
      mediaSource: "generated",
      generationId: "gen-stable-map-1",
      previewStoragePath: "user-1/variants/images/gen-stable-map-1/preview.webp",
      fullStoragePath: "user-1/generations/images/gen-stable-map-1.png",
      previewUrl: undefined,
      resultUrls: undefined,
    } as unknown as StudioOutput;
    const signedStorageEntries: Array<[string, string]> = [
      [
        "user-1/variants/images/gen-stable-map-1/preview.webp",
        "https://signed.shortpulse.test/gen-stable-map-1-preview.webp",
      ],
      [
        "user-1/generations/images/gen-stable-map-1.png",
        "https://signed.shortpulse.test/gen-stable-map-1-full.png",
      ],
    ];
    const { result, rerender } = renderHook(
      ({ signedStorageUrlByPath }: { signedStorageUrlByPath: ReadonlyMap<string, string> }) =>
        useReferenceGridResolvedMediaController({
          previewQualityPressureLevel: 0,
          strictPreviewLadder: true,
          adaptivePreviewRoutingEnabled: true,
          signedStorageUrlByPath,
        }),
      {
        initialProps: {
          signedStorageUrlByPath: new Map(signedStorageEntries),
        },
      }
    );
    const item = projectReferenceGridMediaOutput(output);

    const first = result.current.resolveCardMedia({
      item,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });
    rerender({
      signedStorageUrlByPath: new Map(signedStorageEntries),
    });
    const second = result.current.resolveCardMedia({
      item,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(second).toBe(first);
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(1);
  });

  it("recomputes resolved media when signed storage url values change", () => {
    const output = {
      ...createImageOutput("out-restored-storage-refreshed-url"),
      mediaSource: "generated",
      generationId: "gen-refreshed-url-1",
      previewStoragePath: "user-1/variants/images/gen-refreshed-url-1/preview.webp",
      fullStoragePath: "user-1/generations/images/gen-refreshed-url-1.png",
      previewUrl: undefined,
      resultUrls: undefined,
    } as unknown as StudioOutput;
    const { result, rerender } = renderHook(
      ({ signedStorageUrlByPath }: { signedStorageUrlByPath: ReadonlyMap<string, string> }) =>
        useReferenceGridResolvedMediaController({
          previewQualityPressureLevel: 0,
          strictPreviewLadder: true,
          adaptivePreviewRoutingEnabled: true,
          signedStorageUrlByPath,
        }),
      {
        initialProps: {
          signedStorageUrlByPath: new Map([
            [
              "user-1/variants/images/gen-refreshed-url-1/preview.webp",
              "https://signed.shortpulse.test/gen-refreshed-url-1-preview-v1.webp",
            ],
            [
              "user-1/generations/images/gen-refreshed-url-1.png",
              "https://signed.shortpulse.test/gen-refreshed-url-1-full-v1.png",
            ],
          ]),
        },
      }
    );
    const item = projectReferenceGridMediaOutput(output);

    const first = result.current.resolveCardMedia({
      item,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });
    rerender({
      signedStorageUrlByPath: new Map([
        [
          "user-1/variants/images/gen-refreshed-url-1/preview.webp",
          "https://signed.shortpulse.test/gen-refreshed-url-1-preview-v2.webp",
        ],
        [
          "user-1/generations/images/gen-refreshed-url-1.png",
          "https://signed.shortpulse.test/gen-refreshed-url-1-full-v2.png",
        ],
      ]),
    });
    const second = result.current.resolveCardMedia({
      item,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(second).not.toBe(first);
    expect(second.previewUrl).toBe(
      "https://signed.shortpulse.test/gen-refreshed-url-1-preview-v2.webp"
    );
    expect(second.fullUrl).toBe("https://signed.shortpulse.test/gen-refreshed-url-1-full-v2.png");
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(2);
  });

  it("returns signed audio companion art for generated audio backgrounds", () => {
    const output = {
      id: "audio-1",
      prompt: "Launch voiceover",
      mode: "audio",
      aspect: "1:1",
      model: "Voiceover",
      status: "ready",
      timestamp: "Just now",
      taskState: "success",
      mediaSource: "generated",
      generationId: "audio-1",
      previewStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
      fullStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
      resultUrls: undefined,
      companionArtUrl: null,
      companionArtStoragePath: "user-1/generations/audio/audio-1/companion-art/cover.webp",
      companionArtStatus: "ready",
    } as unknown as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
        signedStorageUrlByPath: new Map([
          [
            "user-1/generations/audio/audio-1/companion-art/cover.webp",
            "https://signed.shortpulse.test/audio-cover.webp",
          ],
        ]),
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 320,
    });

    expect(resolved.companionArtUrl).toBe("https://signed.shortpulse.test/audio-cover.webp");
  });

  it("uses the same signed full fallback ladder for quick-slot image cards", () => {
    const output = {
      ...createImageOutput("out-restored-quick-slot-storage-only"),
      mediaSource: "generated",
      generationId: "gen-quick-slot-1",
      previewStoragePath: "user-1/variants/images/gen-quick-slot-1/preview.webp",
      fullStoragePath: "user-1/generations/images/gen-quick-slot-1.png",
      previewUrl: undefined,
      resultUrls: undefined,
    } as unknown as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
        signedStorageUrlByPath: new Map([
          [
            "user-1/variants/images/gen-quick-slot-1/preview.webp",
            "https://signed.shortpulse.test/gen-quick-slot-1-preview.webp",
          ],
          [
            "user-1/generations/images/gen-quick-slot-1.png",
            "https://signed.shortpulse.test/gen-quick-slot-1-full.png",
          ],
        ]),
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "quick-slot",
      cardLongEdgePx: 384,
    });

    expect(resolved.previewUrl).toBe(
      "https://signed.shortpulse.test/gen-quick-slot-1-preview.webp"
    );
    expect(resolved.fullUrl).toBe("https://signed.shortpulse.test/gen-quick-slot-1-full.png");
    expect(resolved.fallbackUrl).toBe("https://signed.shortpulse.test/gen-quick-slot-1-full.png");
    expect(resolved.isImagePreview).toBe(true);
  });

  it("uses signed poster urls with signed playable fallback for restored video cards", () => {
    const output = {
      id: "out-restored-video-storage-only",
      mode: "video",
      mediaSource: "generated",
      generationId: "gen-video-1",
      previewStoragePath: null,
      previewPosterStoragePath: "user-1/variants/videos/gen-video-1/poster.webp",
      fullStoragePath: "user-1/generations/videos/gen-video-1.mp4",
      previewUrl: undefined,
      previewPosterUrl: undefined,
      resultUrls: undefined,
    } as unknown as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
        signedStorageUrlByPath: new Map([
          [
            "user-1/variants/videos/gen-video-1/poster.webp",
            "https://signed.shortpulse.test/gen-video-1-poster.webp",
          ],
          [
            "user-1/generations/videos/gen-video-1.mp4",
            "https://signed.shortpulse.test/gen-video-1-full.mp4",
          ],
        ]),
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.previewUrl).toBe("https://signed.shortpulse.test/gen-video-1-poster.webp");
    expect(resolved.posterPreviewUrl).toBe(
      "https://signed.shortpulse.test/gen-video-1-poster.webp"
    );
    expect(resolved.fullUrl).toBe("https://signed.shortpulse.test/gen-video-1-full.mp4");
    expect(resolved.playableMediaUrl).toBe("https://signed.shortpulse.test/gen-video-1-full.mp4");
    expect(resolved.fallbackUrl).toBe("https://signed.shortpulse.test/gen-video-1-full.mp4");
    expect(resolved.isVideoPreview).toBe(true);
  });

  it("keeps a distinct compact video preview separate from full playback authority", () => {
    const output = {
      id: "out-video-preview-loop",
      mode: "video",
      mediaSource: "generated",
      generationId: "gen-video-preview-loop",
      previewStoragePath: "user-1/variants/videos/gen-video-preview-loop/preview_loop_360p.mp4",
      previewPosterStoragePath: "user-1/variants/videos/gen-video-preview-loop/poster.webp",
      fullStoragePath: "user-1/generations/videos/gen-video-preview-loop.mp4",
      previewUrl: "https://signed.shortpulse.test/video-preview-loop.mp4",
      previewPosterUrl: "https://signed.shortpulse.test/video-preview-poster.webp",
      resultUrls: ["https://signed.shortpulse.test/video-full.mp4"],
    } as unknown as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.cardPlayablePreviewUrl).toBe(
      "https://signed.shortpulse.test/video-preview-loop.mp4"
    );
    expect(resolved.playableMediaUrl).toBe("https://signed.shortpulse.test/video-full.mp4");
  });

  it("uses recovered signed media-id authority for saved-media-only image cards", () => {
    const output = {
      ...createImageOutput("out-saved-media-only"),
      mediaSource: "library",
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: undefined,
      resultUrls: [],
      savedMediaIds: ["saved-media-1"],
    } as unknown as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
        signedMediaAuthorityByMediaId: new Map([
          [
            "saved-media-1",
            {
              mediaId: "saved-media-1",
              fileType: "image/png",
              previewStoragePath: "user-1/variants/images/saved-media-1/thumb.webp",
              fullStoragePath: "user-1/generations/images/saved-media-1.png",
              previewPosterStoragePath: null,
              signedPreviewUrl: "https://signed.shortpulse.test/saved-preview.webp",
              signedFullUrl: "https://signed.shortpulse.test/saved-full.png",
              signedPreviewPosterUrl: null,
            },
          ],
        ]),
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.authorityTier).toBe("reusable");
    expect(resolved.previewUrl).toBe("https://signed.shortpulse.test/saved-preview.webp");
    expect(resolved.fullUrl).toBe("https://signed.shortpulse.test/saved-full.png");
    expect(resolved.isImagePreview).toBe(true);
  });

  it("keeps resolved-media cache entries when signed media authority map identity changes with the same urls", () => {
    const output = {
      ...createImageOutput("out-saved-media-stable-map"),
      mediaSource: "library",
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: undefined,
      resultUrls: [],
      savedMediaIds: ["saved-media-stable-map-1"],
    } as unknown as StudioOutput;
    const signedMediaAuthorityEntries: Array<
      [
        string,
        {
          mediaId: string;
          fileType: string;
          previewStoragePath: string;
          fullStoragePath: string;
          previewPosterStoragePath: null;
          signedPreviewUrl: string;
          signedFullUrl: string;
          signedPreviewPosterUrl: null;
        },
      ]
    > = [
      [
        "saved-media-stable-map-1",
        {
          mediaId: "saved-media-stable-map-1",
          fileType: "image/png",
          previewStoragePath: "user-1/variants/images/saved-media-stable-map-1/thumb.webp",
          fullStoragePath: "user-1/generations/images/saved-media-stable-map-1.png",
          previewPosterStoragePath: null,
          signedPreviewUrl: "https://signed.shortpulse.test/saved-stable-preview.webp",
          signedFullUrl: "https://signed.shortpulse.test/saved-stable-full.png",
          signedPreviewPosterUrl: null,
        },
      ],
    ];
    const { result, rerender } = renderHook(
      ({
        signedMediaAuthorityByMediaId,
      }: {
        signedMediaAuthorityByMediaId: ReadonlyMap<
          string,
          (typeof signedMediaAuthorityEntries)[number][1]
        >;
      }) =>
        useReferenceGridResolvedMediaController({
          previewQualityPressureLevel: 0,
          strictPreviewLadder: true,
          adaptivePreviewRoutingEnabled: true,
          signedMediaAuthorityByMediaId,
        }),
      {
        initialProps: {
          signedMediaAuthorityByMediaId: new Map(signedMediaAuthorityEntries),
        },
      }
    );
    const item = projectReferenceGridMediaOutput(output);

    const first = result.current.resolveCardMedia({
      item,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });
    rerender({
      signedMediaAuthorityByMediaId: new Map(signedMediaAuthorityEntries),
    });
    const second = result.current.resolveCardMedia({
      item,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(second).toBe(first);
    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(1);
  });

  it("prefers recovered thumbnail authority over stale original-path previews", () => {
    const output = {
      ...createImageOutput("out-saved-media-stale-preview"),
      mediaSource: "library",
      previewStoragePath: "user-1/generations/images/saved-media-1.png",
      fullStoragePath: "user-1/generations/images/saved-media-1.png",
      previewUrl: "https://signed.shortpulse.test/old-original.png",
      resultUrls: ["https://signed.shortpulse.test/old-original.png"],
      savedMediaIds: ["saved-media-1"],
    } as unknown as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
        signedMediaAuthorityByMediaId: new Map([
          [
            "saved-media-1",
            {
              mediaId: "saved-media-1",
              fileType: "image/png",
              previewStoragePath: "user-1/variants/images/saved-media-1/thumb.webp",
              fullStoragePath: "user-1/generations/images/saved-media-1.png",
              previewPosterStoragePath: null,
              signedPreviewUrl: "https://signed.shortpulse.test/saved-thumb.webp",
              signedFullUrl: "https://signed.shortpulse.test/saved-full.png",
              signedPreviewPosterUrl: null,
            },
          ],
        ]),
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: projectReferenceGridMediaOutput(output),
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.authorityTier).toBe("reusable");
    expect(resolved.previewUrl).toBe("https://signed.shortpulse.test/saved-thumb.webp");
    expect(resolved.fullUrl).toBe("https://signed.shortpulse.test/saved-full.png");
    expect(resolved.fallbackUrl).toBe("https://signed.shortpulse.test/saved-full.png");
    expect(resolved.isImagePreview).toBe(true);
  });
});

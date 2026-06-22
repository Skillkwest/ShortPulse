import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferenceGridMediaOutput } from "../../logic/referenceGridMediaOutput";

vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));
vi.mock("../../../logic/sessionRestoreMediaSigning", () => ({
  resolveSessionRestoreSignedMediaAuthorityByMediaId: vi.fn(),
}));

import { getSignedMediaUrlsBatch } from "../../../../../lib/mediaSignedUrlCache";
import { resolveSessionRestoreSignedMediaAuthorityByMediaId } from "../../../logic/sessionRestoreMediaSigning";
import {
  applySignedMediaAuthorityToReferenceGridMediaOutput,
  applySignedStorageUrlsToReferenceGridMediaOutput,
  collectReferenceGridSavedMediaIdsForSigning,
  collectReferenceGridStoragePaths,
  useReferenceGridSignedStorageUrlController,
} from "../useReferenceGridSignedStorageUrlController";

const createStorageBackedImage = (
  overrides: Partial<ReferenceGridMediaOutput> = {}
): ReferenceGridMediaOutput => ({
  id: "image-1",
  mode: "image",
  mediaSource: "generated",
  previewText: undefined,
  previewUrl: undefined,
  previewPosterUrl: undefined,
  previewPosterStoragePath: undefined,
  localObjectUrl: undefined,
  previewStoragePath: "user-1/variants/images/image-1/preview.webp",
  fullStoragePath: "user-1/generations/images/image-1.png",
  resultUrls: undefined,
  generationId: "gen-1",
  savedMediaIds: [],
  isPlaceholderOnly: false,
  ...overrides,
});

describe("useReferenceGridSignedStorageUrlController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSignedMediaUrlsBatch).mockResolvedValue(
      new Map([
        [
          "user-1/variants/images/image-1/preview.webp",
          "https://signed.shortpulse.test/preview.webp",
        ],
        [
          "user-1/variants/videos/video-1/poster.webp",
          "https://signed.shortpulse.test/video-poster.webp",
        ],
        [
          "user-1/generations/audio/audio-1/companion-art/cover.webp",
          "https://signed.shortpulse.test/audio-cover.webp",
        ],
        ["user-1/generations/images/image-1.png", "https://signed.shortpulse.test/full.png"],
        ["user-1/results/image-1.png", "https://signed.shortpulse.test/result.png"],
      ])
    );
    vi.mocked(resolveSessionRestoreSignedMediaAuthorityByMediaId).mockResolvedValue(new Map());
  });

  it("collects a bounded preview-first fallback ladder for card rendering", () => {
    const paths = collectReferenceGridStoragePaths([
      createStorageBackedImage({
        previewStoragePath: "/user-1/variants/images/image-1/preview.webp",
        resultUrls: ["https://provider.example.com/transient.png", "user-1/results/image-1.png"],
      }),
    ]);

    expect(paths).toEqual([
      "user-1/variants/images/image-1/preview.webp",
      "user-1/generations/images/image-1.png",
      "user-1/results/image-1.png",
    ]);
  });

  it("collects full-authority storage paths when explicitly requested", () => {
    const paths = collectReferenceGridStoragePaths(
      [
        createStorageBackedImage({
          previewStoragePath: "/user-1/variants/images/image-1/preview.webp",
          resultUrls: ["https://provider.example.com/transient.png", "user-1/results/image-1.png"],
        }),
      ],
      { signingMode: "full-authority" }
    );

    expect(paths).toEqual([
      "user-1/variants/images/image-1/preview.webp",
      "user-1/generations/images/image-1.png",
      "user-1/results/image-1.png",
    ]);
  });

  it("uses full and result storage paths for default card rendering when preview paths are absent", () => {
    expect(
      collectReferenceGridStoragePaths([
        createStorageBackedImage({
          previewStoragePath: undefined,
          previewPosterStoragePath: undefined,
          resultUrls: ["https://provider.example.com/transient.png", "user-1/results/image-1.png"],
        }),
      ])
    ).toEqual(["user-1/generations/images/image-1.png", "user-1/results/image-1.png"]);

    expect(
      collectReferenceGridStoragePaths([
        createStorageBackedImage({
          previewStoragePath: undefined,
          previewPosterStoragePath: undefined,
          resultUrls: undefined,
        }),
      ])
    ).toEqual(["user-1/generations/images/image-1.png"]);
  });

  it("collects audio companion-art storage paths for generated reference backgrounds", () => {
    const paths = collectReferenceGridStoragePaths([
      createStorageBackedImage({
        id: "audio-1",
        mode: "audio",
        previewStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
        fullStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
        resultUrls: ["user-1/generations/audio/audio-1/audio.mp3"],
        companionArtStoragePath: "user-1/generations/audio/audio-1/companion-art/cover.webp",
      }),
    ]);

    expect(paths).toEqual([
      "user-1/generations/audio/audio-1/audio.mp3",
      "user-1/generations/audio/audio-1/companion-art/cover.webp",
    ]);
  });

  it("collects saved media ids for media-row authority even when storage paths exist", () => {
    expect(
      collectReferenceGridSavedMediaIdsForSigning([
        createStorageBackedImage({
          previewStoragePath: null,
          fullStoragePath: null,
          resultUrls: [],
          savedMediaIds: ["saved-media-1"],
        }),
        createStorageBackedImage({
          id: "duplicate",
          previewStoragePath: null,
          fullStoragePath: null,
          resultUrls: [],
          savedMediaIds: ["saved-media-1"],
        }),
        createStorageBackedImage({
          id: "already-storage-backed",
          savedMediaIds: ["saved-media-2"],
        }),
      ])
    ).toEqual(["saved-media-1", "saved-media-2"]);
  });

  it("signs visible reference-grid storage paths through the shared media signing cache", async () => {
    const output = createStorageBackedImage();
    const { result } = renderHook(() =>
      useReferenceGridSignedStorageUrlController({
        outputs: [output],
      })
    );

    await waitFor(() => {
      expect(result.current.signedStorageUrlByPath.get(output.previewStoragePath ?? "")).toBe(
        "https://signed.shortpulse.test/preview.webp"
      );
    });

    expect(getSignedMediaUrlsBatch).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: [
        "user-1/variants/images/image-1/preview.webp",
        "user-1/generations/images/image-1.png",
      ],
      surface: "reference-grid",
      queryMode: "default",
    });
  });

  it("exposes pending signing state only while storage signing is active", async () => {
    let resolveBatch: (value: Map<string, string>) => void = () => undefined;
    vi.mocked(getSignedMediaUrlsBatch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      })
    );
    const output = createStorageBackedImage();
    const { result } = renderHook(() =>
      useReferenceGridSignedStorageUrlController({
        outputs: [output],
      })
    );

    await waitFor(() => {
      expect(result.current.signingPendingStoragePathSet.has(output.previewStoragePath ?? "")).toBe(
        true
      );
    });

    resolveBatch(
      new Map([
        [
          "user-1/variants/images/image-1/preview.webp",
          "https://signed.shortpulse.test/preview.webp",
        ],
      ])
    );

    await waitFor(() => {
      expect(result.current.signingPendingStoragePathSet.size).toBe(0);
      expect(result.current.signedStorageUrlByPath.get(output.previewStoragePath ?? "")).toBe(
        "https://signed.shortpulse.test/preview.webp"
      );
    });
  });

  it("defers storage signing while background visual work is suspended", async () => {
    const output = createStorageBackedImage();
    const { rerender, result } = renderHook(
      ({ suspendSigningRequests }: { suspendSigningRequests: boolean }) =>
        useReferenceGridSignedStorageUrlController({
          outputs: [output],
          suspendSigningRequests,
        }),
      {
        initialProps: {
          suspendSigningRequests: true,
        },
      }
    );

    expect(getSignedMediaUrlsBatch).not.toHaveBeenCalled();
    expect(result.current.signingPendingStoragePathSet.size).toBe(0);
    expect(result.current.signedStorageUrlByPath.size).toBe(0);

    rerender({ suspendSigningRequests: false });

    await waitFor(() => {
      expect(getSignedMediaUrlsBatch).toHaveBeenCalledTimes(1);
      expect(result.current.signedStorageUrlByPath.get(output.previewStoragePath ?? "")).toBe(
        "https://signed.shortpulse.test/preview.webp"
      );
    });
  });

  it("preserves existing signed urls while suspended and resumes signing new paths afterward", async () => {
    const initialOutput = createStorageBackedImage();
    const nextOutput = createStorageBackedImage({
      id: "image-2",
      previewStoragePath: "user-1/variants/images/image-2/preview.webp",
      fullStoragePath: "user-1/generations/images/image-2.png",
      generationId: "gen-2",
    });
    const { rerender, result } = renderHook(
      ({
        outputs,
        suspendSigningRequests,
      }: {
        outputs: ReferenceGridMediaOutput[];
        suspendSigningRequests: boolean;
      }) =>
        useReferenceGridSignedStorageUrlController({
          outputs,
          suspendSigningRequests,
        }),
      {
        initialProps: {
          outputs: [initialOutput],
          suspendSigningRequests: false,
        },
      }
    );

    await waitFor(() => {
      expect(
        result.current.signedStorageUrlByPath.get(initialOutput.previewStoragePath ?? "")
      ).toBe("https://signed.shortpulse.test/preview.webp");
    });
    vi.mocked(getSignedMediaUrlsBatch).mockResolvedValueOnce(
      new Map([
        [
          "user-1/variants/images/image-2/preview.webp",
          "https://signed.shortpulse.test/image-2-preview.webp",
        ],
      ])
    );

    rerender({
      outputs: [nextOutput],
      suspendSigningRequests: true,
    });

    expect(result.current.signedStorageUrlByPath.get(initialOutput.previewStoragePath ?? "")).toBe(
      "https://signed.shortpulse.test/preview.webp"
    );
    expect(getSignedMediaUrlsBatch).toHaveBeenCalledTimes(1);

    rerender({
      outputs: [nextOutput],
      suspendSigningRequests: false,
    });

    await waitFor(() => {
      expect(getSignedMediaUrlsBatch).toHaveBeenCalledTimes(2);
      expect(result.current.signedStorageUrlByPath.get(nextOutput.previewStoragePath ?? "")).toBe(
        "https://signed.shortpulse.test/image-2-preview.webp"
      );
    });
  });

  it("does not mark already signed storage paths pending during refreshes", async () => {
    const initialOutput = createStorageBackedImage();
    const nextOutput = createStorageBackedImage({
      id: "image-2",
      previewStoragePath: "user-1/variants/images/image-2/preview.webp",
      fullStoragePath: "user-1/generations/images/image-2.png",
      generationId: "gen-2",
    });
    const { rerender, result } = renderHook(
      ({ outputs }: { outputs: ReferenceGridMediaOutput[] }) =>
        useReferenceGridSignedStorageUrlController({
          outputs,
        }),
      {
        initialProps: {
          outputs: [initialOutput],
        },
      }
    );

    await waitFor(() => {
      expect(
        result.current.signedStorageUrlByPath.get(initialOutput.previewStoragePath ?? "")
      ).toBe("https://signed.shortpulse.test/preview.webp");
    });

    let resolveBatch: (value: Map<string, string>) => void = () => undefined;
    vi.mocked(getSignedMediaUrlsBatch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      })
    );

    rerender({
      outputs: [initialOutput, nextOutput],
    });

    await waitFor(() => {
      expect(
        result.current.signingPendingStoragePathSet.has(initialOutput.previewStoragePath ?? "")
      ).toBe(false);
      expect(
        result.current.signingPendingStoragePathSet.has(initialOutput.fullStoragePath ?? "")
      ).toBe(false);
      expect(
        result.current.signingPendingStoragePathSet.has(nextOutput.previewStoragePath ?? "")
      ).toBe(true);
    });

    resolveBatch(
      new Map([
        [
          "user-1/variants/images/image-2/preview.webp",
          "https://signed.shortpulse.test/image-2-preview.webp",
        ],
        [
          "user-1/generations/images/image-2.png",
          "https://signed.shortpulse.test/image-2-full.png",
        ],
      ])
    );

    await waitFor(() => {
      expect(result.current.signingPendingStoragePathSet.size).toBe(0);
      expect(result.current.signedStorageUrlByPath.get(nextOutput.previewStoragePath ?? "")).toBe(
        "https://signed.shortpulse.test/image-2-preview.webp"
      );
    });
  });

  it("clears pending signing state when storage signing fails", async () => {
    vi.mocked(getSignedMediaUrlsBatch).mockRejectedValueOnce(new Error("signing failed"));
    const output = createStorageBackedImage();
    const { result } = renderHook(() =>
      useReferenceGridSignedStorageUrlController({
        outputs: [output],
      })
    );

    await waitFor(() => {
      expect(getSignedMediaUrlsBatch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.signingPendingStoragePathSet.size).toBe(0);
    });
  });

  it("recovers signed media authority from saved media ids when storage paths are absent", async () => {
    vi.mocked(resolveSessionRestoreSignedMediaAuthorityByMediaId).mockResolvedValue(
      new Map([
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
      ])
    );

    const output = createStorageBackedImage({
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      savedMediaIds: ["saved-media-1"],
    });
    const { result } = renderHook(() =>
      useReferenceGridSignedStorageUrlController({
        outputs: [output],
      })
    );

    await waitFor(() => {
      expect(
        result.current.signedMediaAuthorityByMediaId.get("saved-media-1")?.signedPreviewUrl
      ).toBe("https://signed.shortpulse.test/saved-preview.webp");
    });

    expect(resolveSessionRestoreSignedMediaAuthorityByMediaId).toHaveBeenCalledWith([
      "saved-media-1",
    ]);
  });

  it("defers saved media authority signing while background visual work is suspended", async () => {
    const output = createStorageBackedImage({
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      savedMediaIds: ["saved-media-1"],
    });
    const { rerender, result } = renderHook(
      ({ suspendSigningRequests }: { suspendSigningRequests: boolean }) =>
        useReferenceGridSignedStorageUrlController({
          outputs: [output],
          suspendSigningRequests,
        }),
      {
        initialProps: {
          suspendSigningRequests: true,
        },
      }
    );

    expect(resolveSessionRestoreSignedMediaAuthorityByMediaId).not.toHaveBeenCalled();

    vi.mocked(resolveSessionRestoreSignedMediaAuthorityByMediaId).mockResolvedValueOnce(
      new Map([
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
      ])
    );

    rerender({ suspendSigningRequests: false });

    await waitFor(() => {
      expect(
        result.current.signedMediaAuthorityByMediaId.get("saved-media-1")?.signedPreviewUrl
      ).toBe("https://signed.shortpulse.test/saved-preview.webp");
    });
  });

  it("keeps saved media authority signing failures contained", async () => {
    vi.mocked(resolveSessionRestoreSignedMediaAuthorityByMediaId).mockRejectedValueOnce(
      new Error("authority signing failed")
    );
    const output = createStorageBackedImage({
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      savedMediaIds: ["saved-media-1"],
    });
    const { result } = renderHook(() =>
      useReferenceGridSignedStorageUrlController({
        outputs: [output],
      })
    );

    await waitFor(() => {
      expect(resolveSessionRestoreSignedMediaAuthorityByMediaId).toHaveBeenCalledWith([
        "saved-media-1",
      ]);
    });

    await waitFor(() => {
      expect(result.current.signedMediaAuthorityByMediaId.size).toBe(0);
    });
  });

  it("does not re-sign equivalent storage path sets when output array identity changes", async () => {
    const { rerender } = renderHook(
      ({ outputs }: { outputs: ReferenceGridMediaOutput[] }) =>
        useReferenceGridSignedStorageUrlController({
          outputs,
        }),
      {
        initialProps: {
          outputs: [createStorageBackedImage()],
        },
      }
    );

    await waitFor(() => {
      expect(getSignedMediaUrlsBatch).toHaveBeenCalledTimes(1);
    });

    rerender({
      outputs: [
        createStorageBackedImage({
          id: "image-1",
        }),
      ],
    });

    expect(getSignedMediaUrlsBatch).toHaveBeenCalledTimes(1);
  });

  it("projects signed storage urls into render fields while preserving durable storage paths", () => {
    const output = createStorageBackedImage();
    const projected = applySignedStorageUrlsToReferenceGridMediaOutput(
      output,
      new Map([
        [
          "user-1/variants/images/image-1/preview.webp",
          "https://signed.shortpulse.test/preview.webp",
        ],
        ["user-1/generations/images/image-1.png", "https://signed.shortpulse.test/full.png"],
      ])
    );

    expect(output.previewStoragePath).toBe("user-1/variants/images/image-1/preview.webp");
    expect(projected.previewStoragePath).toBe("user-1/variants/images/image-1/preview.webp");
    expect(output.fullStoragePath).toBe("user-1/generations/images/image-1.png");
    expect(projected.fullStoragePath).toBe("user-1/generations/images/image-1.png");
    expect(projected.previewUrl).toBe("https://signed.shortpulse.test/preview.webp");
    expect(projected.resultUrls).toEqual(["https://signed.shortpulse.test/full.png"]);
  });

  it("projects signed full storage when preview signing returns no url", () => {
    const output = createStorageBackedImage({
      previewUrl: undefined,
      resultUrls: undefined,
    });
    const projected = applySignedStorageUrlsToReferenceGridMediaOutput(
      output,
      new Map([
        ["user-1/generations/images/image-1.png", "https://signed.shortpulse.test/full.png"],
      ])
    );

    expect(projected.previewUrl).toBeUndefined();
    expect(projected.resultUrls).toEqual(["https://signed.shortpulse.test/full.png"]);
  });

  it("projects signed companion-art storage into generated audio background url", () => {
    const output = createStorageBackedImage({
      id: "audio-1",
      mode: "audio",
      previewStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
      fullStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
      resultUrls: ["user-1/generations/audio/audio-1/audio.mp3"],
      companionArtUrl: null,
      companionArtStoragePath: "user-1/generations/audio/audio-1/companion-art/cover.webp",
      companionArtStatus: "ready",
    });
    const projected = applySignedStorageUrlsToReferenceGridMediaOutput(
      output,
      new Map([
        [
          "user-1/generations/audio/audio-1/companion-art/cover.webp",
          "https://signed.shortpulse.test/audio-cover.webp",
        ],
      ])
    );

    expect(projected.companionArtStoragePath).toBe(
      "user-1/generations/audio/audio-1/companion-art/cover.webp"
    );
    expect(projected.companionArtUrl).toBe("https://signed.shortpulse.test/audio-cover.webp");
  });

  it("projects signed media-id authority into render fields while recovering durable paths", () => {
    const output = createStorageBackedImage({
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      savedMediaIds: ["saved-media-1"],
    });
    const projected = applySignedMediaAuthorityToReferenceGridMediaOutput(
      output,
      new Map([
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
      ])
    );

    expect(projected.previewUrl).toBe("https://signed.shortpulse.test/saved-preview.webp");
    expect(projected.previewStoragePath).toBe("user-1/variants/images/saved-media-1/thumb.webp");
    expect(projected.fullStoragePath).toBe("user-1/generations/images/saved-media-1.png");
    expect(projected.resultUrls).toEqual(["https://signed.shortpulse.test/saved-full.png"]);
  });

  it("lets recovered media-id authority replace stale original preview paths with thumbnails", () => {
    const output = createStorageBackedImage({
      id: "saved-original-preview",
      previewStoragePath: "user-1/generations/images/saved-media-1.png",
      fullStoragePath: "user-1/generations/images/saved-media-1.png",
      previewUrl: "https://signed.shortpulse.test/old-original.png",
      resultUrls: ["https://signed.shortpulse.test/old-original.png"],
      savedMediaIds: ["saved-media-1"],
    });
    const projected = applySignedMediaAuthorityToReferenceGridMediaOutput(
      output,
      new Map([
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
      ])
    );

    expect(projected.previewStoragePath).toBe("user-1/variants/images/saved-media-1/thumb.webp");
    expect(projected.previewUrl).toBe("https://signed.shortpulse.test/saved-thumb.webp");
    expect(projected.fullStoragePath).toBe("user-1/generations/images/saved-media-1.png");
    expect(projected.resultUrls).toEqual([
      "https://signed.shortpulse.test/saved-full.png",
      "https://signed.shortpulse.test/old-original.png",
    ]);
  });

  it("projects signed video poster storage into previewPosterUrl without using it as full media", () => {
    const output = createStorageBackedImage({
      id: "video-1",
      mode: "video",
      previewStoragePath: "user-1/variants/videos/video-1/preview-loop.mp4",
      previewPosterStoragePath: "user-1/variants/videos/video-1/poster.webp",
      fullStoragePath: "user-1/generations/videos/video-1/full.mp4",
      previewUrl: undefined,
      previewPosterUrl: undefined,
      resultUrls: undefined,
    });
    const projected = applySignedStorageUrlsToReferenceGridMediaOutput(
      output,
      new Map([
        [
          "user-1/variants/videos/video-1/poster.webp",
          "https://signed.shortpulse.test/video-poster.webp",
        ],
        [
          "user-1/generations/videos/video-1/full.mp4",
          "https://signed.shortpulse.test/video-full.mp4",
        ],
      ])
    );

    expect(projected.previewPosterUrl).toBe("https://signed.shortpulse.test/video-poster.webp");
    expect(projected.fullStoragePath).toBe("user-1/generations/videos/video-1/full.mp4");
    expect(projected.resultUrls).toEqual(["https://signed.shortpulse.test/video-full.mp4"]);
    expect(projected.previewPosterUrl).not.toBe(projected.fullStoragePath);
  });
});

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
        ["user-1/generations/images/image-1.png", "https://signed.shortpulse.test/full.png"],
        ["user-1/results/image-1.png", "https://signed.shortpulse.test/result.png"],
      ])
    );
    vi.mocked(resolveSessionRestoreSignedMediaAuthorityByMediaId).mockResolvedValue(new Map());
  });

  it("collects preview storage paths for card rendering without collecting eager full media", () => {
    const paths = collectReferenceGridStoragePaths([
      createStorageBackedImage({
        previewStoragePath: "/user-1/variants/images/image-1/preview.webp",
        resultUrls: ["https://provider.example.com/transient.png", "user-1/results/image-1.png"],
      }),
    ]);

    expect(paths).toEqual(["user-1/variants/images/image-1/preview.webp"]);
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

  it("collects saved media ids when storage paths are absent", () => {
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
    ).toEqual(["saved-media-1"]);
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
      storagePaths: ["user-1/variants/images/image-1/preview.webp"],
      surface: "reference-grid",
      queryMode: "default",
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

  it("projects signed storage urls into a transient renderable media view", () => {
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
    expect(projected.previewStoragePath).toBe("https://signed.shortpulse.test/preview.webp");
    expect(output.fullStoragePath).toBe("user-1/generations/images/image-1.png");
    expect(projected.fullStoragePath).toBe("https://signed.shortpulse.test/full.png");
    expect(projected.previewUrl).toBe("https://signed.shortpulse.test/preview.webp");
    expect(projected.resultUrls).toEqual(["https://signed.shortpulse.test/full.png"]);
  });

  it("projects signed media-id authority into a transient renderable media view", () => {
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
    expect(projected.fullStoragePath).toBe("https://signed.shortpulse.test/saved-full.png");
    expect(projected.resultUrls).toEqual(["https://signed.shortpulse.test/saved-full.png"]);
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
    expect(projected.fullStoragePath).toBe("https://signed.shortpulse.test/video-full.mp4");
    expect(projected.resultUrls).toEqual(["https://signed.shortpulse.test/video-full.mp4"]);
    expect(projected.previewPosterUrl).not.toBe(projected.fullStoragePath);
  });
});

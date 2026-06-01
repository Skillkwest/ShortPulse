import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferenceGridMediaOutput } from "../../logic/referenceGridMediaOutput";

vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));

import { getSignedMediaUrlsBatch } from "../../../../../lib/mediaSignedUrlCache";
import {
  applySignedStorageUrlsToReferenceGridMediaOutput,
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
        ["user-1/generations/images/image-1.png", "https://signed.shortpulse.test/full.png"],
        ["user-1/results/image-1.png", "https://signed.shortpulse.test/result.png"],
      ])
    );
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

  it("does not collect full or result storage paths for default card rendering", () => {
    expect(
      collectReferenceGridStoragePaths([
        createStorageBackedImage({
          previewStoragePath: undefined,
          previewPosterStoragePath: undefined,
          resultUrls: ["https://provider.example.com/transient.png", "user-1/results/image-1.png"],
        }),
      ])
    ).toEqual([]);

    expect(
      collectReferenceGridStoragePaths([
        createStorageBackedImage({
          previewStoragePath: undefined,
          previewPosterStoragePath: undefined,
          resultUrls: undefined,
        }),
      ])
    ).toEqual([]);
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
});

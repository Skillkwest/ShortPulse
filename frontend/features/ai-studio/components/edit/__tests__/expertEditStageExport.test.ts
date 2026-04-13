import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportExpertEditStageArtifacts } from "../expertEditStageExport";

const composePrimaryStageLayersToBlobMock = vi.fn();
const composeFlattenedMarkupReferenceBlobMock = vi.fn();
const isMarkupStrokeSecondaryReferenceEnabledMock = vi.fn();

vi.mock("../../../logic/expertEditStageFlatten", () => ({
  composePrimaryStageLayersToBlob: (...args: unknown[]) =>
    composePrimaryStageLayersToBlobMock(...args),
}));

vi.mock("../../../logic/expertEditMarkupReference", () => ({
  composeFlattenedMarkupReferenceBlob: (...args: unknown[]) =>
    composeFlattenedMarkupReferenceBlobMock(...args),
}));

vi.mock("../../../logic/inpaintSubmission", () => ({
  isMarkupStrokeSecondaryReferenceEnabled: () => isMarkupStrokeSecondaryReferenceEnabledMock(),
}));

describe("exportExpertEditStageArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    composePrimaryStageLayersToBlobMock.mockResolvedValue(
      new Blob(["flattened"], { type: "image/png" })
    );
    composeFlattenedMarkupReferenceBlobMock.mockResolvedValue(
      new Blob(["markup"], { type: "image/png" })
    );
    isMarkupStrokeSecondaryReferenceEnabledMock.mockReturnValue(false);
  });

  it("reuses a durable primary source url for standard mode and skips flatten export", async () => {
    const exportSelectedLayerMaskBlob = vi.fn(async () => null);
    const resolveBlobDimensions = vi.fn(async () => ({ width: 1024, height: 1024 }));

    const result = await exportExpertEditStageArtifacts({
      layers: [{ id: "layer-1" } as never],
      reusablePrimarySourceUrl: " https://cdn.test/reusable-primary.png ",
      markupStrokes: [],
      editSubmitIntent: "standard",
      hasSelectedLayerMask: false,
      exportSelectedLayerMaskBlob,
      resolveBlobDimensions,
      resolveStageFlattenSnapshot: vi.fn(() => ({ outputAspectRatio: 1 })),
    });

    expect(result).toEqual({
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
      flattenedBlob: null,
      flattenedMarkupReferenceBlob: null,
      inpaintMaskBlob: null,
    });
    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    expect(resolveBlobDimensions).not.toHaveBeenCalled();
    expect(exportSelectedLayerMaskBlob).not.toHaveBeenCalled();
  });

  it("exports flattened and markup reference blobs for markup mode when the feature flag is enabled", async () => {
    isMarkupStrokeSecondaryReferenceEnabledMock.mockReturnValue(true);
    const resolveBlobDimensions = vi.fn(async () => ({ width: 1024, height: 1024 }));

    const result = await exportExpertEditStageArtifacts({
      layers: [{ id: "layer-1" } as never],
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
      markupStrokes: [{ id: "stroke-1" } as never],
      editSubmitIntent: "markup",
      hasSelectedLayerMask: false,
      exportSelectedLayerMaskBlob: vi.fn(async () => null),
      resolveBlobDimensions,
      resolveStageFlattenSnapshot: vi.fn(() => ({ outputAspectRatio: 1.5 })),
    });

    expect(result.reusablePrimarySourceUrl).toBeNull();
    expect(result.flattenedBlob).toBeInstanceOf(Blob);
    expect(result.flattenedMarkupReferenceBlob).toBeInstanceOf(Blob);
    expect(result.inpaintMaskBlob).toBeNull();
    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledWith(
      [{ id: "layer-1" }],
      expect.objectContaining({
        mimeType: "image/png",
        outputAspectRatio: 1.5,
      })
    );
    expect(composeFlattenedMarkupReferenceBlobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flattenedBlob: expect.any(Blob),
        markupStrokes: [{ id: "stroke-1" }],
        resolveBlobDimensions,
      })
    );
  });

  it("exports an inpaint mask using the flattened blob dimensions", async () => {
    const exportSelectedLayerMaskBlob = vi.fn(
      async () => new Blob(["mask"], { type: "image/png" })
    );
    const resolveBlobDimensions = vi.fn(async () => ({ width: 640, height: 512 }));

    const result = await exportExpertEditStageArtifacts({
      layers: [{ id: "layer-1" } as never],
      reusablePrimarySourceUrl: null,
      markupStrokes: [],
      editSubmitIntent: "inpaint",
      hasSelectedLayerMask: true,
      exportSelectedLayerMaskBlob,
      resolveBlobDimensions,
      resolveStageFlattenSnapshot: vi.fn(() => ({ outputAspectRatio: 1 })),
    });

    expect(result.reusablePrimarySourceUrl).toBeNull();
    expect(result.flattenedBlob).toBeInstanceOf(Blob);
    expect(result.inpaintMaskBlob).toBeInstanceOf(Blob);
    expect(exportSelectedLayerMaskBlob).toHaveBeenCalledWith({
      targetWidth: 640,
      targetHeight: 512,
      mimeType: "image/png",
    });
  });
});

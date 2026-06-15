import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportExpertEditStageArtifacts } from "../expertEditStageExport";

const composePrimaryStageLayersToBlobMock = vi.fn();
const composeFlattenedMarkupReferenceBlobMock = vi.fn();

vi.mock("../../../logic/expertEditStageFlatten", () => ({
  composePrimaryStageLayersToBlob: (...args: unknown[]) =>
    composePrimaryStageLayersToBlobMock(...args),
}));

vi.mock("../../../logic/expertEditMarkupReference", () => ({
  composeFlattenedMarkupReferenceBlob: (...args: unknown[]) =>
    composeFlattenedMarkupReferenceBlobMock(...args),
}));

vi.mock("../../../logic/inpaintSubmission", () => ({
  isMarkupStrokeSecondaryReferenceEnabled: () => true,
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
  });

  it("reuses a durable primary source url for standard mode and skips flatten export", async () => {
    const exportSelectedLayerMaskBlob = vi.fn(async () => null);
    const resolveBlobDimensions = vi.fn(async () => ({ width: 1024, height: 1024 }));

    const result = await exportExpertEditStageArtifacts({
      layers: [
        {
          id: "layer-1",
          imageUrl: "https://cdn.test/reusable-primary.png",
          opacity: 1,
          transform: {
            translateXRatio: 0,
            translateYRatio: 0,
            scale: 1,
            rotationDeg: 0,
          },
        } as never,
      ],
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
      flattenedDimensions: null,
    });
    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    expect(resolveBlobDimensions).not.toHaveBeenCalled();
    expect(exportSelectedLayerMaskBlob).not.toHaveBeenCalled();
  });

  it("disables durable source reuse when the visible stage framing changed", async () => {
    const exportSelectedLayerMaskBlob = vi.fn(async () => null);
    const resolveBlobDimensions = vi.fn(async () => ({ width: 1024, height: 1024 }));

    const result = await exportExpertEditStageArtifacts({
      layers: [{ id: "layer-1" } as never],
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
      flattenTargetLongestEdgePx: 2048,
      markupStrokes: [],
      editSubmitIntent: "standard",
      hasSelectedLayerMask: false,
      exportSelectedLayerMaskBlob,
      resolveBlobDimensions,
      resolveStageFlattenSnapshot: vi.fn(() => ({
        outputAspectRatio: 1,
        canReusePrimarySourceUrl: false,
        camera: {
          scale: 1.4,
          offsetX: 60,
          offsetY: -20,
          viewportWidth: 400,
          viewportHeight: 400,
        },
      })),
    });

    expect(result.reusablePrimarySourceUrl).toBeNull();
    expect(result.flattenedBlob).toBeInstanceOf(Blob);
    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledWith(
      [{ id: "layer-1" }],
      expect.objectContaining({
        mimeType: "image/png",
        outputAspectRatio: 1,
        camera: {
          scale: 1.4,
          offsetX: 60,
          offsetY: -20,
          viewportWidth: 400,
          viewportHeight: 400,
        },
        maxOutputSizePx: 2048,
      })
    );
  });

  it("disables durable source reuse when the single visible layer was resized", async () => {
    const exportSelectedLayerMaskBlob = vi.fn(async () => null);
    const resolveBlobDimensions = vi.fn(async () => ({ width: 1024, height: 1024 }));

    const transformedLayer = {
      id: "layer-1",
      imageUrl: "https://cdn.test/reusable-primary.png",
      opacity: 1,
      transform: {
        translateXRatio: 0,
        translateYRatio: 0,
        scale: 1.35,
        rotationDeg: 0,
      },
    } as never;

    const result = await exportExpertEditStageArtifacts({
      layers: [transformedLayer],
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
      flattenTargetLongestEdgePx: 2048,
      markupStrokes: [],
      editSubmitIntent: "standard",
      hasSelectedLayerMask: false,
      exportSelectedLayerMaskBlob,
      resolveBlobDimensions,
      resolveStageFlattenSnapshot: vi.fn(() => ({
        outputAspectRatio: 1,
        canReusePrimarySourceUrl: true,
      })),
    });

    expect(result.reusablePrimarySourceUrl).toBeNull();
    expect(result.flattenedBlob).toBeInstanceOf(Blob);
    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledWith(
      [transformedLayer],
      expect.objectContaining({
        mimeType: "image/png",
        outputAspectRatio: 1,
        maxOutputSizePx: 2048,
      })
    );
  });

  it("disables durable source reuse when multiple visible layers are present", async () => {
    const exportSelectedLayerMaskBlob = vi.fn(async () => null);
    const resolveBlobDimensions = vi.fn(async () => ({ width: 1024, height: 1024 }));
    const layers = [
      {
        id: "layer-1",
        imageUrl: "https://cdn.test/reusable-primary.png",
        opacity: 1,
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
      {
        id: "layer-2",
        imageUrl: "https://cdn.test/overlay.png",
        opacity: 1,
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
    ] as never;

    const result = await exportExpertEditStageArtifacts({
      layers,
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
      flattenTargetLongestEdgePx: 2048,
      markupStrokes: [],
      editSubmitIntent: "standard",
      hasSelectedLayerMask: false,
      exportSelectedLayerMaskBlob,
      resolveBlobDimensions,
      resolveStageFlattenSnapshot: vi.fn(() => ({
        outputAspectRatio: 1,
        canReusePrimarySourceUrl: true,
      })),
    });

    expect(result.reusablePrimarySourceUrl).toBeNull();
    expect(result.flattenedBlob).toBeInstanceOf(Blob);
    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledWith(
      layers,
      expect.objectContaining({
        mimeType: "image/png",
        outputAspectRatio: 1,
        maxOutputSizePx: 2048,
      })
    );
  });

  it("exports flattened and markup reference blobs for markup mode", async () => {
    const resolveBlobDimensions = vi.fn(async () => ({ width: 1024, height: 1024 }));

    const result = await exportExpertEditStageArtifacts({
      layers: [{ id: "layer-1" } as never],
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
      flattenTargetLongestEdgePx: 2048,
      markupStrokes: [{ id: "stroke-1" } as never],
      editSubmitIntent: "markup",
      hasSelectedLayerMask: false,
      exportSelectedLayerMaskBlob: vi.fn(async () => null),
      resolveBlobDimensions,
      resolveStageFlattenSnapshot: vi.fn(() => ({
        outputAspectRatio: 1.5,
        camera: {
          scale: 1.2,
          offsetX: 32,
          offsetY: -18,
          viewportWidth: 640,
          viewportHeight: 480,
        },
      })),
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
        camera: {
          scale: 1.2,
          offsetX: 32,
          offsetY: -18,
          viewportWidth: 640,
          viewportHeight: 480,
        },
        maxOutputSizePx: null,
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
      resolveStageFlattenSnapshot: vi.fn(() => ({
        outputAspectRatio: 1,
        camera: {
          scale: 1.6,
          offsetX: 24,
          offsetY: -12,
          viewportWidth: 320,
          viewportHeight: 256,
        },
      })),
    });

    expect(result.reusablePrimarySourceUrl).toBeNull();
    expect(result.flattenedBlob).toBeInstanceOf(Blob);
    expect(result.inpaintMaskBlob).toBeInstanceOf(Blob);
    expect(exportSelectedLayerMaskBlob).toHaveBeenCalledWith({
      targetWidth: 640,
      targetHeight: 512,
      mimeType: "image/png",
      camera: {
        scale: 1.6,
        offsetX: 24,
        offsetY: -12,
        viewportWidth: 320,
        viewportHeight: 256,
      },
    });
  });
});

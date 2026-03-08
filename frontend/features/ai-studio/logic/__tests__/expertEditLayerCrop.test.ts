/**
 * Unit tests for Expert Edit crop geometry and stage-accurate crop composition.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExpertEditLayerStageDrawPlan,
  clampCropRectToStage,
  composeExpertEditLayerCropToBlob,
  parseAspectRatioToken,
  resolveCenteredAspectCropRect,
} from "../expertEditLayerCrop";

describe("expertEditLayerCrop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses valid aspect ratio tokens and rejects invalid values", () => {
    expect(parseAspectRatioToken("1:1")).toBe(1);
    expect(parseAspectRatioToken("16:9")).toBeCloseTo(16 / 9, 6);
    expect(parseAspectRatioToken("9:16")).toBeCloseTo(9 / 16, 6);
    expect(parseAspectRatioToken("bad")).toBeNull();
    expect(parseAspectRatioToken("16:0")).toBeNull();
    expect(parseAspectRatioToken(null)).toBeNull();
  });

  it("resolves a centered max-fit rect for common aspect ratios", () => {
    expect(
      resolveCenteredAspectCropRect({
        stageWidth: 1000,
        stageHeight: 1000,
        aspectRatio: 1,
      })
    ).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
    expect(
      resolveCenteredAspectCropRect({
        stageWidth: 1000,
        stageHeight: 1000,
        aspectRatio: 16 / 9,
      })
    ).toEqual({
      x: 0,
      y: 218.75,
      width: 1000,
      height: 562.5,
    });
    expect(
      resolveCenteredAspectCropRect({
        stageWidth: 1000,
        stageHeight: 1000,
        aspectRatio: 9 / 16,
      })
    ).toEqual({
      x: 218.75,
      y: 0,
      width: 562.5,
      height: 1000,
    });
  });

  it("builds stage draw plan with contain-fit and transform mapping", () => {
    expect(
      buildExpertEditLayerStageDrawPlan({
        imageWidth: 2000,
        imageHeight: 1000,
        stageWidth: 1000,
        stageHeight: 1000,
        transform: {
          translateXRatio: 0.25,
          translateYRatio: -0.1,
          scale: 3,
          rotationDeg: 22,
        },
      })
    ).toEqual({
      drawWidth: 1000,
      drawHeight: 500,
      translateX: 250,
      translateY: -100,
      scale: 2,
      rotationDeg: 22,
    });
  });

  it("clamps crop window to stage bounds and rejects degenerate windows", () => {
    expect(
      clampCropRectToStage({
        cropRect: { x: -15, y: 8.2, width: 140.3, height: 120.7 },
        stageWidth: 100,
        stageHeight: 90,
      })
    ).toEqual({
      sx: 0,
      sy: 8,
      sw: 100,
      sh: 82,
    });
    expect(
      clampCropRectToStage({
        cropRect: { x: 200, y: 10, width: 50, height: 40 },
        stageWidth: 100,
        stageHeight: 90,
      })
    ).toBeNull();
  });

  it("composes stage crop as PNG and maps source window to output canvas", async () => {
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToBlob = HTMLCanvasElement.prototype.toBlob;
    const stageContext = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    };
    const outputContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    let contextCall = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => {
        contextCall += 1;
        return (contextCall % 2 === 1
          ? stageContext
          : outputContext) as unknown as CanvasRenderingContext2D;
      }),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: vi.fn((callback: BlobCallback, mimeType?: string | null) => {
        callback(new Blob(["cropped"], { type: mimeType ?? "image/png" }));
      }),
    });

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      width = 0;
      height = 0;

      set src(value: string) {
        if (!value.includes("layer")) {
          this.onerror?.();
          return;
        }
        this.naturalWidth = 800;
        this.naturalHeight = 600;
        this.width = 800;
        this.height = 600;
        this.onload?.();
      }
    }

    const originalImage = globalThis.Image;
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    try {
      const blob = await composeExpertEditLayerCropToBlob({
        imageUrl: "https://example.com/layer.png",
        stageWidth: 1000,
        stageHeight: 1000,
        cropRect: {
          x: 0,
          y: 218.75,
          width: 1000,
          height: 562.5,
        },
        transform: {
          translateXRatio: 0.1,
          translateYRatio: 0,
          scale: 1,
          rotationDeg: 0,
        },
      });
      expect(blob.type).toBe("image/png");
      expect(stageContext.drawImage).toHaveBeenCalledTimes(1);
      expect(outputContext.drawImage).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        0,
        218,
        1000,
        564,
        0,
        0,
        1000,
        564
      );
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
        configurable: true,
        value: originalCanvasToBlob,
      });
    }
  });
});

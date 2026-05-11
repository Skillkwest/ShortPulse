/**
 * Unit tests for Expert Edit stage flatten helpers.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPERT_EDIT_CAMERA_SCALE_MIN } from "../expertEditCameraContract";
import {
  STAGE_FLATTEN_MAX_OUTPUT_SIZE_PX,
  buildStageFlattenDrawPlan,
  composePrimaryStageLayersToBlob,
  resolveContainSizeForStage,
  resolveStageFlattenCameraTransform,
  resolveStageFlattenOutputDimensions,
  resolveStageFlattenOutputSizePx,
} from "../expertEditStageFlatten";

describe("expertEditStageFlatten", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves longest-edge output size with clamp", () => {
    expect(
      resolveStageFlattenOutputSizePx([
        { width: 640, height: 1024 },
        { width: 512, height: 512 },
      ])
    ).toBe(1024);
    expect(
      resolveStageFlattenOutputSizePx([
        { width: 9000, height: 1000 },
        { width: 1200, height: 1200 },
      ])
    ).toBe(STAGE_FLATTEN_MAX_OUTPUT_SIZE_PX);
    expect(resolveStageFlattenOutputSizePx([])).toBe(1);
  });

  it("resolves output dimensions from aspect ratio", () => {
    expect(
      resolveStageFlattenOutputDimensions({
        images: [{ width: 1000, height: 600 }],
        outputAspectRatio: 16 / 9,
      })
    ).toEqual({ width: 1000, height: 563 });
    expect(
      resolveStageFlattenOutputDimensions({
        images: [{ width: 1000, height: 600 }],
        outputAspectRatio: 9 / 16,
      })
    ).toEqual({ width: 563, height: 1000 });
    expect(
      resolveStageFlattenOutputDimensions({
        images: [{ width: 1000, height: 600 }],
      })
    ).toEqual({ width: 1000, height: 1000 });
  });

  it("contains non-square layers inside arbitrary stage bounds", () => {
    expect(resolveContainSizeForStage(400, 200, 1000, 500)).toEqual({
      drawWidth: 1000,
      drawHeight: 500,
    });
    expect(resolveContainSizeForStage(200, 400, 1000, 500)).toEqual({
      drawWidth: 250,
      drawHeight: 500,
    });
  });

  it("normalizes camera offsets from viewport-space into output-space", () => {
    expect(
      resolveStageFlattenCameraTransform({
        camera: {
          scale: 2,
          offsetX: 120,
          offsetY: -45,
          viewportWidth: 600,
          viewportHeight: 300,
        },
        outputWidth: 1000,
        outputHeight: 500,
      })
    ).toEqual({
      scale: 2,
      offsetX: 200,
      offsetY: -75,
    });
  });

  it("clamps camera scale to the shared Expert Edit viewport contract", () => {
    expect(
      resolveStageFlattenCameraTransform({
        camera: { scale: 9 },
        outputWidth: 1000,
        outputHeight: 1000,
      }).scale
    ).toBe(2);
    expect(
      resolveStageFlattenCameraTransform({
        camera: { scale: 0.1 },
        outputWidth: 1000,
        outputHeight: 1000,
      }).scale
    ).toBe(EXPERT_EDIT_CAMERA_SCALE_MIN);
  });

  it("normalizes canonical zoom and pan tuples into output-space camera offsets", () => {
    const zoomLevels = [EXPERT_EDIT_CAMERA_SCALE_MIN, 1, 2, 4];
    const panTuples = [
      { x: 0, y: 0 },
      { x: 37, y: -19 },
      { x: -120, y: 80 },
    ];
    const viewportWidth = 1200;
    const viewportHeight = 900;
    const outputWidth = 1000;
    const outputHeight = 750;

    zoomLevels.forEach((zoom) => {
      panTuples.forEach((pan) => {
        const transform = resolveStageFlattenCameraTransform({
          camera: {
            scale: zoom,
            offsetX: pan.x,
            offsetY: pan.y,
            viewportWidth,
            viewportHeight,
          },
          outputWidth,
          outputHeight,
        });
        expect(transform.scale).toBeCloseTo(Math.min(zoom, 2), 6);
        expect(transform.offsetX).toBeCloseTo((pan.x / viewportWidth) * outputWidth, 6);
        expect(transform.offsetY).toBeCloseTo((pan.y / viewportHeight) * outputHeight, 6);
      });
    });
  });

  it("builds deterministic draw instructions with clipped-canvas transforms", () => {
    const instructions = buildStageFlattenDrawPlan({
      decodedLayers: [
        {
          width: 2000,
          height: 1000,
          opacity: 1.4,
          transform: {
            translateXRatio: 0.1,
            translateYRatio: -0.2,
            scale: 3,
            rotationDeg: 45,
          },
        },
        {
          width: 1000,
          height: 1000,
          opacity: -2,
          transform: {
            translateXRatio: -0.25,
            translateYRatio: 0.25,
            scale: 0.1,
            rotationDeg: -15,
          },
        },
      ],
      outputWidth: 1000,
      outputHeight: 1000,
    });

    expect(instructions).toEqual([
      {
        drawWidth: 1000,
        drawHeight: 500,
        translateX: 100,
        translateY: -200,
        opacity: 1,
        scale: 2,
        rotationDeg: 45,
      },
      {
        drawWidth: 1000,
        drawHeight: 1000,
        translateX: -250,
        translateY: 250,
        opacity: 0,
        scale: 0.2,
        rotationDeg: -15,
      },
    ]);
  });

  it("composes visible layers with camera framing and bottom-to-top draw order", async () => {
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToBlob = HTMLCanvasElement.prototype.toBlob;
    const context = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      globalAlpha: 1,
    };
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => context as unknown as CanvasRenderingContext2D),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: vi.fn((callback: BlobCallback, mimeType?: string | null) => {
        callback(new Blob(["flattened"], { type: mimeType ?? "image/png" }));
      }),
    });

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1;
      naturalHeight = 1;
      width = 1;
      height = 1;

      set src(value: string) {
        if (value.includes("top")) {
          this.naturalWidth = 1000;
          this.naturalHeight = 500;
        } else if (value.includes("bottom")) {
          this.naturalWidth = 800;
          this.naturalHeight = 800;
        } else {
          this.onerror?.();
          return;
        }
        this.width = this.naturalWidth;
        this.height = this.naturalHeight;
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
      const blob = await composePrimaryStageLayersToBlob(
        [
          {
            imageUrl: "https://example.com/top.png",
            transform: { translateXRatio: 0.2, translateYRatio: -0.1, scale: 1, rotationDeg: 0 },
          },
          {
            imageUrl: "https://example.com/bottom.png",
            transform: { translateXRatio: 0, translateYRatio: 0, scale: 1, rotationDeg: 0 },
          },
        ],
        {
          outputAspectRatio: 16 / 9,
          camera: {
            scale: 1.5,
            offsetX: 50,
            offsetY: -25,
            viewportWidth: 250,
            viewportHeight: 250,
          },
        }
      );

      expect(blob.type).toBe("image/png");
      expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1000, 563);
      expect(context.drawImage).toHaveBeenCalledTimes(2);
      const firstDrawImage = context.drawImage.mock.calls[0]?.[0] as {
        naturalWidth: number;
        naturalHeight: number;
      };
      const secondDrawImage = context.drawImage.mock.calls[1]?.[0] as {
        naturalWidth: number;
        naturalHeight: number;
      };
      expect(firstDrawImage).toMatchObject({ naturalWidth: 800, naturalHeight: 800 });
      expect(secondDrawImage).toMatchObject({ naturalWidth: 1000, naturalHeight: 500 });

      expect(context.scale).toHaveBeenCalledWith(1.5, 1.5);
      const firstCameraTranslate = context.translate.mock.calls[0] as [number, number];
      expect(firstCameraTranslate[0]).toBeCloseTo(700, 4);
      expect(firstCameraTranslate[1]).toBeCloseTo(225.2, 1);
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

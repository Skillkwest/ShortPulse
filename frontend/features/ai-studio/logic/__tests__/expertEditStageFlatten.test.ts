/**
 * Unit tests for the Expert Edit manual stage-faithful flatten helpers.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STAGE_FLATTEN_MAX_OUTPUT_SIZE_PX,
  buildStageFlattenDrawPlan,
  composePrimaryStageLayersToBlob,
  resolveContainSizeForSquareStage,
  resolveStageFlattenOutputSizePx,
} from "../expertEditStageFlatten";

describe("expertEditStageFlatten", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves square output size from longest source edge with clamp", () => {
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

  it("contains non-square layers inside a square stage", () => {
    expect(resolveContainSizeForSquareStage(400, 200, 1000)).toEqual({
      drawWidth: 1000,
      drawHeight: 500,
    });
    expect(resolveContainSizeForSquareStage(200, 400, 1000)).toEqual({
      drawWidth: 500,
      drawHeight: 1000,
    });
  });

  it("builds deterministic draw instructions with transform clamping", () => {
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
      outputSizePx: 1000,
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

  it("composes visible layers with transparent clear and bottom-to-top draw order", async () => {
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
      const blob = await composePrimaryStageLayersToBlob([
        {
          imageUrl: "https://example.com/top.png",
          transform: { translateXRatio: 0.2, translateYRatio: -0.1, scale: 1, rotationDeg: 0 },
        },
        {
          imageUrl: "https://example.com/bottom.png",
          transform: { translateXRatio: 0, translateYRatio: 0, scale: 1, rotationDeg: 0 },
        },
      ]);

      expect(blob.type).toBe("image/png");
      expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1000, 1000);
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

/**
 * Verifies pure inpaint mask helpers used by the Expert Edit overlay renderer.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolvePointerSampleEvents,
  shouldEndPointerSessionOnLeave,
  shouldRenderLassoPreview,
  useInpaintMaskController,
} from "../useInpaintMaskController";
import {
  resolveInpaintBrushPaintRadius,
  resolveMaskExportSourceWindow,
  resolveMaskSpaceScaleFromSurface,
  resolveSceneCanvasPoint,
  toClampedCanvasPoint,
} from "../inpaintMaskGeometry";
import {
  buildContourPathsFromSegments,
  deriveMaskContourFromAlpha,
  INPAINT_MARCHING_ANTS_DASH_PATTERN,
  INPAINT_MARCHING_ANTS_STEP_MS,
  mapLassoPreviewPointsToOverlaySpace,
  resolveNextMarchingAntPhaseState,
} from "../inpaintMaskOverlay";

const makeMaskData = (width: number, height: number, activePixels: Array<[number, number]>) => {
  const data = new Uint8ClampedArray(width * height * 4);
  activePixels.forEach(([x, y]) => {
    const alphaIndex = (y * width + x) * 4 + 3;
    data[alphaIndex] = 255;
  });
  return data;
};

type MockCanvasContext = {
  createImageData: (width: number, height: number) => ImageData;
  putImageData: (imageData: ImageData, x: number, y: number) => void;
  getImageData: (x: number, y: number, width: number, height: number) => ImageData;
  clearRect: (x: number, y: number, width: number, height: number) => void;
  drawImage: (...args: unknown[]) => void;
  fillRect: (...args: unknown[]) => void;
  save: () => void;
  restore: () => void;
  translate: (...args: unknown[]) => void;
  scale: (...args: unknown[]) => void;
  setTransform: (...args: unknown[]) => void;
  beginPath: () => void;
  moveTo: (...args: unknown[]) => void;
  lineTo: (...args: unknown[]) => void;
  stroke: () => void;
  fill: () => void;
  closePath: () => void;
  arc: (...args: unknown[]) => void;
  setLineDash: (...args: unknown[]) => void;
  lineDashOffset: number;
  globalCompositeOperation: string;
  strokeStyle: string;
  fillStyle: string;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
};

const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
const originalCanvasToBlob = HTMLCanvasElement.prototype.toBlob;
let canvasContextStore = new WeakMap<HTMLCanvasElement, MockCanvasContext>();

const createMockImageData = (width: number, height: number, data?: Uint8ClampedArray): ImageData =>
  ({
    width,
    height,
    data: data ? new Uint8ClampedArray(data) : new Uint8ClampedArray(width * height * 4),
    colorSpace: "srgb",
  }) as ImageData;

const getCanvasBuffer = (canvas: HTMLCanvasElement): Uint8ClampedArray => {
  const requiredLength = Math.max(1, canvas.width) * Math.max(1, canvas.height) * 4;
  const existing = (canvas as HTMLCanvasElement & { __buffer?: Uint8ClampedArray }).__buffer;
  if (existing && existing.length === requiredLength) {
    return existing;
  }
  const next = new Uint8ClampedArray(requiredLength);
  (canvas as HTMLCanvasElement & { __buffer?: Uint8ClampedArray }).__buffer = next;
  return next;
};

const createMockCanvasContext = (canvas: HTMLCanvasElement): MockCanvasContext => ({
  createImageData: (width, height) => createMockImageData(width, height),
  putImageData: (imageData) => {
    (canvas as HTMLCanvasElement & { __buffer?: Uint8ClampedArray }).__buffer =
      new Uint8ClampedArray(imageData.data);
  },
  getImageData: (_x, _y, width, height) =>
    createMockImageData(width, height, getCanvasBuffer(canvas).slice(0, width * height * 4)),
  clearRect: () => {
    getCanvasBuffer(canvas).fill(0);
  },
  drawImage: () => undefined,
  fillRect: () => undefined,
  save: () => undefined,
  restore: () => undefined,
  translate: () => undefined,
  scale: () => undefined,
  setTransform: () => undefined,
  beginPath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  stroke: () => undefined,
  fill: () => undefined,
  closePath: () => undefined,
  arc: () => undefined,
  setLineDash: () => undefined,
  lineDashOffset: 0,
  globalCompositeOperation: "source-over",
  strokeStyle: "",
  fillStyle: "",
  lineCap: "round",
  lineJoin: "round",
  lineWidth: 1,
});

const getOrCreateCanvasContext = (canvas: HTMLCanvasElement): MockCanvasContext => {
  const existing = canvasContextStore.get(canvas);
  if (existing) return existing;
  const created = createMockCanvasContext(canvas);
  canvasContextStore.set(canvas, created);
  return created;
};

beforeEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: function getContext(this: HTMLCanvasElement, contextId: string) {
      if (contextId !== "2d") return null;
      return getOrCreateCanvasContext(this);
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    configurable: true,
    value: function toBlob(this: HTMLCanvasElement, callback: BlobCallback, type?: string): void {
      callback(new Blob(["mask"], { type: type ?? "image/png" }));
    },
  });

  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  canvasContextStore = new WeakMap<HTMLCanvasElement, MockCanvasContext>();
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: originalCanvasGetContext,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    configurable: true,
    value: originalCanvasToBlob,
  });
  vi.unstubAllGlobals();
});

const createDropzoneRef = () => {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: 200,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100,
        toJSON: () => ({}),
      }) satisfies DOMRect,
  });
  return { current: element };
};

const makeSnapshot = () => ({
  layers: [
    {
      layerId: "layer-a",
      width: 4,
      height: 4,
      alpha: new Uint8ClampedArray([0, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    },
  ],
});

describe("useInpaintMaskController helpers", () => {
  it("keeps a uniform marching-ants dash pattern", () => {
    expect(INPAINT_MARCHING_ANTS_DASH_PATTERN).toEqual([6, 4]);
  });

  it("throttles marching-ants phase by configured cadence", () => {
    const initial = resolveNextMarchingAntPhaseState({
      phase: 0,
      lastTickMs: 0,
      nowMs: 100,
    });
    expect(initial).toEqual({ phase: 0, lastTickMs: 100 });

    const unchanged = resolveNextMarchingAntPhaseState({
      phase: initial.phase,
      lastTickMs: initial.lastTickMs,
      nowMs: initial.lastTickMs + INPAINT_MARCHING_ANTS_STEP_MS - 1,
    });
    expect(unchanged).toEqual({
      phase: initial.phase,
      lastTickMs: initial.lastTickMs,
    });

    const advanced = resolveNextMarchingAntPhaseState({
      phase: unchanged.phase,
      lastTickMs: unchanged.lastTickMs,
      nowMs: unchanged.lastTickMs + INPAINT_MARCHING_ANTS_STEP_MS + 1,
    });
    expect(advanced.phase).toBe(1);
    expect(advanced.lastTickMs).toBe(unchanged.lastTickMs + INPAINT_MARCHING_ANTS_STEP_MS + 1);
  });

  it("derives contour segments for active mask pixels", () => {
    const singlePixelMask = deriveMaskContourFromAlpha(2, 2, makeMaskData(2, 2, [[0, 0]]));
    expect(singlePixelMask.hasContent).toBe(true);
    expect(singlePixelMask.contourSegments).toEqual([
      0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0,
    ]);
    expect(singlePixelMask.contourPaths).toEqual([[0, 0, 1, 0, 1, 1, 0, 1, 0, 0]]);
  });

  it("returns no contour for an empty mask", () => {
    const emptyMask = deriveMaskContourFromAlpha(3, 3, makeMaskData(3, 3, []));
    expect(emptyMask.hasContent).toBe(false);
    expect(emptyMask.contourSegments).toEqual([]);
    expect(emptyMask.contourPaths).toEqual([]);
  });

  it("chains adjacent boundary segments into a continuous contour path", () => {
    const twoPixelMask = deriveMaskContourFromAlpha(
      3,
      2,
      makeMaskData(3, 2, [
        [0, 0],
        [1, 0],
      ])
    );
    expect(twoPixelMask.hasContent).toBe(true);
    expect(twoPixelMask.contourPaths).toHaveLength(1);
    expect(twoPixelMask.contourPaths[0]).toEqual([0, 0, 1, 0, 2, 0, 2, 1, 1, 1, 0, 1, 0, 0]);
  });

  it("returns no paths when contour segments are empty", () => {
    expect(buildContourPathsFromSegments([])).toEqual([]);
  });

  it("clips export source window to image bounds inside the mask canvas", () => {
    expect(
      resolveMaskExportSourceWindow({
        imageRect: {
          x: -12.4,
          y: 8.2,
          width: 160.8,
          height: 120.6,
        },
        maskWidth: 100,
        maskHeight: 90,
      })
    ).toEqual({
      sx: 0,
      sy: 8,
      sw: 100,
      sh: 82,
    });
  });

  it("falls back to full mask canvas window when image rect is absent", () => {
    expect(
      resolveMaskExportSourceWindow({
        imageRect: null,
        maskWidth: 128,
        maskHeight: 72,
      })
    ).toEqual({
      sx: 0,
      sy: 0,
      sw: 128,
      sh: 72,
    });
  });

  it("returns null for degenerate export windows", () => {
    expect(
      resolveMaskExportSourceWindow({
        imageRect: {
          x: 150,
          y: 10,
          width: 25,
          height: 40,
        },
        maskWidth: 100,
        maskHeight: 90,
      })
    ).toBeNull();
    expect(
      resolveMaskExportSourceWindow({
        imageRect: null,
        maskWidth: 0,
        maskHeight: 90,
      })
    ).toBeNull();
  });

  it("falls back to the native pointer event when coalesced sampling is empty", () => {
    const nativePointerEvent = {
      clientX: 12,
      clientY: 18,
      getCoalescedEvents: () => [] as PointerEvent[],
    } as unknown as PointerEvent;
    const sampleEvents = resolvePointerSampleEvents(nativePointerEvent);
    expect(sampleEvents).toHaveLength(1);
    expect(sampleEvents[0]).toBe(nativePointerEvent);
  });

  it("uses coalesced pointer events when available", () => {
    const sampleA = { clientX: 10, clientY: 20 } as PointerEvent;
    const sampleB = { clientX: 14, clientY: 24 } as PointerEvent;
    const nativePointerEvent = {
      clientX: 8,
      clientY: 16,
      getCoalescedEvents: () => [sampleA, sampleB],
    } as unknown as PointerEvent;
    expect(resolvePointerSampleEvents(nativePointerEvent)).toEqual([sampleA, sampleB]);
  });

  it("clamps sampled pointer coordinates to the dropzone bounds", () => {
    const rect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    } as DOMRect;
    expect(toClampedCanvasPoint({ clientX: -30, clientY: 400 }, rect)).toEqual({
      x: 0,
      y: 100,
    });
    expect(toClampedCanvasPoint({ clientX: 99, clientY: 65 }, rect)).toEqual({
      x: 89,
      y: 45,
    });
  });

  it("maps pointer coordinates into unscaled scene space when zoomed", () => {
    const rect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    } as DOMRect;
    expect(
      resolveSceneCanvasPoint({
        clientX: 60,
        clientY: 45,
        rect,
        sceneScale: 0.5,
      })
    ).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      resolveSceneCanvasPoint({
        clientX: 60,
        clientY: 45,
        rect,
        sceneScale: 2,
      })
    ).toEqual({
      x: 75,
      y: 37.5,
    });
  });

  it("clamps scaled scene coordinates after zoom adjustment", () => {
    const rect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    } as DOMRect;
    expect(toClampedCanvasPoint({ clientX: 10, clientY: 20 }, rect, 0.5)).toEqual({
      x: 0,
      y: 0,
    });
    expect(toClampedCanvasPoint({ clientX: 210, clientY: 120 }, rect, 0.5)).toEqual({
      x: 200,
      y: 100,
    });
  });

  it("shows live preview only while lasso is active", () => {
    expect(shouldRenderLassoPreview(true, "lasso")).toBe(true);
    expect(shouldRenderLassoPreview(true, "brush")).toBe(false);
    expect(shouldRenderLassoPreview(false, "lasso")).toBe(false);
  });

  it("maps lasso preview points from mask space into overlay space", () => {
    expect(
      mapLassoPreviewPointsToOverlaySpace({
        points: [{ x: 200, y: 150 }],
        maskWidth: 400,
        maskHeight: 300,
        overlayWidth: 800,
        overlayHeight: 600,
      })
    ).toEqual([{ x: 400, y: 300 }]);
  });

  it("preserves lasso preview scene geometry across aspect changes", () => {
    const mappedPoints = mapLassoPreviewPointsToOverlaySpace({
      points: [{ x: 300, y: 150 }],
      maskWidth: 400,
      maskHeight: 300,
      overlayWidth: 300,
      overlayHeight: 400,
    });
    expect(mappedPoints).toHaveLength(1);
    expect(mappedPoints[0]?.x ?? 0).toBeCloseTo(283.333, 3);
    expect(mappedPoints[0]?.y ?? 0).toBeCloseTo(200, 3);
  });

  it("returns unchanged lasso preview points when spaces are already matched", () => {
    const points = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ];
    expect(
      mapLassoPreviewPointsToOverlaySpace({
        points,
        maskWidth: 500,
        maskHeight: 500,
        overlayWidth: 500,
        overlayHeight: 500,
      })
    ).toBe(points);
  });

  it("keeps brush paint radius visually stable by compensating for stage zoom", () => {
    const radiusAt100 = resolveInpaintBrushPaintRadius({
      strokeSize: 60,
      sceneScale: 1,
    });
    const radiusAt200 = resolveInpaintBrushPaintRadius({
      strokeSize: 60,
      sceneScale: 2,
    });
    const radiusAt50 = resolveInpaintBrushPaintRadius({
      strokeSize: 60,
      sceneScale: 0.5,
    });
    expect(radiusAt200).toBeCloseTo(radiusAt100 / 2, 4);
    expect(radiusAt50).toBeCloseTo(radiusAt100 * 2, 4);
  });

  it("rescales brush paint radius for differing surface and mask sizes", () => {
    const baseRadius = resolveInpaintBrushPaintRadius({
      strokeSize: 60,
      sceneScale: 1,
    });
    const scaledRadius = resolveInpaintBrushPaintRadius({
      strokeSize: 60,
      sceneScale: 1,
      surfaceToMaskScale: resolveMaskSpaceScaleFromSurface({
        surfaceWidth: 800,
        surfaceHeight: 800,
        maskWidth: 400,
        maskHeight: 400,
      }),
    });
    expect(scaledRadius).toBeCloseTo(baseRadius * 0.5, 4);
  });

  it("keeps active pointer sessions alive on leave while capture is held", () => {
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: true,
        sessionPointerId: 44,
        eventPointerId: 44,
        hasPointerCapture: true,
      })
    ).toBe(false);
  });

  it("ends active pointer sessions on leave when capture is not held", () => {
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: true,
        sessionPointerId: 44,
        eventPointerId: 44,
        hasPointerCapture: false,
      })
    ).toBe(true);
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: false,
        sessionPointerId: 44,
        eventPointerId: 44,
        hasPointerCapture: false,
      })
    ).toBe(false);
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: true,
        sessionPointerId: 44,
        eventPointerId: 45,
        hasPointerCapture: false,
      })
    ).toBe(false);
  });
});

describe("useInpaintMaskController hook", () => {
  it("restores a selected-layer snapshot and round-trips it through capture", async () => {
    const dropzoneRef = createDropzoneRef();
    const { result } = renderHook(() =>
      useInpaintMaskController({
        dropzoneRef,
        selectedLayerId: "layer-a",
        selectedLayerImageUrl: null,
        layerSources: [{ id: "layer-a", imageUrl: null }],
        enabled: true,
        sceneScale: 1,
        paintMode: "brush",
        selectionMode: "select",
        strokeSize: 24,
      })
    );

    const snapshot = makeSnapshot();

    await act(async () => {
      result.current.restoreMaskSnapshot(snapshot);
    });

    await waitFor(() => {
      expect(result.current.hasSelectedLayerMask).toBe(true);
    });

    const captured = result.current.captureMaskSnapshot();
    expect(captured.layers).toHaveLength(1);
    expect(captured.layers[0]?.layerId).toBe("layer-a");
    expect(Array.from(captured.layers[0]?.alpha ?? [])).toEqual(
      Array.from(snapshot.layers[0]!.alpha)
    );
  });

  it("exports and clears the restored selected-layer mask", async () => {
    const dropzoneRef = createDropzoneRef();
    const { result } = renderHook(() =>
      useInpaintMaskController({
        dropzoneRef,
        selectedLayerId: "layer-a",
        selectedLayerImageUrl: null,
        layerSources: [{ id: "layer-a", imageUrl: null }],
        enabled: true,
        sceneScale: 1,
        paintMode: "brush",
        selectionMode: "select",
        strokeSize: 24,
      })
    );

    await act(async () => {
      result.current.restoreMaskSnapshot(makeSnapshot());
    });

    await waitFor(() => {
      expect(result.current.hasSelectedLayerMask).toBe(true);
    });

    const exportedMask = await act(async () =>
      result.current.exportSelectedLayerMaskBlob({
        targetWidth: 16,
        targetHeight: 16,
      })
    );
    expect(exportedMask).toBeInstanceOf(Blob);

    await act(async () => {
      result.current.clearSelectedLayerMask();
    });

    await waitFor(() => {
      expect(result.current.hasSelectedLayerMask).toBe(false);
    });
    expect(result.current.captureMaskSnapshot().layers).toEqual([]);
  });
});

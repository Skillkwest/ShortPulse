/**
 * Fabric.js candidate for the master-stage bakeoff lab.
 * Evaluates Fabric's built-in object controls, viewport zoom, and panning behavior.
 */
/* eslint-disable @next/next/no-img-element */
import React from "react";

import {
  STAGE_BAKEOFF_ARTBOARD_WIDTH,
  STAGE_BAKEOFF_SAMPLE_IMAGE,
  STAGE_BAKEOFF_VIEWPORT_HEIGHT,
  STAGE_BAKEOFF_VIEWPORT_WIDTH,
  createStageBakeoffCamera,
  resolveStageBakeoffArtboardRect,
  resolveStageBakeoffLayerBaseRect,
} from "./stageBakeoffShared";

type FabricModule = typeof import("fabric");

type PointerLikeEvent = {
  clientX?: number;
  clientY?: number;
  touches?: ArrayLike<{ clientX: number; clientY: number }>;
  changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
};

const resolvePointerClientPoint = (event: unknown): { clientX: number; clientY: number } => {
  const pointerLikeEvent = event as PointerLikeEvent;
  if (
    typeof pointerLikeEvent.clientX === "number" &&
    typeof pointerLikeEvent.clientY === "number"
  ) {
    return {
      clientX: pointerLikeEvent.clientX,
      clientY: pointerLikeEvent.clientY,
    };
  }
  const activeTouch = pointerLikeEvent.touches?.[0] ?? pointerLikeEvent.changedTouches?.[0];
  return {
    clientX: typeof activeTouch?.clientX === "number" ? activeTouch.clientX : 0,
    clientY: typeof activeTouch?.clientY === "number" ? activeTouch.clientY : 0,
  };
};

const resolveWheelDeltaY = (event: unknown): number => {
  const wheelLikeEvent = event as { deltaY?: number };
  return typeof wheelLikeEvent.deltaY === "number" ? wheelLikeEvent.deltaY : 0;
};

const resolveCanvasLocalPoint = (
  event: unknown,
  canvasElement: HTMLCanvasElement
): { x: number; y: number } => {
  const point = resolvePointerClientPoint(event);
  const rect = canvasElement.getBoundingClientRect();
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
};

/**
 * Renders the Fabric candidate surface.
 */
export function StageBakeoffFabricCandidate() {
  const canvasElementRef = React.useRef<HTMLCanvasElement | null>(null);
  const canvasRef = React.useRef<import("fabric").Canvas | null>(null);
  const imageRef = React.useRef<import("fabric").FabricImage | null>(null);

  const [zoom, setZoom] = React.useState(createStageBakeoffCamera().scale);
  const [exportUrl, setExportUrl] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const artboardRect = React.useMemo(() => resolveStageBakeoffArtboardRect(), []);
  const baseRect = React.useMemo(() => resolveStageBakeoffLayerBaseRect(), []);

  React.useEffect(() => {
    let mounted = true;
    let disposed = false;

    const initialize = async () => {
      if (!canvasElementRef.current) return;
      const fabricModule: FabricModule = await import("fabric");
      if (!mounted) return;

      const { Canvas, Rect, FabricImage, Point } = fabricModule;
      const canvas = new Canvas(canvasElementRef.current, {
        width: STAGE_BAKEOFF_VIEWPORT_WIDTH,
        height: STAGE_BAKEOFF_VIEWPORT_HEIGHT,
        backgroundColor: "#d9d4c8",
        preserveObjectStacking: true,
        selection: false,
      });

      const artboard = new Rect({
        left: artboardRect.left,
        top: artboardRect.top,
        width: artboardRect.width,
        height: artboardRect.height,
        fill: "#f7f5f1",
        stroke: "rgba(15, 23, 42, 0.08)",
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      canvas.add(artboard);

      const image = await FabricImage.fromURL(STAGE_BAKEOFF_SAMPLE_IMAGE.src);
      if (!mounted || disposed) {
        canvas.dispose();
        return;
      }

      image.set({
        originX: "center",
        originY: "center",
        left: artboardRect.left + artboardRect.width / 2,
        top: artboardRect.top + artboardRect.height / 2,
        scaleX: baseRect.width / STAGE_BAKEOFF_SAMPLE_IMAGE.width,
        scaleY: baseRect.height / STAGE_BAKEOFF_SAMPLE_IMAGE.height,
        angle: 0,
        borderColor: "#2563eb",
        cornerColor: "#2563eb",
        cornerStrokeColor: "#f8fafc",
        cornerStyle: "circle",
        transparentCorners: false,
      });
      canvas.add(image);
      canvas.setActiveObject(image);
      imageRef.current = image;
      canvasRef.current = canvas;

      let isPanning = false;
      let lastClientX = 0;
      let lastClientY = 0;

      canvas.on("mouse:wheel", (event) => {
        const canvasElement = canvasElementRef.current;
        if (!canvasElement) return;
        const nextZoom = Math.min(
          2.5,
          Math.max(0.35, canvas.getZoom() * Math.exp(-resolveWheelDeltaY(event.e) * 0.0015))
        );
        const localPoint = resolveCanvasLocalPoint(event.e, canvasElement);
        canvas.zoomToPoint(new Point(localPoint.x, localPoint.y), nextZoom);
        setZoom(nextZoom);
        event.e.preventDefault();
        event.e.stopPropagation();
      });

      canvas.on("mouse:down", (event) => {
        if (event.target) return;
        const point = resolvePointerClientPoint(event.e);
        isPanning = true;
        lastClientX = point.clientX;
        lastClientY = point.clientY;
      });

      canvas.on("mouse:move", (event) => {
        if (!isPanning) return;
        const viewportTransform = canvas.viewportTransform;
        if (!viewportTransform) return;
        const point = resolvePointerClientPoint(event.e);
        viewportTransform[4] += point.clientX - lastClientX;
        viewportTransform[5] += point.clientY - lastClientY;
        lastClientX = point.clientX;
        lastClientY = point.clientY;
        canvas.requestRenderAll();
      });

      canvas.on("mouse:up", () => {
        isPanning = false;
      });

      canvas.renderAll();
    };

    initialize();
    return () => {
      mounted = false;
      disposed = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
      imageRef.current = null;
    };
  }, [
    artboardRect.height,
    artboardRect.left,
    artboardRect.top,
    artboardRect.width,
    baseRect.height,
    baseRect.width,
  ]);

  const handleResetView = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
    setZoom(1);
  }, []);

  const handleResetLayer = React.useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    image.set({
      left: artboardRect.left + artboardRect.width / 2,
      top: artboardRect.top + artboardRect.height / 2,
      angle: 0,
      scaleX: baseRect.width / STAGE_BAKEOFF_SAMPLE_IMAGE.width,
      scaleY: baseRect.height / STAGE_BAKEOFF_SAMPLE_IMAGE.height,
    });
    canvas.setActiveObject(image);
    canvas.requestRenderAll();
  }, [
    artboardRect.height,
    artboardRect.left,
    artboardRect.top,
    artboardRect.width,
    baseRect.height,
    baseRect.width,
  ]);

  const handleExport = React.useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    try {
      const previousViewportTransform = canvas.viewportTransform
        ? [...canvas.viewportTransform]
        : null;
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const nextUrl = canvas.toDataURL({
        format: "png",
        left: artboardRect.left,
        top: artboardRect.top,
        width: artboardRect.width,
        height: artboardRect.height,
        multiplier: STAGE_BAKEOFF_ARTBOARD_WIDTH / artboardRect.width,
      });
      if (previousViewportTransform) {
        canvas.setViewportTransform(
          previousViewportTransform as [number, number, number, number, number, number]
        );
      }
      canvas.requestRenderAll();
      setExportUrl(nextUrl);
    } finally {
      setIsExporting(false);
    }
  }, [artboardRect.height, artboardRect.left, artboardRect.top, artboardRect.width]);

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button type="button" onClick={handleResetView}>
          Reset View
        </button>
        <button type="button" onClick={handleResetLayer}>
          Reset Layer
        </button>
        <button type="button" onClick={handleExport} disabled={isExporting}>
          {isExporting ? "Exporting..." : "Export PNG"}
        </button>
        <div style={{ alignSelf: "center", color: "#334155", fontSize: "0.92rem" }}>
          Zoom {zoom.toFixed(2)}x • Drag background to pan • Native Fabric controls drive move,
          resize, and rotate
        </div>
      </div>

      <div
        style={{
          width: `${STAGE_BAKEOFF_VIEWPORT_WIDTH}px`,
          height: `${STAGE_BAKEOFF_VIEWPORT_HEIGHT}px`,
          overflow: "hidden",
          borderRadius: "22px",
          background:
            "linear-gradient(135deg, rgba(146, 164, 136, 0.18), rgba(90, 103, 216, 0.1)), #d9d4c8",
          boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.08)",
        }}
      >
        <canvas ref={canvasElementRef} />
      </div>

      {exportUrl ? (
        <div style={{ display: "grid", gap: "10px" }}>
          <strong>Latest export</strong>
          <img
            src={exportUrl}
            alt="Fabric candidate export preview"
            style={{
              width: "min(520px, 100%)",
              borderRadius: "14px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

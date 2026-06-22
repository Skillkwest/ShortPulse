/**
 * DOM/CSS candidate for the master-stage bakeoff lab.
 * Uses the shared Expert Edit geometry helpers with a plain DOM rendering stack.
 */
/* eslint-disable @next/next/no-img-element */
import React from "react";

import { createIdleTransformPointerSession } from "../expertEditInteractionUtils";
import { clampLayerScale, type LayerTransform } from "../expertEditLayerTransformUtils";
import {
  createTransformPointerSession,
  resolveTransformSessionUpdate,
} from "../expertEditTransformGestureUtils";
import {
  STAGE_BAKEOFF_VIEWPORT_HEIGHT,
  STAGE_BAKEOFF_VIEWPORT_WIDTH,
  clampStageBakeoffZoom,
  createStageBakeoffCamera,
  createStageBakeoffLayerTransform,
  exportStageBakeoffScene,
  resolveStageBakeoffArtboardPointFromClient,
  resolveStageBakeoffArtboardRect,
  resolveStageBakeoffLayerGeometry,
  resolveStageBakeoffZoomAboutClientPoint,
  type StageBakeoffArtboardRect,
} from "./stageBakeoffShared";

type PanPointerSession = {
  active: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};

const createIdlePanPointerSession = (): PanPointerSession => ({
  active: false,
  pointerId: -1,
  startClientX: 0,
  startClientY: 0,
  startOffsetX: 0,
  startOffsetY: 0,
});

const viewportFrameStyle: React.CSSProperties = {
  position: "relative",
  width: `${STAGE_BAKEOFF_VIEWPORT_WIDTH}px`,
  height: `${STAGE_BAKEOFF_VIEWPORT_HEIGHT}px`,
  overflow: "hidden",
  borderRadius: "22px",
  background:
    "linear-gradient(135deg, rgba(146, 164, 136, 0.18), rgba(90, 103, 216, 0.1)), #d9d4c8",
  boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.08)",
  touchAction: "none",
  userSelect: "none",
};

/**
 * Renders the DOM/CSS candidate surface.
 */
export function StageBakeoffDomCandidate() {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const transformSessionRef = React.useRef(createIdleTransformPointerSession());
  const panSessionRef = React.useRef(createIdlePanPointerSession());

  const [camera, setCamera] = React.useState(createStageBakeoffCamera);
  const [transform, setTransform] = React.useState<LayerTransform>(
    createStageBakeoffLayerTransform
  );
  const [selected, setSelected] = React.useState(true);
  const [exportUrl, setExportUrl] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const artboardRect = React.useMemo<StageBakeoffArtboardRect>(
    () => resolveStageBakeoffArtboardRect(),
    []
  );
  const layerGeometry = React.useMemo(
    () => resolveStageBakeoffLayerGeometry(transform),
    [transform]
  );

  const clearSessions = React.useCallback(() => {
    transformSessionRef.current = createIdleTransformPointerSession();
    panSessionRef.current = createIdlePanPointerSession();
  }, []);

  const beginPan = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      panSessionRef.current = {
        active: true,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: camera.offsetX,
        startOffsetY: camera.offsetY,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [camera.offsetX, camera.offsetY]
  );

  const beginTransform = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, dragMode: "move" | "resize" | "rotate") => {
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      if (!viewportRect) return;
      const artboardPoint = resolveStageBakeoffArtboardPointFromClient({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportRect,
        camera,
      });
      if (!artboardPoint) return;
      transformSessionRef.current = createTransformPointerSession({
        pointerId: event.pointerId,
        pointerX: artboardPoint.x,
        pointerY: artboardPoint.y,
        dropzoneWidth: artboardRect.width,
        dropzoneHeight: artboardRect.height,
        selectedLayerId: "hero",
        selectedLayerTransform: transform,
        imageAspectRatio: layerGeometry.baseRect.width / layerGeometry.baseRect.height,
        dragMode,
      });
      setSelected(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [
      artboardRect.height,
      artboardRect.width,
      camera,
      layerGeometry.baseRect.height,
      layerGeometry.baseRect.width,
      transform,
    ]
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const explicitMode = target.closest<HTMLElement>("[data-stage-bakeoff-transform-mode]")
        ?.dataset.stageBakeoffTransformMode as "move" | "resize" | "rotate" | undefined;

      if (explicitMode) {
        event.preventDefault();
        beginTransform(event, explicitMode);
        return;
      }

      if (target.closest("[data-stage-bakeoff-layer]")) {
        event.preventDefault();
        beginTransform(event, "move");
        return;
      }

      setSelected(false);
      beginPan(event);
    },
    [beginPan, beginTransform]
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const transformSession = transformSessionRef.current;
      if (transformSession.active && transformSession.pointerId === event.pointerId) {
        const viewportRect = viewportRef.current?.getBoundingClientRect();
        if (!viewportRect) return;
        const artboardPoint = resolveStageBakeoffArtboardPointFromClient({
          clientX: event.clientX,
          clientY: event.clientY,
          viewportRect,
          camera,
        });
        if (!artboardPoint) return;
        const nextTransform = resolveTransformSessionUpdate({
          session: transformSession,
          pointerX: artboardPoint.x,
          pointerY: artboardPoint.y,
        });
        if (nextTransform) {
          setTransform((current) => ({
            ...current,
            ...nextTransform,
            scale: nextTransform.scale ? clampLayerScale(nextTransform.scale) : current.scale,
          }));
        }
        return;
      }

      const panSession = panSessionRef.current;
      if (panSession.active && panSession.pointerId === event.pointerId) {
        setCamera((current) => ({
          ...current,
          offsetX: panSession.startOffsetX + (event.clientX - panSession.startClientX),
          offsetY: panSession.startOffsetY + (event.clientY - panSession.startClientY),
        }));
      }
    },
    [camera]
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        transformSessionRef.current.pointerId === event.pointerId ||
        panSessionRef.current.pointerId === event.pointerId
      ) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        clearSessions();
      }
    },
    [clearSessions]
  );

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      if (!viewportRect) return;
      const nextScale = clampStageBakeoffZoom(camera.scale * Math.exp(-event.deltaY * 0.0015));
      setCamera((current) =>
        resolveStageBakeoffZoomAboutClientPoint({
          clientX: event.clientX,
          clientY: event.clientY,
          viewportRect,
          camera: current,
          nextScale,
        })
      );
    },
    [camera.scale]
  );

  const handleExport = React.useCallback(async () => {
    setIsExporting(true);
    try {
      const nextUrl = await exportStageBakeoffScene(transform);
      setExportUrl(nextUrl);
    } finally {
      setIsExporting(false);
    }
  }, [transform]);

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setCamera(createStageBakeoffCamera())}>
          Reset View
        </button>
        <button type="button" onClick={() => setTransform(createStageBakeoffLayerTransform())}>
          Reset Layer
        </button>
        <button type="button" onClick={handleExport} disabled={isExporting}>
          {isExporting ? "Exporting..." : "Export PNG"}
        </button>
        <div style={{ alignSelf: "center", color: "#334155", fontSize: "0.92rem" }}>
          Zoom {camera.scale.toFixed(2)}x • Drag background to pan • Drag image to move • Corner
          handle resizes • Top handle rotates
        </div>
      </div>

      <div
        ref={viewportRef}
        style={viewportFrameStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${camera.offsetX}px, ${camera.offsetY}px) scale(${camera.scale})`,
            transformOrigin: "center center",
          }}
        >
          <div
            data-stage-bakeoff-artboard
            style={{
              position: "absolute",
              left: `${artboardRect.left}px`,
              top: `${artboardRect.top}px`,
              width: `${artboardRect.width}px`,
              height: `${artboardRect.height}px`,
              background: "#f7f5f1",
              boxShadow: "0 18px 42px rgba(15, 23, 42, 0.18)",
              outline: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            <img
              data-stage-bakeoff-layer
              src="data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1000' height='1400' viewBox='0 0 1000 1400' fill='none'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='40' y1='20' x2='920' y2='1320' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23F5C29C'/%3E%3Cstop offset='0.48' stop-color='%23EE7C58'/%3E%3Cstop offset='1' stop-color='%23342B5A'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1000' height='1400' fill='url(%23bg)'/%3E%3Crect x='84' y='84' width='832' height='1232' rx='36' fill='rgba(255,255,255,0.16)' stroke='rgba(255,255,255,0.5)' stroke-width='8'/%3E%3Ccircle cx='500' cy='472' r='156' fill='rgba(255,250,240,0.72)'/%3E%3Cpath d='M312 1100C312 975.184 413.184 874 538 874H542C666.816 874 768 975.184 768 1100V1228H312V1100Z' fill='rgba(25,22,38,0.76)'/%3E%3Cpath d='M364 1098C364 1002.484 441.484 925 537 925H543C638.516 925 716 1002.484 716 1098V1228H364V1098Z' fill='rgba(255,255,255,0.3)'/%3E%3Cpath d='M276 278L376 192L498 320L668 168L804 312' stroke='rgba(255,255,255,0.68)' stroke-width='18' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M226 1294H774' stroke='rgba(255,255,255,0.76)' stroke-width='14' stroke-linecap='round'/%3E%3Ctext x='500' y='170' text-anchor='middle' fill='%23FFF8F3' font-size='72' font-family='Arial, sans-serif' font-weight='700'%3EBakeoff Portrait%3C/text%3E%3Ctext x='500' y='1310' text-anchor='middle' fill='rgba(255,255,255,0.82)' font-size='36' font-family='Arial, sans-serif'%3EMove · Resize · Rotate · Export%3C/text%3E%3C/svg%3E"
              alt="Bakeoff portrait"
              draggable={false}
              style={{
                position: "absolute",
                left: `${layerGeometry.transformGeometry.centerX}px`,
                top: `${layerGeometry.transformGeometry.centerY}px`,
                width: `${layerGeometry.baseRect.width}px`,
                height: `${layerGeometry.baseRect.height}px`,
                transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg) scale(${transform.scale})`,
                transformOrigin: "center center",
                outline: selected ? "2px solid rgba(37, 99, 235, 0.95)" : "none",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.18)",
                cursor: "grab",
              }}
            />
            {selected ? (
              <>
                <div
                  data-stage-bakeoff-transform-mode="resize"
                  style={{
                    position: "absolute",
                    left: `${layerGeometry.transformGeometry.resizeHandleX - 7}px`,
                    top: `${layerGeometry.transformGeometry.resizeHandleY - 7}px`,
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "#2563eb",
                    border: "2px solid #f8fafc",
                    cursor: "nwse-resize",
                  }}
                />
                <div
                  data-stage-bakeoff-transform-mode="rotate"
                  style={{
                    position: "absolute",
                    left: `${layerGeometry.transformGeometry.rotateHandleX - 8}px`,
                    top: `${layerGeometry.transformGeometry.rotateHandleY - 8}px`,
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "#0f172a",
                    border: "2px solid #f8fafc",
                    cursor: "crosshair",
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      {exportUrl ? (
        <div style={{ display: "grid", gap: "10px" }}>
          <strong>Latest export</strong>
          <img
            src={exportUrl}
            alt="DOM candidate export preview"
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

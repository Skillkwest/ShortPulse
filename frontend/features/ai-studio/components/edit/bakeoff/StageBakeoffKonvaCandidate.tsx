/**
 * Konva candidate for the master-stage bakeoff lab.
 * Uses react-konva primitives to evaluate built-in node transforms against the target stage model.
 */
/* eslint-disable @next/next/no-img-element */
import React from "react";
import { Layer, Group, Rect, Image as KonvaImage, Transformer, Stage } from "react-konva";
import type Konva from "konva";

import {
  clampLayerScale,
  normalizeLayerRotationDeg,
  type LayerTransform,
} from "../expertEditLayerTransformUtils";
import {
  STAGE_BAKEOFF_VIEWPORT_HEIGHT,
  STAGE_BAKEOFF_VIEWPORT_WIDTH,
  clampStageBakeoffZoom,
  createStageBakeoffCamera,
  createStageBakeoffLayerTransform,
  exportStageBakeoffScene,
  loadStageBakeoffSampleImage,
  resolveStageBakeoffArtboardRect,
  resolveStageBakeoffLayerGeometry,
  resolveStageBakeoffZoomAboutClientPoint,
} from "./stageBakeoffShared";

type PanPointerSession = {
  active: boolean;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};

const createIdlePanPointerSession = (): PanPointerSession => ({
  active: false,
  startClientX: 0,
  startClientY: 0,
  startOffsetX: 0,
  startOffsetY: 0,
});

/**
 * Renders the Konva candidate surface.
 */
export function StageBakeoffKonvaCandidate() {
  const stageRef = React.useRef<Konva.Stage | null>(null);
  const imageRef = React.useRef<Konva.Image | null>(null);
  const transformerRef = React.useRef<Konva.Transformer | null>(null);
  const panSessionRef = React.useRef(createIdlePanPointerSession());

  const [imageElement, setImageElement] = React.useState<HTMLImageElement | null>(null);
  const [camera, setCamera] = React.useState(createStageBakeoffCamera);
  const [transform, setTransform] = React.useState<LayerTransform>(
    createStageBakeoffLayerTransform
  );
  const [selected, setSelected] = React.useState(true);
  const [exportUrl, setExportUrl] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const artboardRect = React.useMemo(() => resolveStageBakeoffArtboardRect(), []);
  const layerGeometry = React.useMemo(
    () => resolveStageBakeoffLayerGeometry(transform),
    [transform]
  );

  React.useEffect(() => {
    let cancelled = false;
    loadStageBakeoffSampleImage().then((image) => {
      if (!cancelled) {
        setImageElement(image);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!selected || !transformerRef.current || !imageRef.current) return;
    transformerRef.current.nodes([imageRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected, transform]);

  const handleWheel = React.useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const rect = stageRef.current?.container().getBoundingClientRect();
      if (!rect) return;
      const nextScale = clampStageBakeoffZoom(camera.scale * Math.exp(-event.evt.deltaY * 0.0015));
      setCamera((current) =>
        resolveStageBakeoffZoomAboutClientPoint({
          clientX: event.evt.clientX,
          clientY: event.evt.clientY,
          viewportRect: rect,
          camera: current,
          nextScale,
        })
      );
    },
    [camera.scale]
  );

  const handleStageMouseDown = React.useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (
        event.target === event.target.getStage() ||
        event.target.name() === "artboard-background"
      ) {
        setSelected(false);
        panSessionRef.current = {
          active: true,
          startClientX: event.evt.clientX,
          startClientY: event.evt.clientY,
          startOffsetX: camera.offsetX,
          startOffsetY: camera.offsetY,
        };
        return;
      }
      setSelected(true);
    },
    [camera.offsetX, camera.offsetY]
  );

  const handleStageMouseMove = React.useCallback((event: Konva.KonvaEventObject<MouseEvent>) => {
    const session = panSessionRef.current;
    if (!session.active) return;
    setCamera((current) => ({
      ...current,
      offsetX: session.startOffsetX + (event.evt.clientX - session.startClientX),
      offsetY: session.startOffsetY + (event.evt.clientY - session.startClientY),
    }));
  }, []);

  const endPan = React.useCallback(() => {
    panSessionRef.current = createIdlePanPointerSession();
  }, []);

  const updateTransformFromNode = React.useCallback(
    (node: Konva.Image) => {
      const absoluteCenterX = node.x() + STAGE_BAKEOFF_VIEWPORT_WIDTH / 2;
      const absoluteCenterY = node.y() + STAGE_BAKEOFF_VIEWPORT_HEIGHT / 2;
      const artboardCenterX = artboardRect.left + artboardRect.width / 2;
      const artboardCenterY = artboardRect.top + artboardRect.height / 2;
      setTransform({
        translateXRatio: (absoluteCenterX - artboardCenterX) / artboardRect.width,
        translateYRatio: (absoluteCenterY - artboardCenterY) / artboardRect.height,
        scale: clampLayerScale(Math.max(node.scaleX(), node.scaleY())),
        rotationDeg: normalizeLayerRotationDeg(node.rotation()),
      });
    },
    [artboardRect.height, artboardRect.left, artboardRect.top, artboardRect.width]
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

  const imageCenterX =
    artboardRect.left + layerGeometry.transformGeometry.centerX - STAGE_BAKEOFF_VIEWPORT_WIDTH / 2;
  const imageCenterY =
    artboardRect.top + layerGeometry.transformGeometry.centerY - STAGE_BAKEOFF_VIEWPORT_HEIGHT / 2;

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
          Zoom {camera.scale.toFixed(2)}x • Drag background to pan • Built-in transformer handles
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
        <Stage
          ref={stageRef}
          width={STAGE_BAKEOFF_VIEWPORT_WIDTH}
          height={STAGE_BAKEOFF_VIEWPORT_HEIGHT}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={endPan}
          onMouseLeave={endPan}
        >
          <Layer>
            <Group
              x={STAGE_BAKEOFF_VIEWPORT_WIDTH / 2 + camera.offsetX}
              y={STAGE_BAKEOFF_VIEWPORT_HEIGHT / 2 + camera.offsetY}
              scaleX={camera.scale}
              scaleY={camera.scale}
            >
              <Rect
                name="artboard-background"
                x={artboardRect.left - STAGE_BAKEOFF_VIEWPORT_WIDTH / 2}
                y={artboardRect.top - STAGE_BAKEOFF_VIEWPORT_HEIGHT / 2}
                width={artboardRect.width}
                height={artboardRect.height}
                fill="#f7f5f1"
                stroke="rgba(15, 23, 42, 0.08)"
                strokeWidth={1}
                shadowColor="rgba(15, 23, 42, 0.18)"
                shadowBlur={28}
                shadowOffsetY={18}
              />
              {imageElement ? (
                <KonvaImage
                  ref={imageRef}
                  image={imageElement}
                  x={imageCenterX}
                  y={imageCenterY}
                  offsetX={layerGeometry.baseRect.width / 2}
                  offsetY={layerGeometry.baseRect.height / 2}
                  width={layerGeometry.baseRect.width}
                  height={layerGeometry.baseRect.height}
                  rotation={transform.rotationDeg}
                  scaleX={transform.scale}
                  scaleY={transform.scale}
                  draggable
                  onClick={() => setSelected(true)}
                  onTap={() => setSelected(true)}
                  onDragEnd={(event) => updateTransformFromNode(event.target as Konva.Image)}
                  onTransformEnd={(event) => updateTransformFromNode(event.target as Konva.Image)}
                />
              ) : null}
              {selected ? (
                <Transformer
                  ref={transformerRef}
                  rotateEnabled
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  keepRatio
                  borderStroke="#2563eb"
                  anchorFill="#2563eb"
                  anchorStroke="#f8fafc"
                  anchorCornerRadius={12}
                />
              ) : null}
            </Group>
          </Layer>
        </Stage>
      </div>

      {exportUrl ? (
        <div style={{ display: "grid", gap: "10px" }}>
          <strong>Latest export</strong>
          <img
            src={exportUrl}
            alt="Konva candidate export preview"
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

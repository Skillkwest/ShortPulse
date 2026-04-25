/**
 * Geometry helpers for the AI Studio Canvas workspace.
 * Keeps camera transforms and world/screen coordinate math separate from UI event handlers.
 */
import type { CanvasCamera } from "./canvasTypes";

export const CANVAS_DEFAULT_CAMERA: CanvasCamera = {
  x: 0,
  y: 0,
  zoom: 1,
};

export const CANVAS_MIN_ZOOM = 0.2;
export const CANVAS_MAX_ZOOM = 2.5;
export const CANVAS_IMAGE_ITEM_WIDTH = 220;
export const CANVAS_IMAGE_ITEM_HEIGHT = 275;
export const CANVAS_AUDIO_ITEM_WIDTH = 160;
export const CANVAS_AUDIO_ITEM_HEIGHT = 200;
export const CANVAS_TEXT_ITEM_WIDTH = 260;
export const CANVAS_TEXT_ITEM_MIN_HEIGHT = 120;
const CANVAS_IMAGE_PROXY_LONG_EDGE = Math.max(CANVAS_IMAGE_ITEM_WIDTH, CANVAS_IMAGE_ITEM_HEIGHT);

const roundCanvasCoordinate = (value: number): number => Math.round(value * 100) / 100;

/**
 * Constrains camera zoom to the supported V1 range.
 */
export const clampCanvasZoom = (zoom: number): number =>
  Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, zoom));

/**
 * Fits an image into the Canvas proxy-size envelope while preserving its true aspect ratio.
 */
export const fitCanvasImageToProxyFrame = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): { width: number; height: number } => {
  if (!(width > 0) || !(height > 0)) {
    return {
      width: CANVAS_IMAGE_ITEM_WIDTH,
      height: CANVAS_IMAGE_ITEM_HEIGHT,
    };
  }
  const longEdge = Math.max(width, height);
  const scale = longEdge > 0 ? CANVAS_IMAGE_PROXY_LONG_EDGE / longEdge : 1;
  return {
    width: roundCanvasCoordinate(width * scale),
    height: roundCanvasCoordinate(height * scale),
  };
};

/**
 * Normalizes wheel motion into a smoother zoom delta.
 * Small trackpad deltas stay subtle, while larger wheel steps still move quickly enough.
 */
export const resolveCanvasWheelZoomDelta = ({
  deltaY,
  deltaMode,
}: {
  deltaY: number;
  deltaMode: number;
}): number => {
  const modeScale = deltaMode === 1 ? 16 : deltaMode === 2 ? 120 : 1;
  const scaledDeltaY = deltaY * modeScale;
  const magnitude = Math.abs(scaledDeltaY);
  if (magnitude < 4) return 0;
  const zoomDelta = Math.min(0.11, 0.015 + (magnitude - 4) * 0.001);
  return scaledDeltaY < 0 ? zoomDelta : -zoomDelta;
};

/**
 * Converts a viewport-space pointer position into world-space coordinates.
 */
export const viewportPointToCanvasWorld = ({
  clientX,
  clientY,
  rect,
  camera,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  camera: CanvasCamera;
}): { x: number; y: number } => {
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: roundCanvasCoordinate((localX - camera.x) / camera.zoom),
    y: roundCanvasCoordinate((localY - camera.y) / camera.zoom),
  };
};

/**
 * Returns a new camera value that keeps the current pointer anchored while zoom changes.
 */
export const zoomCanvasCameraAtViewportPoint = ({
  camera,
  clientX,
  clientY,
  rect,
  nextZoom,
}: {
  camera: CanvasCamera;
  clientX: number;
  clientY: number;
  rect: DOMRect;
  nextZoom: number;
}): CanvasCamera => {
  const clampedZoom = clampCanvasZoom(nextZoom);
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const worldX = (localX - camera.x) / camera.zoom;
  const worldY = (localY - camera.y) / camera.zoom;
  return {
    x: roundCanvasCoordinate(localX - worldX * clampedZoom),
    y: roundCanvasCoordinate(localY - worldY * clampedZoom),
    zoom: clampedZoom,
  };
};

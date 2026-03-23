/**
 * Cursor data-URI builders for Expert Edit inpaint/markup tools.
 */
import { resolveInpaintBrushDiameter } from "./inpaintMaskGeometry";

const MARKUP_CURSOR_DIAMETER_MIN = 1;
const INPAINT_CURSOR_DIAMETER_MIN = 8;
const INPAINT_CURSOR_DIAMETER_MAX = 52;
const CURSOR_PADDING = 6;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const buildInpaintBrushReticleCursor = (strokeSize: number, sceneScale = 1) => {
  const baseDiameter = Math.min(
    INPAINT_CURSOR_DIAMETER_MAX,
    Math.max(INPAINT_CURSOR_DIAMETER_MIN, resolveInpaintBrushDiameter(strokeSize))
  );
  const safeScale = Number.isFinite(sceneScale) && sceneScale > 0 ? sceneScale : 1;
  const diameter = Math.max(1, baseDiameter * safeScale);
  const canvasSize = diameter + CURSOR_PADDING * 2;
  const center = canvasSize / 2;
  const radius = diameter / 2;
  const ringStrokeWidth = diameter >= 34 ? 2 : 1.6;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(0,0,0,0.8)" stroke-width="${ringStrokeWidth + 1}" />
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(245,249,255,0.98)" stroke-width="${ringStrokeWidth}" />
    </svg>
  `.trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
};

export const buildMarkupBrushReticleCursor = (
  strokeSize: number,
  maxStrokeSize: number,
  renderScale = 1
) => {
  const safeScale = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
  const diameter = clampNumber(
    Math.round(strokeSize * safeScale),
    MARKUP_CURSOR_DIAMETER_MIN,
    maxStrokeSize
  );
  const canvasSize = diameter + CURSOR_PADDING * 2;
  const center = canvasSize / 2;
  const radius = diameter / 2;
  const ringStrokeWidth = diameter >= 18 ? 2 : 1.5;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(0,0,0,0.8)" stroke-width="${ringStrokeWidth + 1}" />
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(245,249,255,0.98)" stroke-width="${ringStrokeWidth}" />
    </svg>
  `.trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
};

export const buildInpaintLassoCursor = () => {
  const cursorSize = 28;
  const center = 9;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}" viewBox="0 0 ${cursorSize} ${cursorSize}">
      <g id="lasso-cursor">
        <path d="M9 2.6c3.8 0 6.9 2.9 6.9 6.4s-3.1 6.4-6.9 6.4S2.1 12.5 2.1 9s3.1-6.4 6.9-6.4Z" fill="none" stroke="rgba(0,0,0,0.86)" stroke-width="2.2" />
        <path d="M9 2.6c3.8 0 6.9 2.9 6.9 6.4s-3.1 6.4-6.9 6.4S2.1 12.5 2.1 9s3.1-6.4 6.9-6.4Z" fill="none" stroke="rgba(245,185,66,0.98)" stroke-width="1.4" />
        <path d="M13.9 13.5l5.4 5.4" fill="none" stroke="rgba(0,0,0,0.86)" stroke-width="2.4" stroke-linecap="round" />
        <path d="M13.9 13.5l5.4 5.4" fill="none" stroke="rgba(245,185,66,0.98)" stroke-width="1.4" stroke-linecap="round" />
      </g>
    </svg>
  `.trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
};

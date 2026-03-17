import {
  mapPixelPointBetweenSpacesViaScene,
  resolveSceneMappedDrawRect,
} from "./stageSceneGeometry";
import type { InpaintPoint } from "./inpaintMaskGeometry";

export type MaskLayerMeta = {
  hasContent: boolean;
  width: number;
  height: number;
  contourSegments: number[];
  contourPaths: number[][];
};

const MARCHING_ANTS_PHASE_MODULO = 120;
export const INPAINT_MARCHING_ANTS_STEP_MS = 110;
export const INPAINT_MARCHING_ANTS_DASH_PATTERN = [6, 4] as const;
const MARCHING_ANTS_DASH_OFFSET_STEP = 1;
const LASSO_PREVIEW_ANTS_PHYSICAL_PX = 1.35;
const LASSO_PREVIEW_GUIDE_STROKE_WIDTH = 1.7;
const LASSO_THEME_FILL = "rgba(245, 185, 66, 0.32)";
const LASSO_THEME_GUIDE = "rgba(245, 185, 66, 0.86)";
const LASSO_THEME_ANCHOR = "rgba(255, 204, 84, 0.99)";
const LASSO_THEME_ENDPOINT = "rgba(255, 238, 180, 0.99)";
const LASSO_THEME_MARCH_DARK = "rgba(43, 28, 5, 0.98)";
const LASSO_THEME_MARCH_LIGHT = "rgba(255, 245, 198, 1)";
const MASK_CONTOUR_MARCH_DARK = "rgba(52, 36, 8, 0.72)";
const MASK_CONTOUR_MARCH_LIGHT = "rgba(255, 234, 170, 0.88)";

type MarchingAntPhaseState = {
  phase: number;
  lastTickMs: number;
};

type DerivedMaskContour = {
  hasContent: boolean;
  contourSegments: number[];
  contourPaths: number[][];
};

type ContourEdge = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startKey: string;
  endKey: string;
};

const toContourPointKey = (x: number, y: number) => `${x},${y}`;

const resolveLassoAntStrokeWidth = (dpr: number) =>
  LASSO_PREVIEW_ANTS_PHYSICAL_PX / Math.max(1, dpr);

const tracePolylinePath = (ctx: CanvasRenderingContext2D, points: InpaintPoint[]) => {
  if (!points.length) return;
  const firstPoint = points[0]!;
  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    ctx.lineTo(point.x, point.y);
  }
};

export const mapLassoPreviewPointsToOverlaySpace = ({
  points,
  maskWidth,
  maskHeight,
  overlayWidth,
  overlayHeight,
}: {
  points: Array<{ x: number; y: number }>;
  maskWidth: number;
  maskHeight: number;
  overlayWidth: number;
  overlayHeight: number;
}) => {
  if (!points.length) return points;
  if (
    !Number.isFinite(maskWidth) ||
    !Number.isFinite(maskHeight) ||
    !Number.isFinite(overlayWidth) ||
    !Number.isFinite(overlayHeight) ||
    maskWidth <= 0 ||
    maskHeight <= 0 ||
    overlayWidth <= 0 ||
    overlayHeight <= 0
  ) {
    return points;
  }
  const scaleX = overlayWidth / maskWidth;
  const scaleY = overlayHeight / maskHeight;
  if (Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001) {
    return points;
  }
  return points.map((point) =>
    mapPixelPointBetweenSpacesViaScene({
      point,
      fromWidth: maskWidth,
      fromHeight: maskHeight,
      toWidth: overlayWidth,
      toHeight: overlayHeight,
      clampToBounds: true,
    })
  );
};

export const resolveNextMarchingAntPhaseState = ({
  phase,
  lastTickMs,
  nowMs,
}: MarchingAntPhaseState & { nowMs: number }): MarchingAntPhaseState => {
  if (!lastTickMs) {
    return {
      phase,
      lastTickMs: nowMs,
    };
  }
  if (nowMs - lastTickMs < INPAINT_MARCHING_ANTS_STEP_MS) {
    return {
      phase,
      lastTickMs,
    };
  }
  return {
    phase: (phase + 1) % MARCHING_ANTS_PHASE_MODULO,
    lastTickMs: nowMs,
  };
};

export const buildContourPathsFromSegments = (contourSegments: number[]): number[][] => {
  if (contourSegments.length < 4) return [];

  const edges: ContourEdge[] = [];
  for (let index = 0; index < contourSegments.length; index += 4) {
    const startX = contourSegments[index];
    const startY = contourSegments[index + 1];
    const endX = contourSegments[index + 2];
    const endY = contourSegments[index + 3];
    if (
      typeof startX !== "number" ||
      typeof startY !== "number" ||
      typeof endX !== "number" ||
      typeof endY !== "number"
    ) {
      continue;
    }
    if (startX === endX && startY === endY) continue;
    edges.push({
      startX,
      startY,
      endX,
      endY,
      startKey: toContourPointKey(startX, startY),
      endKey: toContourPointKey(endX, endY),
    });
  }

  if (!edges.length) return [];

  const outgoingByStart = new Map<string, number[]>();
  edges.forEach((edge, edgeIndex) => {
    const entry = outgoingByStart.get(edge.startKey);
    if (entry) {
      entry.push(edgeIndex);
      return;
    }
    outgoingByStart.set(edge.startKey, [edgeIndex]);
  });

  const edgeUsed = new Uint8Array(edges.length);
  const paths: number[][] = [];

  const resolveNextEdgeIndex = (currentKey: string, previousKey: string | null): number | null => {
    const candidates = outgoingByStart.get(currentKey);
    if (!candidates?.length) return null;
    let fallback: number | null = null;
    for (const candidateIndex of candidates) {
      if (edgeUsed[candidateIndex]) continue;
      const candidate = edges[candidateIndex];
      if (!candidate) continue;
      if (previousKey != null && candidate.endKey === previousKey) {
        if (fallback == null) fallback = candidateIndex;
        continue;
      }
      return candidateIndex;
    }
    return fallback;
  };

  edges.forEach((edge, edgeIndex) => {
    if (edgeUsed[edgeIndex]) return;
    edgeUsed[edgeIndex] = 1;

    const path: number[] = [edge.startX, edge.startY, edge.endX, edge.endY];
    const startKey = edge.startKey;
    let previousKey: string | null = edge.startKey;
    let currentKey: string = edge.endKey;
    let guard = 0;
    const guardLimit = edges.length + 1;

    while (currentKey !== startKey && guard < guardLimit) {
      const nextEdgeIndex = resolveNextEdgeIndex(currentKey, previousKey);
      if (nextEdgeIndex == null) break;
      const nextEdge = edges[nextEdgeIndex];
      if (!nextEdge) break;
      edgeUsed[nextEdgeIndex] = 1;
      path.push(nextEdge.endX, nextEdge.endY);
      previousKey = currentKey;
      currentKey = nextEdge.endKey;
      guard += 1;
    }

    if (path.length >= 4) {
      paths.push(path);
    }
  });

  return paths;
};

export const deriveMaskContourFromAlpha = (
  width: number,
  height: number,
  data: Uint8ClampedArray
): DerivedMaskContour => {
  if (width <= 0 || height <= 0) {
    return { hasContent: false, contourSegments: [], contourPaths: [] };
  }

  const contourSegments: number[] = [];
  let hasContent = false;
  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return data[(y * width + x) * 4 + 3] ?? 0;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) <= 0) continue;
      hasContent = true;

      if (alphaAt(x, y - 1) <= 0) {
        contourSegments.push(x, y, x + 1, y);
      }
      if (alphaAt(x + 1, y) <= 0) {
        contourSegments.push(x + 1, y, x + 1, y + 1);
      }
      if (alphaAt(x, y + 1) <= 0) {
        contourSegments.push(x + 1, y + 1, x, y + 1);
      }
      if (alphaAt(x - 1, y) <= 0) {
        contourSegments.push(x, y + 1, x, y);
      }
    }
  }

  const contourPaths = buildContourPathsFromSegments(contourSegments);

  return {
    hasContent,
    contourSegments,
    contourPaths,
  };
};

export const analyzeMaskCanvas = (canvas: HTMLCanvasElement): MaskLayerMeta => {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || width <= 0 || height <= 0) {
    return {
      hasContent: false,
      width,
      height,
      contourSegments: [],
      contourPaths: [],
    };
  }
  const imageData = ctx.getImageData(0, 0, width, height);
  const derivedContour = deriveMaskContourFromAlpha(width, height, imageData.data);

  return {
    hasContent: derivedContour.hasContent,
    width,
    height,
    contourSegments: derivedContour.contourSegments,
    contourPaths: derivedContour.contourPaths,
  };
};

export const renderOverlayFrame = ({
  canvas,
  maskCanvas,
  meta,
  lassoPreviewPoints,
  phase,
}: {
  canvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement | null;
  meta: MaskLayerMeta | null;
  lassoPreviewPoints: InpaintPoint[];
  phase: number;
}) => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (maskCanvas && meta?.hasContent) {
    ctx.save();
    const drawRect = resolveSceneMappedDrawRect({
      sourceWidth: maskCanvas.width,
      sourceHeight: maskCanvas.height,
      targetWidth: width,
      targetHeight: height,
    });
    ctx.drawImage(maskCanvas, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "rgba(255, 0, 60, 0.58)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (meta.width > 0 && meta.height > 0 && meta.contourSegments.length > 0) {
      const [dashSize, dashGap] = INPAINT_MARCHING_ANTS_DASH_PATTERN;
      const baseOffset = -(phase * MARCHING_ANTS_DASH_OFFSET_STEP);
      const contourStrokeWidth = 1 / dpr;
      const contourPaths = meta.contourPaths;
      const resolveOverlayPoint = (x: number, y: number) =>
        mapPixelPointBetweenSpacesViaScene({
          point: { x, y },
          fromWidth: meta.width,
          fromHeight: meta.height,
          toWidth: width,
          toHeight: height,
          clampToBounds: true,
        });
      const drawContourStroke = (strokeStyle: string, lineDashOffset: number) => {
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = contourStrokeWidth;
        ctx.setLineDash([dashSize, dashGap]);
        ctx.lineDashOffset = lineDashOffset;
        ctx.beginPath();
        if (contourPaths.length > 0) {
          for (const path of contourPaths) {
            if (path.length < 4) continue;
            const firstPoint = resolveOverlayPoint(path[0] ?? 0, path[1] ?? 0);
            ctx.moveTo(firstPoint.x, firstPoint.y);
            for (let pointIndex = 2; pointIndex < path.length; pointIndex += 2) {
              const pathX = path[pointIndex] ?? 0;
              const pathY = path[pointIndex + 1] ?? 0;
              const mappedPoint = resolveOverlayPoint(pathX, pathY);
              ctx.lineTo(mappedPoint.x, mappedPoint.y);
            }
          }
        } else {
          for (let index = 0; index < meta.contourSegments.length; index += 4) {
            const x1 = meta.contourSegments[index] ?? 0;
            const y1 = meta.contourSegments[index + 1] ?? 0;
            const x2 = meta.contourSegments[index + 2] ?? 0;
            const y2 = meta.contourSegments[index + 3] ?? 0;
            const start = resolveOverlayPoint(x1, y1);
            const end = resolveOverlayPoint(x2, y2);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
          }
        }
        ctx.stroke();
        ctx.restore();
      };

      drawContourStroke(MASK_CONTOUR_MARCH_DARK, baseOffset);
      drawContourStroke(MASK_CONTOUR_MARCH_LIGHT, baseOffset + dashSize);
    }
  }

  const lassoRenderPoints = mapLassoPreviewPointsToOverlaySpace({
    points: lassoPreviewPoints,
    maskWidth: maskCanvas?.width ?? width,
    maskHeight: maskCanvas?.height ?? height,
    overlayWidth: width,
    overlayHeight: height,
  });

  if (lassoRenderPoints.length > 0) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const firstPoint = lassoRenderPoints[0]!;
    const lastPoint = lassoRenderPoints[lassoRenderPoints.length - 1]!;
    const [dashSize, dashGap] = INPAINT_MARCHING_ANTS_DASH_PATTERN;
    const baseOffset = -(phase * MARCHING_ANTS_DASH_OFFSET_STEP);
    const lassoAntStrokeWidth = resolveLassoAntStrokeWidth(dpr);

    if (lassoRenderPoints.length > 1) {
      if (lassoRenderPoints.length > 2) {
        ctx.fillStyle = LASSO_THEME_FILL;
        tracePolylinePath(ctx, lassoRenderPoints);
        ctx.closePath();
        ctx.fill();
      }

      ctx.setLineDash([]);
      ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH + 1.1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
      tracePolylinePath(ctx, lassoRenderPoints);
      ctx.stroke();

      ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH;
      ctx.strokeStyle = LASSO_THEME_GUIDE;
      tracePolylinePath(ctx, lassoRenderPoints);
      ctx.stroke();

      ctx.lineWidth = lassoAntStrokeWidth;
      ctx.setLineDash([dashSize, dashGap]);
      ctx.lineDashOffset = baseOffset;
      ctx.strokeStyle = LASSO_THEME_MARCH_DARK;
      tracePolylinePath(ctx, lassoRenderPoints);
      ctx.stroke();
      ctx.lineDashOffset = baseOffset + dashSize;
      ctx.strokeStyle = LASSO_THEME_MARCH_LIGHT;
      tracePolylinePath(ctx, lassoRenderPoints);
      ctx.stroke();

      if (lassoRenderPoints.length > 2) {
        ctx.setLineDash([]);
        ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH + 0.95;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.66)";
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        ctx.stroke();

        ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH;
        ctx.strokeStyle = LASSO_THEME_GUIDE;
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        ctx.stroke();

        ctx.lineWidth = lassoAntStrokeWidth;
        ctx.setLineDash([dashSize, dashGap]);
        ctx.lineDashOffset = baseOffset + dashSize;
        ctx.strokeStyle = LASSO_THEME_MARCH_LIGHT;
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.fillStyle = LASSO_THEME_ANCHOR;
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, 3.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = LASSO_THEME_ENDPOINT;
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pulseRadius = 4.2 + ((phase % 12) / 12) * 1.2;
      ctx.setLineDash([]);
      ctx.lineWidth = 1.65;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.74)";
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, pulseRadius + 1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = LASSO_THEME_ANCHOR;
      ctx.lineWidth = Math.max(lassoAntStrokeWidth, 1);
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = LASSO_THEME_ANCHOR;
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};

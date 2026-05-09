import {
  mapSurfacePointToMaskCanvasPoint,
  resolveInpaintBrushPaintRadius,
  resolveMaskInteractionPoint,
  resolveMaskSpaceScaleFromSurface,
  type InpaintPoint,
} from "./inpaintMaskGeometry";

type ResolveClientPointToSurfacePoint = (params: {
  clientX: number;
  clientY: number;
  currentTarget: HTMLDivElement;
  clampToBounds: boolean;
}) => InpaintPoint | null;

type ViewportOffsets = {
  viewportOffsetX: number;
  viewportOffsetY: number;
};

type PointSampleLike = {
  clientX: number;
  clientY: number;
};

export const resolveMaskLogicalInteractionRect = ({
  currentTarget,
  interactionRect,
}: {
  currentTarget: HTMLDivElement;
  interactionRect: DOMRect;
}) =>
  new DOMRect(
    0,
    0,
    Math.max(1, currentTarget.clientWidth || interactionRect.width),
    Math.max(1, currentTarget.clientHeight || interactionRect.height)
  );

const resolveMaskCanvasInteractionPointForClampMode = ({
  sampleEvent,
  currentTarget,
  interactionRect,
  logicalInteractionRect,
  maskWidth,
  maskHeight,
  sceneScale,
  viewportOffsets,
  resolveClientPointToSurfacePoint,
  clampToBounds,
}: {
  sampleEvent: PointSampleLike;
  currentTarget: HTMLDivElement;
  interactionRect: DOMRect;
  logicalInteractionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
  sceneScale: number;
  viewportOffsets: ViewportOffsets;
  resolveClientPointToSurfacePoint?: ResolveClientPointToSurfacePoint;
  clampToBounds: boolean;
}) => {
  const resolvedSurfacePoint =
    resolveClientPointToSurfacePoint?.({
      clientX: sampleEvent.clientX,
      clientY: sampleEvent.clientY,
      currentTarget,
      clampToBounds,
    }) ?? null;
  if (resolvedSurfacePoint != null) {
    return mapSurfacePointToMaskCanvasPoint({
      point: resolvedSurfacePoint,
      interactionRect: logicalInteractionRect,
      maskWidth,
      maskHeight,
    });
  }
  return resolveMaskInteractionPoint({
    sampleEvent,
    interactionRect,
    maskWidth,
    maskHeight,
    sceneScale,
    ...viewportOffsets,
    clampToBounds,
  });
};

export const resolveMaskCanvasInteractionPointWithFallback = ({
  sampleEvent,
  currentTarget,
  interactionRect,
  logicalInteractionRect,
  maskWidth,
  maskHeight,
  sceneScale,
  viewportOffsets,
  resolveClientPointToSurfacePoint,
}: {
  sampleEvent: PointSampleLike;
  currentTarget: HTMLDivElement;
  interactionRect: DOMRect;
  logicalInteractionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
  sceneScale: number;
  viewportOffsets: ViewportOffsets;
  resolveClientPointToSurfacePoint?: ResolveClientPointToSurfacePoint;
}) =>
  resolveMaskCanvasInteractionPointForClampMode({
    sampleEvent,
    currentTarget,
    interactionRect,
    logicalInteractionRect,
    maskWidth,
    maskHeight,
    sceneScale,
    viewportOffsets,
    resolveClientPointToSurfacePoint,
    clampToBounds: false,
  }) ??
  resolveMaskCanvasInteractionPointForClampMode({
    sampleEvent,
    currentTarget,
    interactionRect,
    logicalInteractionRect,
    maskWidth,
    maskHeight,
    sceneScale,
    viewportOffsets,
    resolveClientPointToSurfacePoint,
    clampToBounds: true,
  });

export const resolveMaskCanvasBrushRadius = ({
  logicalInteractionRect,
  maskWidth,
  maskHeight,
  strokeSize,
}: {
  logicalInteractionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
  strokeSize: number;
}) => {
  const surfaceToMaskScale = resolveMaskSpaceScaleFromSurface({
    surfaceWidth: logicalInteractionRect.width,
    surfaceHeight: logicalInteractionRect.height,
    maskWidth,
    maskHeight,
  });
  return resolveInpaintBrushPaintRadius({
    strokeSize,
    surfaceToMaskScale,
  });
};

import {
  mapSurfacePointToMaskCanvasPoint,
  resolveImageRectForContain,
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

const resolveMaskImageInteractionRect = ({
  logicalInteractionRect,
  maskWidth,
  maskHeight,
}: {
  logicalInteractionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
}) => {
  const imageRect = resolveImageRectForContain(
    logicalInteractionRect.width,
    logicalInteractionRect.height,
    maskWidth,
    maskHeight
  );
  return new DOMRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
};

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
  const imageInteractionRect = resolveMaskImageInteractionRect({
    logicalInteractionRect,
    maskWidth,
    maskHeight,
  });
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
      interactionRect: imageInteractionRect,
      maskWidth,
      maskHeight,
    });
  }
  return resolveMaskInteractionPoint({
    sampleEvent,
    interactionRect,
    mappingRect: imageInteractionRect,
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
  const imageInteractionRect = resolveMaskImageInteractionRect({
    logicalInteractionRect,
    maskWidth,
    maskHeight,
  });
  const surfaceToMaskScale = resolveMaskSpaceScaleFromSurface({
    surfaceWidth: imageInteractionRect.width,
    surfaceHeight: imageInteractionRect.height,
    maskWidth,
    maskHeight,
  });
  return resolveInpaintBrushPaintRadius({
    strokeSize,
    surfaceToMaskScale,
  });
};

import {
  mapPixelPointBetweenSpacesViaScene,
  resolveIsotropicScaleBetweenSpaces,
  resolveSurfacePointFromClientPoint,
  resolveSurfacePointFromViewportSamplePoint,
} from "./stageSceneGeometry";

export type InpaintPoint = {
  x: number;
  y: number;
};

export type InpaintImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MaskExportSourceWindow = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const resolveSceneCanvasPoint = ({
  clientX,
  clientY,
  rect,
  sceneScale,
  viewportOffsetX = 0,
  viewportOffsetY = 0,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  sceneScale: number;
  viewportOffsetX?: number;
  viewportOffsetY?: number;
}): InpaintPoint => {
  const samplePoint = {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
  return resolveSurfacePointFromViewportSamplePoint({
    point: samplePoint,
    viewportTransform: {
      scale: sceneScale,
      offsetX: viewportOffsetX,
      offsetY: viewportOffsetY,
    },
    viewportWidth: rect.width,
    viewportHeight: rect.height,
  });
};

const toSurfaceCanvasPoint = (
  event: { clientX: number; clientY: number },
  rect: DOMRect,
  sceneScale = 1,
  viewportOffsetX = 0,
  viewportOffsetY = 0
): InpaintPoint | null => {
  return resolveSurfacePointFromClientPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    rect,
    viewportTransform: {
      scale: sceneScale,
      offsetX: viewportOffsetX,
      offsetY: viewportOffsetY,
    },
    clampToBounds: false,
  });
};

export const toClampedCanvasPoint = (
  event: { clientX: number; clientY: number },
  rect: DOMRect,
  sceneScale = 1,
  viewportOffsetX = 0,
  viewportOffsetY = 0
): InpaintPoint => {
  const point = resolveSurfacePointFromClientPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    rect,
    viewportTransform: {
      scale: sceneScale,
      offsetX: viewportOffsetX,
      offsetY: viewportOffsetY,
    },
    clampToBounds: true,
  });
  if (point) {
    return point;
  }
  return {
    x: 0,
    y: 0,
  };
};

export const mapSurfacePointToMaskCanvasPoint = ({
  point,
  interactionRect,
  maskWidth,
  maskHeight,
}: {
  point: InpaintPoint;
  interactionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
}): InpaintPoint => {
  const sourceWidth = Math.max(1, interactionRect.width);
  const sourceHeight = Math.max(1, interactionRect.height);
  const targetWidth = Math.max(1, Math.round(maskWidth));
  const targetHeight = Math.max(1, Math.round(maskHeight));
  return mapPixelPointBetweenSpacesViaScene({
    point,
    fromWidth: sourceWidth,
    fromHeight: sourceHeight,
    toWidth: targetWidth,
    toHeight: targetHeight,
    clampToBounds: true,
  });
};

export const resolveImageRectForContain = (
  dropzoneWidth: number,
  dropzoneHeight: number,
  naturalWidth: number,
  naturalHeight: number
): InpaintImageRect => {
  if (naturalWidth <= 0 || naturalHeight <= 0 || dropzoneWidth <= 0 || dropzoneHeight <= 0) {
    return {
      x: 0,
      y: 0,
      width: dropzoneWidth,
      height: dropzoneHeight,
    };
  }
  const scale = Math.min(dropzoneWidth / naturalWidth, dropzoneHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    x: (dropzoneWidth - width) / 2,
    y: (dropzoneHeight - height) / 2,
    width,
    height,
  };
};

export const resolveMaskExportSourceWindow = ({
  imageRect,
  maskWidth,
  maskHeight,
}: {
  imageRect: InpaintImageRect | null;
  maskWidth: number;
  maskHeight: number;
}): MaskExportSourceWindow | null => {
  if (maskWidth <= 0 || maskHeight <= 0) return null;
  if (!imageRect) {
    return {
      sx: 0,
      sy: 0,
      sw: maskWidth,
      sh: maskHeight,
    };
  }
  const sx = clamp(Math.floor(imageRect.x), 0, maskWidth);
  const sy = clamp(Math.floor(imageRect.y), 0, maskHeight);
  const endX = clamp(Math.ceil(imageRect.x + imageRect.width), 0, maskWidth);
  const endY = clamp(Math.ceil(imageRect.y + imageRect.height), 0, maskHeight);
  const sw = Math.max(0, endX - sx);
  const sh = Math.max(0, endY - sy);
  if (sw <= 0 || sh <= 0) return null;
  return {
    sx,
    sy,
    sw,
    sh,
  };
};

export const resolveInpaintBrushDiameter = (strokeSize: number) => {
  const clampedStrokeSize = clamp(strokeSize, 1, 100);
  const mappedDiameter = Math.round(6 + clampedStrokeSize * 0.46);
  return clamp(mappedDiameter, 8, 52);
};

export const resolveMaskSpaceScaleFromSurface = ({
  surfaceWidth,
  surfaceHeight,
  maskWidth,
  maskHeight,
}: {
  surfaceWidth: number;
  surfaceHeight: number;
  maskWidth: number;
  maskHeight: number;
}) => {
  if (
    !Number.isFinite(surfaceWidth) ||
    !Number.isFinite(surfaceHeight) ||
    !Number.isFinite(maskWidth) ||
    !Number.isFinite(maskHeight) ||
    surfaceWidth <= 0 ||
    surfaceHeight <= 0 ||
    maskWidth <= 0 ||
    maskHeight <= 0
  ) {
    return 1;
  }
  return resolveIsotropicScaleBetweenSpaces({
    fromHeight: surfaceHeight,
    toHeight: maskHeight,
  });
};

export const resolveInpaintBrushPaintRadius = ({
  strokeSize,
  surfaceToMaskScale = 1,
}: {
  strokeSize: number;
  surfaceToMaskScale?: number;
}) => {
  const diameter = resolveInpaintBrushDiameter(strokeSize);
  const safeSurfaceToMaskScale =
    Number.isFinite(surfaceToMaskScale) && surfaceToMaskScale > 0 ? surfaceToMaskScale : 1;
  return (diameter / 2) * safeSurfaceToMaskScale;
};

export const resolveMaskInteractionPoint = ({
  sampleEvent,
  interactionRect,
  maskWidth,
  maskHeight,
  sceneScale,
  viewportOffsetX = 0,
  viewportOffsetY = 0,
  clampToBounds,
}: {
  sampleEvent: { clientX: number; clientY: number };
  interactionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
  sceneScale: number;
  viewportOffsetX?: number;
  viewportOffsetY?: number;
  clampToBounds: boolean;
}): InpaintPoint | null => {
  const surfacePoint = clampToBounds
    ? toClampedCanvasPoint(
        sampleEvent,
        interactionRect,
        sceneScale,
        viewportOffsetX,
        viewportOffsetY
      )
    : toSurfaceCanvasPoint(
        sampleEvent,
        interactionRect,
        sceneScale,
        viewportOffsetX,
        viewportOffsetY
      );
  if (!surfacePoint) return null;
  return mapSurfacePointToMaskCanvasPoint({
    point: surfacePoint,
    interactionRect,
    maskWidth,
    maskHeight,
  });
};

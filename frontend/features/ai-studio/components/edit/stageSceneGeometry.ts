/**
 * Shared isotropic scene-space helpers for Expert Edit stage interactions.
 * Scene units are centered and height-normalized so aspect changes only reframe/crop content.
 */

export type ScenePoint = {
  x: number;
  y: number;
};

export type StageSurfacePoint = {
  x: number;
  y: number;
};

export type StageViewportTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const resolveSafeDimensions = ({ width, height }: { width: number; height: number }) => ({
  width: Math.max(1, Number.isFinite(width) ? width : 1),
  height: Math.max(1, Number.isFinite(height) ? height : 1),
});

const resolveSafeViewportTransform = ({
  scale,
  offsetX,
  offsetY,
}: StageViewportTransform): StageViewportTransform => ({
  scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  offsetX: Number.isFinite(offsetX) ? offsetX : 0,
  offsetY: Number.isFinite(offsetY) ? offsetY : 0,
});

/**
 * Maps a pixel-space point into centered, height-normalized scene space.
 */
export const resolveScenePointFromPixelSpace = ({
  x,
  y,
  spaceWidth,
  spaceHeight,
}: {
  x: number;
  y: number;
  spaceWidth: number;
  spaceHeight: number;
}): ScenePoint => {
  const safeSize = resolveSafeDimensions({ width: spaceWidth, height: spaceHeight });
  const centerX = safeSize.width / 2;
  const centerY = safeSize.height / 2;
  return {
    x: (x - centerX) / safeSize.height,
    y: (y - centerY) / safeSize.height,
  };
};

/**
 * Maps a scene-space point into pixel space for a target surface.
 */
export const resolvePixelPointFromSceneSpace = ({
  point,
  spaceWidth,
  spaceHeight,
  clampToBounds = false,
}: {
  point: ScenePoint;
  spaceWidth: number;
  spaceHeight: number;
  clampToBounds?: boolean;
}) => {
  const safeSize = resolveSafeDimensions({ width: spaceWidth, height: spaceHeight });
  const centerX = safeSize.width / 2;
  const centerY = safeSize.height / 2;
  const rawX = centerX + point.x * safeSize.height;
  const rawY = centerY + point.y * safeSize.height;
  if (!clampToBounds) {
    return {
      x: rawX,
      y: rawY,
    };
  }
  return {
    x: clamp(rawX, 0, safeSize.width),
    y: clamp(rawY, 0, safeSize.height),
  };
};

/**
 * Maps a pixel-space point across surfaces through scene space.
 */
export const mapPixelPointBetweenSpacesViaScene = ({
  point,
  fromWidth,
  fromHeight,
  toWidth,
  toHeight,
  clampToBounds = false,
}: {
  point: { x: number; y: number };
  fromWidth: number;
  fromHeight: number;
  toWidth: number;
  toHeight: number;
  clampToBounds?: boolean;
}) => {
  const scenePoint = resolveScenePointFromPixelSpace({
    x: point.x,
    y: point.y,
    spaceWidth: fromWidth,
    spaceHeight: fromHeight,
  });
  return resolvePixelPointFromSceneSpace({
    point: scenePoint,
    spaceWidth: toWidth,
    spaceHeight: toHeight,
    clampToBounds,
  });
};

/**
 * Maps an axis-aligned rectangle across surfaces through scene space.
 */
export const mapPixelRectBetweenSpacesViaScene = ({
  rect,
  fromWidth,
  fromHeight,
  toWidth,
  toHeight,
}: {
  rect: { x: number; y: number; width: number; height: number } | null;
  fromWidth: number;
  fromHeight: number;
  toWidth: number;
  toHeight: number;
}) => {
  if (!rect) return null;
  const topLeft = mapPixelPointBetweenSpacesViaScene({
    point: { x: rect.x, y: rect.y },
    fromWidth,
    fromHeight,
    toWidth,
    toHeight,
    clampToBounds: true,
  });
  const bottomRight = mapPixelPointBetweenSpacesViaScene({
    point: { x: rect.x + rect.width, y: rect.y + rect.height },
    fromWidth,
    fromHeight,
    toWidth,
    toHeight,
    clampToBounds: true,
  });
  const left = Math.min(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const right = Math.max(topLeft.x, bottomRight.x);
  const bottom = Math.max(topLeft.y, bottomRight.y);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

/**
 * Maps an untransformed stage surface point into viewport-transformed sample space.
 */
export const resolveViewportSamplePointFromSurfacePoint = ({
  point,
  viewportTransform,
  viewportWidth,
  viewportHeight,
}: {
  point: StageSurfacePoint;
  viewportTransform: StageViewportTransform;
  viewportWidth: number;
  viewportHeight: number;
}): StageSurfacePoint => {
  const safeSize = resolveSafeDimensions({ width: viewportWidth, height: viewportHeight });
  const safeTransform = resolveSafeViewportTransform(viewportTransform);
  const centerX = safeSize.width / 2;
  const centerY = safeSize.height / 2;
  return {
    x: centerX + safeTransform.offsetX + (point.x - centerX) * safeTransform.scale,
    y: centerY + safeTransform.offsetY + (point.y - centerY) * safeTransform.scale,
  };
};

/**
 * Maps viewport-transformed sample space into untransformed stage surface space.
 */
export const resolveSurfacePointFromViewportSamplePoint = ({
  point,
  viewportTransform,
  viewportWidth,
  viewportHeight,
}: {
  point: StageSurfacePoint;
  viewportTransform: StageViewportTransform;
  viewportWidth: number;
  viewportHeight: number;
}): StageSurfacePoint => {
  const safeSize = resolveSafeDimensions({ width: viewportWidth, height: viewportHeight });
  const safeTransform = resolveSafeViewportTransform(viewportTransform);
  const centerX = safeSize.width / 2;
  const centerY = safeSize.height / 2;
  return {
    x: centerX + (point.x - centerX - safeTransform.offsetX) / safeTransform.scale,
    y: centerY + (point.y - centerY - safeTransform.offsetY) / safeTransform.scale,
  };
};

/**
 * Maps a client-space pointer sample into stage surface space using one viewport inverse.
 */
export const resolveSurfacePointFromClientPoint = ({
  clientX,
  clientY,
  rect,
  viewportTransform,
  clampToBounds = false,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  viewportTransform: StageViewportTransform;
  clampToBounds?: boolean;
}): StageSurfacePoint | null => {
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  const sampleX = clientX - rect.left;
  const sampleY = clientY - rect.top;
  if (
    !clampToBounds &&
    (sampleX < 0 || sampleY < 0 || sampleX > rect.width || sampleY > rect.height)
  ) {
    return null;
  }
  const boundedSamplePoint = clampToBounds
    ? {
        x: clamp(sampleX, 0, rect.width),
        y: clamp(sampleY, 0, rect.height),
      }
    : {
        x: sampleX,
        y: sampleY,
      };
  const surfacePoint = resolveSurfacePointFromViewportSamplePoint({
    point: boundedSamplePoint,
    viewportTransform,
    viewportWidth: rect.width,
    viewportHeight: rect.height,
  });
  if (!clampToBounds) {
    return surfacePoint;
  }
  return {
    x: clamp(surfacePoint.x, 0, rect.width),
    y: clamp(surfacePoint.y, 0, rect.height),
  };
};

/**
 * Resolves a uniform draw rect that preserves scene geometry when drawing one surface into another.
 */
export const resolveSceneMappedDrawRect = ({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
}: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}) => {
  const safeSource = resolveSafeDimensions({ width: sourceWidth, height: sourceHeight });
  const safeTarget = resolveSafeDimensions({ width: targetWidth, height: targetHeight });
  const scale = safeTarget.height / safeSource.height;
  const width = safeSource.width * scale;
  const height = safeSource.height * scale;
  return {
    x: (safeTarget.width - width) / 2,
    y: (safeTarget.height - height) / 2,
    width,
    height,
    scale,
  };
};

/**
 * Resolves isotropic scaling between two surfaces using height as the canonical scene dimension.
 */
export const resolveIsotropicScaleBetweenSpaces = ({
  fromHeight,
  toHeight,
}: {
  fromHeight: number;
  toHeight: number;
}) => {
  const safeFrom = Math.max(1, Number.isFinite(fromHeight) ? fromHeight : 1);
  const safeTo = Math.max(1, Number.isFinite(toHeight) ? toHeight : 1);
  return safeTo / safeFrom;
};

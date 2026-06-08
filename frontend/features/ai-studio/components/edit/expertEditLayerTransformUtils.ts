/**
 * Shared layer-transform primitives for Expert Edit layer state and gesture math.
 */
export type LayerTransform = {
  translateXRatio: number;
  translateYRatio: number;
  scale: number;
  rotationDeg: number;
};

export type TransformHistoryLayerSnapshot = {
  layerId: string;
  transform: LayerTransform;
};

export type TransformHistoryEntry = {
  layerOrderSignature: string;
  layerSnapshots: TransformHistoryLayerSnapshot[];
};

export type TransformHistoryState = {
  past: TransformHistoryEntry[];
  present: TransformHistoryEntry;
  future: TransformHistoryEntry[];
};

export type TransformGeometry = {
  centerX: number;
  centerY: number;
  resizeHandleX: number;
  resizeHandleY: number;
  rotateHandleX: number;
  rotateHandleY: number;
};

export type ContainedLayerRect = {
  width: number;
  height: number;
  left: number;
  top: number;
  widthPercent: number;
  heightPercent: number;
  leftPercent: number;
  topPercent: number;
};

export type LayerVisualGeometry = {
  containedRect: ContainedLayerRect;
  translateX: number;
  translateY: number;
  transformCss: string;
};

const LAYER_OPACITY_MIN = 0;
const LAYER_OPACITY_MAX = 1;
const LAYER_TRANSLATE_RATIO_MIN = -1;
const LAYER_TRANSLATE_RATIO_MAX = 1;
const LAYER_SCALE_MIN = 0.2;
const LAYER_SCALE_MAX = 2;
export const SINGLE_IMAGE_EDIT_SAFE_SCALE_MIN = 0.5;
const TRANSFORM_ROTATE_HANDLE_INSET_PX = 16;
const LAYER_SCALE_EPSILON = 0.0001;

export const defaultLayerTransform = (): LayerTransform => ({
  translateXRatio: 0,
  translateYRatio: 0,
  scale: 1,
  rotationDeg: 0,
});

export const cloneLayerTransform = (transform: LayerTransform): LayerTransform => ({
  translateXRatio: transform.translateXRatio,
  translateYRatio: transform.translateYRatio,
  scale: transform.scale,
  rotationDeg: transform.rotationDeg,
});

export const clampLayerOpacity = (value: number) =>
  Math.min(LAYER_OPACITY_MAX, Math.max(LAYER_OPACITY_MIN, value));

export const clampLayerTranslateRatio = (value: number) =>
  Math.min(LAYER_TRANSLATE_RATIO_MAX, Math.max(LAYER_TRANSLATE_RATIO_MIN, value));

export const clampLayerScale = (value: number) =>
  Math.min(LAYER_SCALE_MAX, Math.max(LAYER_SCALE_MIN, value));

const resolveSafeImageAspectRatio = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 1;

const resolveSafeViewportDimension = (value: number) =>
  Math.max(1, Number.isFinite(value) ? value : 1);

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const resolveContainedLayerRect = ({
  imageAspectRatio,
  viewportWidth,
  viewportHeight,
}: {
  imageAspectRatio: number;
  viewportWidth: number;
  viewportHeight: number;
}): ContainedLayerRect => {
  const safeAspectRatio = resolveSafeImageAspectRatio(imageAspectRatio);
  const safeViewportWidth = resolveSafeViewportDimension(viewportWidth);
  const safeViewportHeight = resolveSafeViewportDimension(viewportHeight);
  const viewportAspectRatio = safeViewportWidth / safeViewportHeight;
  let width = safeViewportWidth;
  let height = safeViewportHeight;
  if (safeAspectRatio > viewportAspectRatio) {
    height = safeViewportWidth / safeAspectRatio;
  } else {
    width = safeViewportHeight * safeAspectRatio;
  }
  const left = (safeViewportWidth - width) / 2;
  const top = (safeViewportHeight - height) / 2;
  return {
    width,
    height,
    left,
    top,
    widthPercent: (width / safeViewportWidth) * 100,
    heightPercent: (height / safeViewportHeight) * 100,
    leftPercent: (left / safeViewportWidth) * 100,
    topPercent: (top / safeViewportHeight) * 100,
  };
};

const roundCssPixelValue = (value: number) => Math.round(value * 100) / 100;

export const resolveLayerVisualGeometry = ({
  imageAspectRatio,
  viewportWidth,
  viewportHeight,
  transform,
}: {
  imageAspectRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  transform: LayerTransform;
}): LayerVisualGeometry => {
  const containedRect = resolveContainedLayerRect({
    imageAspectRatio,
    viewportWidth,
    viewportHeight,
  });
  const translateX = transform.translateXRatio * resolveSafeViewportDimension(viewportWidth);
  const translateY = transform.translateYRatio * resolveSafeViewportDimension(viewportHeight);
  return {
    containedRect,
    translateX,
    translateY,
    transformCss: `translate(${roundCssPixelValue(translateX)}px, ${roundCssPixelValue(
      translateY
    )}px) scale(${Math.max(LAYER_SCALE_EPSILON, transform.scale)}) rotate(${
      transform.rotationDeg
    }deg)`,
  };
};

const resolveLayerBoundingExtents = ({
  baseWidth,
  baseHeight,
  scale,
  rotationDeg,
}: {
  baseWidth: number;
  baseHeight: number;
  scale: number;
  rotationDeg: number;
}) => {
  const safeBaseWidth = Math.max(LAYER_SCALE_EPSILON, Math.abs(baseWidth));
  const safeBaseHeight = Math.max(LAYER_SCALE_EPSILON, Math.abs(baseHeight));
  const safeScale = Math.max(LAYER_SCALE_EPSILON, Number.isFinite(scale) ? scale : 1);
  const rotation = toRadians(rotationDeg);
  const cosine = Math.abs(Math.cos(rotation));
  const sine = Math.abs(Math.sin(rotation));
  const halfWidth = (safeScale * (safeBaseWidth * cosine + safeBaseHeight * sine)) / 2;
  const halfHeight = (safeScale * (safeBaseWidth * sine + safeBaseHeight * cosine)) / 2;
  return {
    halfWidth,
    halfHeight,
  };
};

export const resolveMaxContainedLayerScale = ({
  imageAspectRatio,
  dropzoneWidth,
  dropzoneHeight,
  rotationDeg,
}: {
  imageAspectRatio: number;
  dropzoneWidth: number;
  dropzoneHeight: number;
  rotationDeg: number;
}) => {
  const safeDropzoneWidth = resolveSafeViewportDimension(dropzoneWidth);
  const safeDropzoneHeight = resolveSafeViewportDimension(dropzoneHeight);
  const containedRect = resolveContainedLayerRect({
    imageAspectRatio,
    viewportWidth: safeDropzoneWidth,
    viewportHeight: safeDropzoneHeight,
  });
  const rotation = toRadians(rotationDeg);
  const cosine = Math.abs(Math.cos(rotation));
  const sine = Math.abs(Math.sin(rotation));
  const widthDenominator = containedRect.width * cosine + containedRect.height * sine;
  const heightDenominator = containedRect.width * sine + containedRect.height * cosine;
  const widthBound =
    widthDenominator > LAYER_SCALE_EPSILON ? safeDropzoneWidth / widthDenominator : LAYER_SCALE_MAX;
  const heightBound =
    heightDenominator > LAYER_SCALE_EPSILON
      ? safeDropzoneHeight / heightDenominator
      : LAYER_SCALE_MAX;
  return Math.max(LAYER_SCALE_EPSILON, Math.min(LAYER_SCALE_MAX, widthBound, heightBound));
};

export const resolveContainedLayerTransform = ({
  transform,
  imageAspectRatio,
  dropzoneWidth,
  dropzoneHeight,
}: {
  transform: LayerTransform;
  imageAspectRatio: number;
  dropzoneWidth: number;
  dropzoneHeight: number;
}): LayerTransform => {
  const safeDropzoneWidth = resolveSafeViewportDimension(dropzoneWidth);
  const safeDropzoneHeight = resolveSafeViewportDimension(dropzoneHeight);
  const rotationDeg = normalizeLayerRotationDeg(transform.rotationDeg);
  const maxContainedScale = resolveMaxContainedLayerScale({
    imageAspectRatio,
    dropzoneWidth: safeDropzoneWidth,
    dropzoneHeight: safeDropzoneHeight,
    rotationDeg,
  });
  const scale = Math.max(
    LAYER_SCALE_EPSILON,
    Math.min(clampLayerScale(transform.scale), maxContainedScale)
  );
  const containedRect = resolveContainedLayerRect({
    imageAspectRatio,
    viewportWidth: safeDropzoneWidth,
    viewportHeight: safeDropzoneHeight,
  });
  const extents = resolveLayerBoundingExtents({
    baseWidth: containedRect.width,
    baseHeight: containedRect.height,
    scale,
    rotationDeg,
  });
  const maxCenterOffsetX = Math.max(0, safeDropzoneWidth / 2 - extents.halfWidth);
  const maxCenterOffsetY = Math.max(0, safeDropzoneHeight / 2 - extents.halfHeight);
  return {
    translateXRatio: clampNumber(
      Number.isFinite(transform.translateXRatio) ? transform.translateXRatio : 0,
      -maxCenterOffsetX / safeDropzoneWidth,
      maxCenterOffsetX / safeDropzoneWidth
    ),
    translateYRatio: clampNumber(
      Number.isFinite(transform.translateYRatio) ? transform.translateYRatio : 0,
      -maxCenterOffsetY / safeDropzoneHeight,
      maxCenterOffsetY / safeDropzoneHeight
    ),
    scale,
    rotationDeg,
  };
};

export const resolveClippedLayerTransform = ({
  transform,
}: {
  transform: LayerTransform;
}): LayerTransform => ({
  translateXRatio: Number.isFinite(transform.translateXRatio) ? transform.translateXRatio : 0,
  translateYRatio: Number.isFinite(transform.translateYRatio) ? transform.translateYRatio : 0,
  scale: Math.max(LAYER_SCALE_EPSILON, clampLayerScale(transform.scale)),
  rotationDeg: normalizeLayerRotationDeg(transform.rotationDeg),
});

export const resolveSingleImageEditSafeTransform = ({
  transform,
}: {
  transform: LayerTransform;
}): LayerTransform => {
  const clippedTransform = resolveClippedLayerTransform({ transform });
  if (clippedTransform.scale < SINGLE_IMAGE_EDIT_SAFE_SCALE_MIN) {
    return defaultLayerTransform();
  }
  return clippedTransform;
};

export const normalizeLayerRotationDeg = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  let normalized = value % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return Math.round(normalized * 1000) / 1000;
};

export const areLayerTransformsEqual = (left: LayerTransform, right: LayerTransform) =>
  left.translateXRatio === right.translateXRatio &&
  left.translateYRatio === right.translateYRatio &&
  left.scale === right.scale &&
  left.rotationDeg === right.rotationDeg;

export const buildTransformHistoryEntry = <T extends { id: string; transform: LayerTransform }>(
  layers: readonly T[]
): TransformHistoryEntry => ({
  layerOrderSignature: layers.map((layer) => layer.id).join("|"),
  layerSnapshots: layers.map((layer) => ({
    layerId: layer.id,
    transform: cloneLayerTransform(layer.transform),
  })),
});

export const areTransformHistoryEntriesEqual = (
  left: TransformHistoryEntry,
  right: TransformHistoryEntry
) => {
  if (left.layerOrderSignature !== right.layerOrderSignature) return false;
  if (left.layerSnapshots.length !== right.layerSnapshots.length) return false;
  for (let index = 0; index < left.layerSnapshots.length; index += 1) {
    const leftSnapshot = left.layerSnapshots[index];
    const rightSnapshot = right.layerSnapshots[index];
    if (!leftSnapshot || !rightSnapshot) return false;
    if (leftSnapshot.layerId !== rightSnapshot.layerId) return false;
    if (!areLayerTransformsEqual(leftSnapshot.transform, rightSnapshot.transform)) {
      return false;
    }
  }
  return true;
};

export const applyTransformHistoryEntryToLayers = <
  T extends { id: string; transform: LayerTransform },
>(
  layers: T[],
  entry: TransformHistoryEntry
): T[] => {
  const currentLayerOrderSignature = layers.map((layer) => layer.id).join("|");
  if (currentLayerOrderSignature !== entry.layerOrderSignature) {
    return layers;
  }
  const transformByLayerId = new Map(
    entry.layerSnapshots.map((snapshot) => [snapshot.layerId, snapshot.transform])
  );
  return layers.map((layer) => {
    const snapshotTransform = transformByLayerId.get(layer.id);
    if (!snapshotTransform || areLayerTransformsEqual(layer.transform, snapshotTransform)) {
      return layer;
    }
    return {
      ...layer,
      transform: cloneLayerTransform(snapshotTransform),
    };
  });
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotatePoint = (x: number, y: number, rotationDeg: number) => {
  const rotation = toRadians(rotationDeg);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
};

export const resolveTransformGeometry = ({
  transform,
  dropzoneWidth,
  dropzoneHeight,
  baseWidth,
  baseHeight,
}: {
  transform: LayerTransform;
  dropzoneWidth: number;
  dropzoneHeight: number;
  baseWidth: number;
  baseHeight: number;
}): TransformGeometry => {
  const safeDropzoneWidth = resolveSafeViewportDimension(dropzoneWidth);
  const safeDropzoneHeight = resolveSafeViewportDimension(dropzoneHeight);
  const centerX = safeDropzoneWidth / 2 + transform.translateXRatio * safeDropzoneWidth;
  const centerY = safeDropzoneHeight / 2 + transform.translateYRatio * safeDropzoneHeight;
  const halfWidth = (Math.max(LAYER_SCALE_EPSILON, baseWidth) / 2) * transform.scale;
  const halfHeight = (Math.max(LAYER_SCALE_EPSILON, baseHeight) / 2) * transform.scale;
  const cornerVector = rotatePoint(halfWidth, -halfHeight, transform.rotationDeg);
  const rotateHandleDistance = Math.max(
    halfHeight - TRANSFORM_ROTATE_HANDLE_INSET_PX,
    halfHeight * 0.35
  );
  const rotateVector = rotatePoint(0, -rotateHandleDistance, transform.rotationDeg);
  return {
    centerX,
    centerY,
    resizeHandleX: centerX + cornerVector.x,
    resizeHandleY: centerY + cornerVector.y,
    rotateHandleX: centerX + rotateVector.x,
    rotateHandleY: centerY + rotateVector.y,
  };
};

export const computeDistance = (x1: number, y1: number, x2: number, y2: number) =>
  Math.hypot(x2 - x1, y2 - y1);

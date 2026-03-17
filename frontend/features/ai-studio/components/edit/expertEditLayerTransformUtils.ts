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

const LAYER_OPACITY_MIN = 0;
const LAYER_OPACITY_MAX = 1;
const LAYER_TRANSLATE_RATIO_MIN = -1;
const LAYER_TRANSLATE_RATIO_MAX = 1;
const LAYER_SCALE_MIN = 0.2;
const LAYER_SCALE_MAX = 2;
const TRANSFORM_ROTATE_HANDLE_INSET_PX = 16;

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
  width,
  height,
}: {
  transform: LayerTransform;
  width: number;
  height: number;
}): TransformGeometry => {
  const centerX = width / 2 + transform.translateXRatio * width;
  const centerY = height / 2 + transform.translateYRatio * height;
  const halfWidth = (width / 2) * transform.scale;
  const halfHeight = (height / 2) * transform.scale;
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

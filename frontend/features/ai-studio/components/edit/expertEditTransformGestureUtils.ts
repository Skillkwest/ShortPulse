/**
 * Pure helpers for move/resize/rotate gesture session creation and pointer updates.
 */
import {
  clampLayerScale,
  clampLayerTranslateRatio,
  computeDistance,
  normalizeLayerRotationDeg,
  resolveTransformGeometry,
  type LayerTransform,
} from "./expertEditLayerTransformUtils";
import type { TransformPointerSession } from "./expertEditInteractionUtils";

export const resolveTransformDragMode = ({
  altKey,
  shiftKey,
}: {
  altKey: boolean;
  shiftKey: boolean;
}): TransformPointerSession["dragMode"] => {
  if (altKey) return "rotate";
  if (shiftKey) return "resize";
  return "move";
};

export const createTransformPointerSession = ({
  pointerId,
  pointerX,
  pointerY,
  dropzoneWidth,
  dropzoneHeight,
  selectedLayerId,
  selectedLayerTransform,
  dragMode,
}: {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  dropzoneWidth: number;
  dropzoneHeight: number;
  selectedLayerId: string;
  selectedLayerTransform: LayerTransform;
  dragMode: TransformPointerSession["dragMode"];
}): TransformPointerSession => {
  const geometry = resolveTransformGeometry({
    transform: selectedLayerTransform,
    width: dropzoneWidth,
    height: dropzoneHeight,
  });
  const distanceToCenter = Math.max(
    1,
    computeDistance(pointerX, pointerY, geometry.centerX, geometry.centerY)
  );
  const pointerAngleRad = Math.atan2(pointerY - geometry.centerY, pointerX - geometry.centerX);
  return {
    active: true,
    pointerId,
    layerId: selectedLayerId,
    dragMode,
    startCanvasX: pointerX,
    startCanvasY: pointerY,
    baseTranslateXRatio: selectedLayerTransform.translateXRatio,
    baseTranslateYRatio: selectedLayerTransform.translateYRatio,
    baseScale: selectedLayerTransform.scale,
    dropzoneWidth,
    dropzoneHeight,
    centerX: geometry.centerX,
    centerY: geometry.centerY,
    baseDistanceToCenter: distanceToCenter,
    baseRotationDeg: selectedLayerTransform.rotationDeg,
    basePointerAngleRad: pointerAngleRad,
  };
};

export const resolveTransformSessionUpdate = ({
  session,
  pointerX,
  pointerY,
}: {
  session: TransformPointerSession;
  pointerX: number;
  pointerY: number;
}): Partial<LayerTransform> | null => {
  if (session.dragMode === "move") {
    const deltaX = pointerX - session.startCanvasX;
    const deltaY = pointerY - session.startCanvasY;
    return {
      translateXRatio: clampLayerTranslateRatio(
        session.baseTranslateXRatio + deltaX / session.dropzoneWidth
      ),
      translateYRatio: clampLayerTranslateRatio(
        session.baseTranslateYRatio + deltaY / session.dropzoneHeight
      ),
    };
  }
  if (session.dragMode === "resize") {
    const nextDistanceToCenter = Math.max(
      1,
      computeDistance(pointerX, pointerY, session.centerX, session.centerY)
    );
    return {
      scale: clampLayerScale(
        session.baseScale * (nextDistanceToCenter / session.baseDistanceToCenter)
      ),
    };
  }
  if (session.dragMode === "rotate") {
    const nextPointerAngle = Math.atan2(pointerY - session.centerY, pointerX - session.centerX);
    return {
      rotationDeg: normalizeLayerRotationDeg(
        session.baseRotationDeg + ((nextPointerAngle - session.basePointerAngleRad) * 180) / Math.PI
      ),
    };
  }
  return null;
};

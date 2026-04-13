/**
 * Expert Edit session-state contracts and pure helpers.
 * Centralizes persistence shapes and clone/equality utilities for layer/markup/inpaint state.
 */

import type { MarkupStroke } from "./markupStrokeController";
import { areInpaintMaskSnapshotsEqual, type InpaintMaskSnapshot } from "./useInpaintMaskController";

export const EXPERT_EDIT_SESSION_STATE_VERSION = 2 as const;
export type ExpertEditSessionStateVersion = 1 | typeof EXPERT_EDIT_SESSION_STATE_VERSION;

export type ExpertEditLayerSessionTransform = {
  translateXRatio: number;
  translateYRatio: number;
  scale: number;
  rotationDeg: number;
};

export type ExpertEditLayerSessionLayer = {
  id: string;
  name: string;
  imageUrl: string | null;
  opacity: number;
  isAutoNamed: boolean;
  ownsImageUrl: boolean;
  transform: ExpertEditLayerSessionTransform;
};

export type ExpertEditLayerSessionState = {
  layerIdCounter: number;
  foundationLayerId: string | null;
  selectedLayerIndex: number | null;
  layers: ExpertEditLayerSessionLayer[];
};

export type ExpertEditMarkupHistoryState = {
  past: MarkupStroke[][];
  present: MarkupStroke[];
  future: MarkupStroke[][];
};

export type ExpertEditInpaintHistoryState = {
  past: InpaintMaskSnapshot[];
  present: InpaintMaskSnapshot;
  future: InpaintMaskSnapshot[];
};

export type ExpertEditMarkupSessionState = {
  strokes: MarkupStroke[];
  history?: ExpertEditMarkupHistoryState;
};

export type ExpertEditInpaintSessionState = {
  snapshot: InpaintMaskSnapshot;
  history?: ExpertEditInpaintHistoryState;
};

export type ExpertEditSessionState = {
  version: ExpertEditSessionStateVersion;
  layers: ExpertEditLayerSessionState;
  markup: ExpertEditMarkupSessionState;
  inpaint: ExpertEditInpaintSessionState;
};

export const cloneLayerSessionTransform = (
  transform: ExpertEditLayerSessionTransform
): ExpertEditLayerSessionTransform => ({
  translateXRatio: transform.translateXRatio,
  translateYRatio: transform.translateYRatio,
  scale: transform.scale,
  rotationDeg: transform.rotationDeg,
});

export const cloneLayerSessionLayer = (
  layer: ExpertEditLayerSessionLayer
): ExpertEditLayerSessionLayer => ({
  id: layer.id,
  name: layer.name,
  imageUrl: layer.imageUrl,
  opacity: layer.opacity,
  isAutoNamed: layer.isAutoNamed,
  ownsImageUrl: layer.ownsImageUrl,
  transform: cloneLayerSessionTransform(layer.transform),
});

export const cloneLayerSessionState = (
  state: ExpertEditLayerSessionState
): ExpertEditLayerSessionState => ({
  layerIdCounter: state.layerIdCounter,
  foundationLayerId: state.foundationLayerId,
  selectedLayerIndex: state.selectedLayerIndex,
  layers: state.layers.map(cloneLayerSessionLayer),
});

export const cloneMarkupStrokesSnapshot = (strokes: MarkupStroke[]) =>
  strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));

export const cloneMarkupHistoryState = (
  history: ExpertEditMarkupHistoryState
): ExpertEditMarkupHistoryState => ({
  past: history.past.map((entry) => cloneMarkupStrokesSnapshot(entry)),
  present: cloneMarkupStrokesSnapshot(history.present),
  future: history.future.map((entry) => cloneMarkupStrokesSnapshot(entry)),
});

export const cloneInpaintMaskSnapshot = (snapshot: InpaintMaskSnapshot): InpaintMaskSnapshot => ({
  layers: snapshot.layers.map((layer) => ({
    layerId: layer.layerId,
    width: layer.width,
    height: layer.height,
    alpha: new Uint8ClampedArray(layer.alpha),
  })),
});

export const cloneInpaintHistoryState = (
  history: ExpertEditInpaintHistoryState
): ExpertEditInpaintHistoryState => ({
  past: history.past.map(cloneInpaintMaskSnapshot),
  present: cloneInpaintMaskSnapshot(history.present),
  future: history.future.map(cloneInpaintMaskSnapshot),
});

export const cloneExpertEditSessionState = (
  state: ExpertEditSessionState
): ExpertEditSessionState => ({
  version: EXPERT_EDIT_SESSION_STATE_VERSION,
  layers: cloneLayerSessionState(state.layers),
  markup: {
    strokes: cloneMarkupStrokesSnapshot(state.markup.strokes),
  },
  inpaint: {
    snapshot: cloneInpaintMaskSnapshot(state.inpaint.snapshot),
  },
});

export const areLayerSessionStatesEqual = (
  left: ExpertEditLayerSessionState,
  right: ExpertEditLayerSessionState
) => {
  if (left.layerIdCounter !== right.layerIdCounter) return false;
  if (left.foundationLayerId !== right.foundationLayerId) return false;
  if (left.selectedLayerIndex !== right.selectedLayerIndex) return false;
  if (left.layers.length !== right.layers.length) return false;
  for (let index = 0; index < left.layers.length; index += 1) {
    const leftLayer = left.layers[index];
    const rightLayer = right.layers[index];
    if (!leftLayer || !rightLayer) return false;
    if (
      leftLayer.id !== rightLayer.id ||
      leftLayer.name !== rightLayer.name ||
      leftLayer.imageUrl !== rightLayer.imageUrl ||
      leftLayer.opacity !== rightLayer.opacity ||
      leftLayer.isAutoNamed !== rightLayer.isAutoNamed ||
      leftLayer.ownsImageUrl !== rightLayer.ownsImageUrl
    ) {
      return false;
    }
    if (
      leftLayer.transform.translateXRatio !== rightLayer.transform.translateXRatio ||
      leftLayer.transform.translateYRatio !== rightLayer.transform.translateYRatio ||
      leftLayer.transform.scale !== rightLayer.transform.scale ||
      leftLayer.transform.rotationDeg !== rightLayer.transform.rotationDeg
    ) {
      return false;
    }
  }
  return true;
};

export const areMarkupStrokeSnapshotsEqual = (left: MarkupStroke[], right: MarkupStroke[]) => {
  if (left.length !== right.length) return false;
  for (let strokeIndex = 0; strokeIndex < left.length; strokeIndex += 1) {
    const leftStroke = left[strokeIndex];
    const rightStroke = right[strokeIndex];
    if (!leftStroke || !rightStroke) return false;
    if (
      leftStroke.id !== rightStroke.id ||
      leftStroke.color !== rightStroke.color ||
      leftStroke.sizeRatio !== rightStroke.sizeRatio
    ) {
      return false;
    }
    if (leftStroke.points.length !== rightStroke.points.length) return false;
    for (let pointIndex = 0; pointIndex < leftStroke.points.length; pointIndex += 1) {
      const leftPoint = leftStroke.points[pointIndex];
      const rightPoint = rightStroke.points[pointIndex];
      if (!leftPoint || !rightPoint) return false;
      if (leftPoint.sceneX !== rightPoint.sceneX || leftPoint.sceneY !== rightPoint.sceneY) {
        return false;
      }
    }
  }
  return true;
};

export const areMarkupHistoryStatesEqual = (
  left: ExpertEditMarkupHistoryState,
  right: ExpertEditMarkupHistoryState
) => {
  if (!areMarkupStrokeSnapshotsEqual(left.present, right.present)) return false;
  if (left.past.length !== right.past.length) return false;
  if (left.future.length !== right.future.length) return false;
  for (let index = 0; index < left.past.length; index += 1) {
    const leftEntry = left.past[index];
    const rightEntry = right.past[index];
    if (!leftEntry || !rightEntry) return false;
    if (!areMarkupStrokeSnapshotsEqual(leftEntry, rightEntry)) return false;
  }
  for (let index = 0; index < left.future.length; index += 1) {
    const leftEntry = left.future[index];
    const rightEntry = right.future[index];
    if (!leftEntry || !rightEntry) return false;
    if (!areMarkupStrokeSnapshotsEqual(leftEntry, rightEntry)) return false;
  }
  return true;
};

export const areInpaintHistoryStatesEqual = (
  left: ExpertEditInpaintHistoryState,
  right: ExpertEditInpaintHistoryState
) => {
  if (!areInpaintMaskSnapshotsEqual(left.present, right.present)) return false;
  if (left.past.length !== right.past.length) return false;
  if (left.future.length !== right.future.length) return false;
  for (let index = 0; index < left.past.length; index += 1) {
    const leftEntry = left.past[index];
    const rightEntry = right.past[index];
    if (!leftEntry || !rightEntry) return false;
    if (!areInpaintMaskSnapshotsEqual(leftEntry, rightEntry)) return false;
  }
  for (let index = 0; index < left.future.length; index += 1) {
    const leftEntry = left.future[index];
    const rightEntry = right.future[index];
    if (!leftEntry || !rightEntry) return false;
    if (!areInpaintMaskSnapshotsEqual(leftEntry, rightEntry)) return false;
  }
  return true;
};

export const areExpertEditSessionStatesEqual = (
  left: ExpertEditSessionState,
  right: ExpertEditSessionState
) =>
  left.version === right.version &&
  areLayerSessionStatesEqual(left.layers, right.layers) &&
  areMarkupStrokeSnapshotsEqual(left.markup.strokes, right.markup.strokes) &&
  areInpaintMaskSnapshotsEqual(left.inpaint.snapshot, right.inpaint.snapshot);

/**
 * Canvas interaction policy helpers.
 * Encodes gesture thresholds and dedupe rules for draft text creation.
 */
export type CanvasInteractionPoint = {
  timeStamp: number;
  clientX: number;
  clientY: number;
};

export const CANVAS_DOUBLE_TAP_MAX_INTERVAL_MS = 360;
export const CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX = 24;

const distanceBetweenPoints = (a: CanvasInteractionPoint, b: CanvasInteractionPoint): number =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export const shouldCreateDraftFromPointerDetail = ({
  button,
  detail,
  isSpacePanActive,
}: {
  button: number;
  detail: number;
  isSpacePanActive: boolean;
}): boolean => button === 0 && !isSpacePanActive && detail >= 2;

export const isCanvasEmptySpaceEventTarget = ({
  target,
  currentTarget,
}: {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}): boolean => {
  if (!(currentTarget instanceof HTMLElement)) return false;
  if (target === currentTarget) return true;
  if (!(target instanceof Element)) return false;
  if (!currentTarget.contains(target)) return false;
  return target.closest(".canvas-scene-item") == null;
};

export const shouldSuppressDraftCreation = ({
  lastCreation,
  nextPoint,
}: {
  lastCreation: CanvasInteractionPoint | null;
  nextPoint: CanvasInteractionPoint;
}): boolean => {
  if (!lastCreation) return false;
  const elapsedMs = nextPoint.timeStamp - lastCreation.timeStamp;
  if (elapsedMs > CANVAS_DOUBLE_TAP_MAX_INTERVAL_MS) return false;
  return distanceBetweenPoints(lastCreation, nextPoint) <= CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX;
};

export const resolveViewportTapState = ({
  previousTap,
  nextTap,
  isSpacePanActive,
  travelDistance,
}: {
  previousTap: CanvasInteractionPoint | null;
  nextTap: CanvasInteractionPoint;
  isSpacePanActive: boolean;
  travelDistance: number;
}): { shouldCreateDraft: boolean; nextStoredTap: CanvasInteractionPoint | null } => {
  if (isSpacePanActive || travelDistance > CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX) {
    return {
      shouldCreateDraft: false,
      nextStoredTap: null,
    };
  }
  if (!previousTap) {
    return {
      shouldCreateDraft: false,
      nextStoredTap: nextTap,
    };
  }
  const elapsedMs = nextTap.timeStamp - previousTap.timeStamp;
  const distance = distanceBetweenPoints(previousTap, nextTap);
  if (
    elapsedMs <= CANVAS_DOUBLE_TAP_MAX_INTERVAL_MS &&
    distance <= CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX
  ) {
    return {
      shouldCreateDraft: true,
      nextStoredTap: null,
    };
  }
  return {
    shouldCreateDraft: false,
    nextStoredTap: nextTap,
  };
};

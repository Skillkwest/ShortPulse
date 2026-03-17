/**
 * Interaction helpers for Expert Edit keyboard guards, transform sessions, and menu positioning.
 */
export const STAGE_CONTEXT_MENU_WIDTH = 164;
export const STAGE_CONTEXT_MENU_HEIGHT = 206;
export const STAGE_CONTEXT_MENU_GUTTER = 8;

export const isKeyboardEventFromEditableTarget = (event: KeyboardEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  return target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'));
};

export type TransformPointerSession = {
  active: boolean;
  pointerId: number;
  layerId: string | null;
  dragMode: "move" | "resize" | "rotate";
  startCanvasX: number;
  startCanvasY: number;
  baseTranslateXRatio: number;
  baseTranslateYRatio: number;
  baseScale: number;
  dropzoneWidth: number;
  dropzoneHeight: number;
  centerX: number;
  centerY: number;
  baseDistanceToCenter: number;
  baseRotationDeg: number;
  basePointerAngleRad: number;
};

export type EditSubmitIntentMode = "standard" | "inpaint" | "markup";
export type RailToolMode = "move" | "inpaint" | "video";
export type TimeoutRef = { current: number | null };
export type ObjectUrlRevokeTimers = Map<string, number>;

export const createIdleTransformPointerSession = (): TransformPointerSession => ({
  active: false,
  pointerId: -1,
  layerId: null,
  dragMode: "move",
  startCanvasX: 0,
  startCanvasY: 0,
  baseTranslateXRatio: 0,
  baseTranslateYRatio: 0,
  baseScale: 1,
  dropzoneWidth: 1,
  dropzoneHeight: 1,
  centerX: 0,
  centerY: 0,
  baseDistanceToCenter: 1,
  baseRotationDeg: 0,
  basePointerAngleRad: 0,
});

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const resolveStageContextMenuPosition = ({
  clientX,
  clientY,
  viewportWidth,
  viewportHeight,
}: {
  clientX: number;
  clientY: number;
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const nextX = clampNumber(
    clientX,
    STAGE_CONTEXT_MENU_GUTTER,
    Math.max(
      STAGE_CONTEXT_MENU_GUTTER,
      viewportWidth - STAGE_CONTEXT_MENU_WIDTH - STAGE_CONTEXT_MENU_GUTTER
    )
  );
  const nextY = clampNumber(
    clientY,
    STAGE_CONTEXT_MENU_GUTTER,
    Math.max(
      STAGE_CONTEXT_MENU_GUTTER,
      viewportHeight - STAGE_CONTEXT_MENU_HEIGHT - STAGE_CONTEXT_MENU_GUTTER
    )
  );
  return {
    x: Math.round(nextX),
    y: Math.round(nextY),
  };
};

export const resolveRailToolForGenerationMode = (mode: EditSubmitIntentMode): RailToolMode => {
  if (mode === "standard") return "move";
  if (mode === "inpaint") return "inpaint";
  return "video";
};

export const resolveInpaintCollapseToggleDecision = ({
  isInpaintCollapsed,
  shouldOpenMarkupModalFromCollapsedTools,
}: {
  isInpaintCollapsed: boolean;
  shouldOpenMarkupModalFromCollapsedTools: boolean;
}) => {
  if (isInpaintCollapsed && shouldOpenMarkupModalFromCollapsedTools) {
    return "open_markup_modal";
  }
  if (isInpaintCollapsed) {
    return "expand_inpaint";
  }
  return "collapse_inpaint";
};

export const clearWindowTimeoutRef = (timeoutRef: TimeoutRef) => {
  if (timeoutRef.current == null) return false;
  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
  return true;
};

export const scheduleTransientObjectUrlRevoke = ({
  url,
  timersByUrl,
  revokeDelayMs,
  revokeObjectUrl,
}: {
  url: string;
  timersByUrl: ObjectUrlRevokeTimers;
  revokeDelayMs: number;
  revokeObjectUrl: (url: string) => void;
}) => {
  const existingTimer = timersByUrl.get(url);
  if (existingTimer != null) {
    window.clearTimeout(existingTimer);
  }
  const timer = window.setTimeout(() => {
    timersByUrl.delete(url);
    revokeObjectUrl(url);
  }, revokeDelayMs);
  timersByUrl.set(url, timer);
};

export const clearTransientObjectUrlRevokeTimers = ({
  timersByUrl,
  revokeObjectUrl,
}: {
  timersByUrl: ObjectUrlRevokeTimers;
  revokeObjectUrl: (url: string) => void;
}) => {
  timersByUrl.forEach((timer, url) => {
    window.clearTimeout(timer);
    revokeObjectUrl(url);
  });
  timersByUrl.clear();
};

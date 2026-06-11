/**
 * Interaction helpers for Expert Edit keyboard guards, transform sessions, and menu positioning.
 */
export const STAGE_CONTEXT_MENU_WIDTH = 164;
export const STAGE_CONTEXT_MENU_HEIGHT = 206;
export const STAGE_CONTEXT_MENU_GUTTER = 8;
export const KEYBOARD_PAN_OWNER_SELECTOR = '[data-keyboard-pan-owner="true"]';

export const isKeyboardEventFromEditableTarget = (event: KeyboardEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  return target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'));
};

export const isKeyboardEventFromInteractiveTarget = (event: KeyboardEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (isKeyboardEventFromEditableTarget(event)) return true;
  if (target.closest(KEYBOARD_PAN_OWNER_SELECTOR)) return false;
  return Boolean(
    target.closest(
      'button, a, summary, [role="button"], [role="link"], [role="menuitem"], [tabindex]'
    )
  );
};

export const isClientPointInsideElementBounds = ({
  element,
  clientX,
  clientY,
}: {
  element: Element | null;
  clientX: number;
  clientY: number;
}) => {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
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
  baseFlipX: boolean;
  baseFlipY: boolean;
  dropzoneWidth: number;
  dropzoneHeight: number;
  centerX: number;
  centerY: number;
  baseDistanceToCenter: number;
  baseRotationDeg: number;
  basePointerAngleRad: number;
};

export type EditSubmitIntentMode = "standard" | "inpaint" | "markup";
export type RailToolMode = "move" | "inpaint" | "markup";
export type TimeoutRef = { current: number | null };
export type AnimationFrameRef = { current: number | null };
export type ObjectUrlRevokeTimers = Map<string, number>;
export type GlobalCursorLockState = {
  active: boolean;
  bodyCursor: string;
  htmlCursor: string;
};

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
  baseFlipX: false,
  baseFlipY: false,
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
  return "markup";
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

export const clearWindowAnimationFrameRef = (frameRef: AnimationFrameRef) => {
  if (frameRef.current == null) return false;
  if (typeof window !== "undefined") {
    window.cancelAnimationFrame(frameRef.current);
  }
  frameRef.current = null;
  return true;
};

export const scheduleWindowAnimationFrame = ({
  frameRef,
  callback,
}: {
  frameRef: AnimationFrameRef;
  callback: () => void;
}) => {
  if (frameRef.current != null) return false;
  if (typeof window === "undefined") {
    callback();
    return true;
  }
  frameRef.current = window.requestAnimationFrame(() => {
    frameRef.current = null;
    callback();
  });
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

export const lockDocumentCursor = ({
  cursor,
  lockState,
}: {
  cursor: string;
  lockState: GlobalCursorLockState;
}) => {
  if (typeof document === "undefined") return;
  const bodyStyle = document.body?.style;
  const htmlStyle = document.documentElement?.style;
  if (!bodyStyle || !htmlStyle) return;
  if (!lockState.active) {
    lockState.bodyCursor = bodyStyle.cursor;
    lockState.htmlCursor = htmlStyle.cursor;
    lockState.active = true;
  }
  bodyStyle.cursor = cursor;
  htmlStyle.cursor = cursor;
};

export const unlockDocumentCursor = (lockState: GlobalCursorLockState) => {
  if (typeof document === "undefined") return;
  if (!lockState.active) return;
  const bodyStyle = document.body?.style;
  const htmlStyle = document.documentElement?.style;
  if (bodyStyle) {
    bodyStyle.cursor = lockState.bodyCursor;
  }
  if (htmlStyle) {
    htmlStyle.cursor = lockState.htmlCursor;
  }
  lockState.active = false;
  lockState.bodyCursor = "";
  lockState.htmlCursor = "";
};

export const syncTextareaMirrorScroll = ({
  textarea,
  mirror,
}: {
  textarea: HTMLTextAreaElement | null;
  mirror: HTMLElement | null;
}) => {
  if (!textarea || !mirror) return;
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;
};

export const autoResizeTextareaWithinComputedBounds = (
  textarea: HTMLTextAreaElement | null,
  fallbackMinHeightPx = 72,
  collapseToMinHeight = false
) => {
  if (!textarea || typeof window === "undefined") return;
  const computedStyle = window.getComputedStyle(textarea);
  const minHeightPx = Number.parseFloat(computedStyle.minHeight) || fallbackMinHeightPx;
  const maxHeightPx = Number.parseFloat(computedStyle.maxHeight) || minHeightPx;
  const isValueEmpty = textarea.value.length === 0;
  const contentHeightPx =
    isValueEmpty || collapseToMinHeight
      ? minHeightPx
      : Math.max(minHeightPx, textarea.scrollHeight);
  const clampedHeightPx = Math.min(contentHeightPx, maxHeightPx);
  const currentHeightPx = textarea.getBoundingClientRect().height;
  if (currentHeightPx > 0 && Math.abs(currentHeightPx - clampedHeightPx) > 0.5) {
    textarea.style.height = `${currentHeightPx}px`;
    void textarea.offsetHeight;
  }
  textarea.style.height = `${clampedHeightPx}px`;
  textarea.style.overflowY = contentHeightPx > maxHeightPx ? "auto" : "hidden";
};

export const resolveTextareaVisualRowCount = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea || typeof window === "undefined") return 1;
  if (textarea.value.length === 0) return 1;
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeightPx = Number.parseFloat(computedStyle.lineHeight) || 0;
  const paddingTopPx = Number.parseFloat(computedStyle.paddingTop) || 0;
  const paddingBottomPx = Number.parseFloat(computedStyle.paddingBottom) || 0;
  const contentHeightPx = Math.max(0, textarea.scrollHeight - paddingTopPx - paddingBottomPx);
  return lineHeightPx > 0 ? Math.max(1, Math.ceil(contentHeightPx / lineHeightPx)) : 1;
};

export const clampCaretPosition = ({
  caretPosition,
  textLength,
}: {
  caretPosition: number;
  textLength: number;
}) => Math.max(0, Math.min(textLength, caretPosition));

export const isEventTargetInsideElement = (
  element: HTMLElement | null,
  target: EventTarget | null
) => Boolean(element && target instanceof Node && element.contains(target));

export const releasePointerCaptureSafely = (element: Element | null, pointerId: number) => {
  if (
    !element ||
    typeof (element as Element & { releasePointerCapture?: (pointerId: number) => void })
      .releasePointerCapture !== "function"
  ) {
    return;
  }
  try {
    (
      element as Element & { releasePointerCapture: (pointerId: number) => void }
    ).releasePointerCapture(pointerId);
  } catch {
    // Pointer capture may already be released.
  }
};

export const elementHasPointerCapture = (element: Element | null, pointerId: number) =>
  Boolean(
    element &&
    typeof (element as Element & { hasPointerCapture?: (pointerId: number) => boolean })
      .hasPointerCapture === "function" &&
    (element as Element & { hasPointerCapture: (pointerId: number) => boolean }).hasPointerCapture(
      pointerId
    )
  );

export const runPointerStageTerminalAction = <TEvent>({
  event,
  unlockCursor,
  handlePointerEvent,
  finalizeGestureHistory,
}: {
  event: TEvent;
  unlockCursor: () => void;
  handlePointerEvent: (event: TEvent) => void;
  finalizeGestureHistory: () => void;
}) => {
  unlockCursor();
  handlePointerEvent(event);
  finalizeGestureHistory();
};

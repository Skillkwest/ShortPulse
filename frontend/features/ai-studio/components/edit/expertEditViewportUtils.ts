/**
 * Viewport/zoom/pan primitives for Expert Edit stage surfaces.
 */
import type { MarkupViewportState } from "./markupStrokeController";
import {
  EXPERT_EDIT_CAMERA_SCALE_MAX,
  EXPERT_EDIT_CAMERA_SCALE_MIN,
  clampExpertEditCameraScale,
} from "../../logic/expertEditCameraContract";

export const MARKUP_VIEWPORT_SCALE_MIN = EXPERT_EDIT_CAMERA_SCALE_MIN;
export const MARKUP_VIEWPORT_SCALE_MAX = EXPERT_EDIT_CAMERA_SCALE_MAX;
export const MARKUP_VIEWPORT_DEFAULT_SCALE = 1;
export const MARKUP_VIEWPORT_EPSILON = 0.001;
export const MOVE_STAGE_ZOOM_SLIDER_MIN = 0;
export const MOVE_STAGE_ZOOM_SLIDER_MAX = 100;
export const MOVE_STAGE_ZOOM_SCALE_MIN = EXPERT_EDIT_CAMERA_SCALE_MIN;
export const MOVE_STAGE_ZOOM_SCALE_MAX = EXPERT_EDIT_CAMERA_SCALE_MAX;
export const MOVE_STAGE_ZOOM_SLIDER_DEFAULT =
  ((MARKUP_VIEWPORT_DEFAULT_SCALE - MOVE_STAGE_ZOOM_SCALE_MIN) /
    Math.max(0.0001, MOVE_STAGE_ZOOM_SCALE_MAX - MOVE_STAGE_ZOOM_SCALE_MIN)) *
  (MOVE_STAGE_ZOOM_SLIDER_MAX - MOVE_STAGE_ZOOM_SLIDER_MIN);
export const MOVE_STAGE_ZOOM_WHEEL_STEP_PER_DELTA = 0.04;

export type MarkupPanPointerSession = {
  active: boolean;
  scope: "inline" | "modal";
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  startOffsetXRatio: number;
  startOffsetYRatio: number;
  stageWidth: number;
  stageHeight: number;
};

export type StageViewportSize = {
  width: number;
  height: number;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const createDefaultMarkupViewportState = (): MarkupViewportState => ({
  scale: MARKUP_VIEWPORT_DEFAULT_SCALE,
  offsetXRatio: 0,
  offsetYRatio: 0,
});

export const createIdleMarkupPanPointerSession = (): MarkupPanPointerSession => ({
  active: false,
  scope: "inline",
  pointerId: null,
  startClientX: 0,
  startClientY: 0,
  startOffsetXRatio: 0,
  startOffsetYRatio: 0,
  stageWidth: 1,
  stageHeight: 1,
});

export const isResolvedStageViewportSize = (size: StageViewportSize) =>
  size.width > 1 && size.height > 1;

export const resolveStageViewportSize = (rect: DOMRect | null): StageViewportSize => ({
  width: rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 1,
  height: rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 1,
});

export const resolveRenderableStageViewportSize = ({
  preferredSize,
  stageElement,
}: {
  preferredSize: StageViewportSize;
  stageElement: HTMLDivElement | null;
}) => {
  if (isResolvedStageViewportSize(preferredSize)) {
    return preferredSize;
  }
  if (!stageElement) {
    return preferredSize;
  }
  return resolveStageViewportSize(stageElement.getBoundingClientRect() ?? null);
};

export const resolveMarkupViewportOffsetPixels = (
  viewport: MarkupViewportState,
  viewportSize: StageViewportSize
) => ({
  offsetX: viewport.offsetXRatio * viewportSize.width,
  offsetY: viewport.offsetYRatio * viewportSize.height,
});

/**
 * Returns whether the visible stage framing is identical to the uncropped source view.
 */
export const isMarkupViewportEquivalentToSourceFraming = (viewport: MarkupViewportState) =>
  Math.abs(viewport.scale - 1) <= MARKUP_VIEWPORT_EPSILON &&
  Math.abs(viewport.offsetXRatio) <= MARKUP_VIEWPORT_EPSILON &&
  Math.abs(viewport.offsetYRatio) <= MARKUP_VIEWPORT_EPSILON;

export const clampMarkupViewportScale = (value: number) => clampExpertEditCameraScale(value);

export const resolveMarkupViewportOffsetRatioLimit = ({
  scale,
  viewportAxisSize,
  contentAxisSize,
}: {
  scale: number;
  viewportAxisSize?: number;
  contentAxisSize?: number;
}) => {
  const clampedScale = clampMarkupViewportScale(scale);
  const fallbackLimit = Math.max(0, (clampedScale - 1) / 2);
  if (
    !Number.isFinite(viewportAxisSize) ||
    !Number.isFinite(contentAxisSize) ||
    (viewportAxisSize ?? 0) <= 0 ||
    (contentAxisSize ?? 0) <= 0
  ) {
    return fallbackLimit;
  }
  const viewportSize = Math.max(1, viewportAxisSize ?? 1);
  const contentSize = Math.max(1, Math.min(contentAxisSize ?? 1, viewportSize));
  return Math.max(0, ((clampedScale - 1) * contentSize) / (2 * viewportSize));
};

export const clampMarkupViewportOffsetRatio = ({
  scale,
  offsetRatio,
  viewportAxisSize,
  contentAxisSize,
}: {
  scale: number;
  offsetRatio: number;
  viewportAxisSize?: number;
  contentAxisSize?: number;
}) => {
  const limit = resolveMarkupViewportOffsetRatioLimit({
    scale,
    viewportAxisSize,
    contentAxisSize,
  });
  const clampedOffsetRatio = clampNumber(offsetRatio, -limit, limit);
  if (Math.abs(clampedOffsetRatio) <= MARKUP_VIEWPORT_EPSILON) {
    return 0;
  }
  return Math.round(clampedOffsetRatio * 1_000_000) / 1_000_000;
};

export const clampMarkupViewportState = (
  viewport: MarkupViewportState,
  options?: {
    viewportSize?: StageViewportSize | null;
    contentFrameSize?: StageViewportSize | null;
  }
): MarkupViewportState => {
  const scale = clampMarkupViewportScale(viewport.scale);
  const viewportWidth = options?.viewportSize?.width;
  const viewportHeight = options?.viewportSize?.height;
  const contentWidth = options?.contentFrameSize?.width;
  const contentHeight = options?.contentFrameSize?.height;
  return {
    scale,
    offsetXRatio: clampMarkupViewportOffsetRatio({
      scale,
      offsetRatio: viewport.offsetXRatio,
      viewportAxisSize: viewportWidth,
      contentAxisSize: contentWidth,
    }),
    offsetYRatio: clampMarkupViewportOffsetRatio({
      scale,
      offsetRatio: viewport.offsetYRatio,
      viewportAxisSize: viewportHeight,
      contentAxisSize: contentHeight,
    }),
  };
};

export const resolveMoveStageZoomScale = (sliderValue: number) => {
  const clampedValue = clampNumber(
    sliderValue,
    MOVE_STAGE_ZOOM_SLIDER_MIN,
    MOVE_STAGE_ZOOM_SLIDER_MAX
  );
  const progress =
    (clampedValue - MOVE_STAGE_ZOOM_SLIDER_MIN) /
    Math.max(1, MOVE_STAGE_ZOOM_SLIDER_MAX - MOVE_STAGE_ZOOM_SLIDER_MIN);
  return (
    MOVE_STAGE_ZOOM_SCALE_MIN + progress * (MOVE_STAGE_ZOOM_SCALE_MAX - MOVE_STAGE_ZOOM_SCALE_MIN)
  );
};

export const resolveMoveStageZoomSliderValue = (scale: number) => {
  const clampedScale = clampNumber(scale, MOVE_STAGE_ZOOM_SCALE_MIN, MOVE_STAGE_ZOOM_SCALE_MAX);
  const progress =
    (clampedScale - MOVE_STAGE_ZOOM_SCALE_MIN) /
    Math.max(0.0001, MOVE_STAGE_ZOOM_SCALE_MAX - MOVE_STAGE_ZOOM_SCALE_MIN);
  return (
    MOVE_STAGE_ZOOM_SLIDER_MIN +
    progress * (MOVE_STAGE_ZOOM_SLIDER_MAX - MOVE_STAGE_ZOOM_SLIDER_MIN)
  );
};

export const resolveMoveStageZoomSliderValueFromWheelDelta = ({
  sliderValue,
  deltaY,
}: {
  sliderValue: number;
  deltaY: number;
}) =>
  clampNumber(
    sliderValue - deltaY * MOVE_STAGE_ZOOM_WHEEL_STEP_PER_DELTA,
    MOVE_STAGE_ZOOM_SLIDER_MIN,
    MOVE_STAGE_ZOOM_SLIDER_MAX
  );

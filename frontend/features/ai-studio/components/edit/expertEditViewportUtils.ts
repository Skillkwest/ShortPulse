/**
 * Viewport/zoom/pan primitives for Expert Edit stage surfaces.
 */
import type { MarkupViewportState } from "./markupStrokeController";

export const MARKUP_VIEWPORT_SCALE_MIN = 0.5;
export const MARKUP_VIEWPORT_SCALE_MAX = 4;
export const MARKUP_VIEWPORT_DEFAULT_SCALE = 0.95;
export const MARKUP_VIEWPORT_ZOOM_INTENSITY = 0.0018;
export const MARKUP_VIEWPORT_EPSILON = 0.001;
export const MOVE_STAGE_ZOOM_SLIDER_MIN = 0;
export const MOVE_STAGE_ZOOM_SLIDER_MAX = 100;
export const MOVE_STAGE_ZOOM_SLIDER_DEFAULT = 50;
export const MOVE_STAGE_ZOOM_SCALE_MIN = 0.5;
export const MOVE_STAGE_ZOOM_SCALE_MAX = 2;

export type MarkupPanPointerSession = {
  active: boolean;
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

export const clampMarkupViewportScale = (value: number) =>
  clampNumber(value, MARKUP_VIEWPORT_SCALE_MIN, MARKUP_VIEWPORT_SCALE_MAX);

export const resolveMoveStageZoomScale = (sliderValue: number) => {
  const clampedValue = clampNumber(
    sliderValue,
    MOVE_STAGE_ZOOM_SLIDER_MIN,
    MOVE_STAGE_ZOOM_SLIDER_MAX
  );
  if (clampedValue <= MOVE_STAGE_ZOOM_SLIDER_DEFAULT) {
    const progress =
      (clampedValue - MOVE_STAGE_ZOOM_SLIDER_MIN) /
      (MOVE_STAGE_ZOOM_SLIDER_DEFAULT - MOVE_STAGE_ZOOM_SLIDER_MIN);
    return MOVE_STAGE_ZOOM_SCALE_MIN + progress * (1 - MOVE_STAGE_ZOOM_SCALE_MIN);
  }
  const progress =
    (clampedValue - MOVE_STAGE_ZOOM_SLIDER_DEFAULT) /
    (MOVE_STAGE_ZOOM_SLIDER_MAX - MOVE_STAGE_ZOOM_SLIDER_DEFAULT);
  return 1 + progress * (MOVE_STAGE_ZOOM_SCALE_MAX - 1);
};

export const resolveMoveStageZoomSliderValue = (scale: number) => {
  const clampedScale = clampNumber(scale, MOVE_STAGE_ZOOM_SCALE_MIN, MOVE_STAGE_ZOOM_SCALE_MAX);
  if (clampedScale <= 1) {
    const progress = (clampedScale - MOVE_STAGE_ZOOM_SCALE_MIN) / (1 - MOVE_STAGE_ZOOM_SCALE_MIN);
    return Math.round(
      MOVE_STAGE_ZOOM_SLIDER_MIN +
        progress * (MOVE_STAGE_ZOOM_SLIDER_DEFAULT - MOVE_STAGE_ZOOM_SLIDER_MIN)
    );
  }
  const progress = (clampedScale - 1) / (MOVE_STAGE_ZOOM_SCALE_MAX - 1);
  return Math.round(
    MOVE_STAGE_ZOOM_SLIDER_DEFAULT +
      progress * (MOVE_STAGE_ZOOM_SLIDER_MAX - MOVE_STAGE_ZOOM_SLIDER_DEFAULT)
  );
};

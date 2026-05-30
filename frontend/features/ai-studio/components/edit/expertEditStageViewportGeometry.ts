/**
 * Ref-aware geometry adapters for the Expert Edit stage viewport.
 * Bridges DOM stage refs to client-to-surface and viewport-offset calculations.
 */
import type React from "react";

import { resolveValidStageRect } from "./expertEditPanelViewContract";
import {
  isResolvedStageViewportSize,
  resolveMarkupViewportOffsetPixels,
  resolveStageViewportSize,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import type { MarkupViewportState } from "./markupStrokeController";
import {
  resolveNestedSurfaceOffsetFromClientRect,
  resolveNestedSurfacePointFromClientPoint,
  resolveScenePointFromPixelSpace,
} from "./stageSceneGeometry";

type StageViewportRefSet = {
  inlineStageWrapperRef: React.MutableRefObject<HTMLDivElement | null>;
  primaryCanvasFrameStackRef: React.MutableRefObject<HTMLDivElement | null>;
  primaryCompositionSurfaceRef: React.MutableRefObject<HTMLDivElement | null>;
  markupModalStageRef: React.MutableRefObject<HTMLDivElement | null>;
};

/**
 * Resolves the authoritative inline stage rect from wrapper/surface/current-target fallback order.
 */
export const resolveInlineStageRectFromRefs = ({
  inlineStageWrapperRef,
  primaryCanvasFrameStackRef,
  primaryCompositionSurfaceRef,
  currentTarget,
}: Pick<
  StageViewportRefSet,
  "inlineStageWrapperRef" | "primaryCanvasFrameStackRef" | "primaryCompositionSurfaceRef"
> & {
  currentTarget?: HTMLDivElement | null;
}): DOMRect | null => {
  const wrapperRect = resolveValidStageRect(
    inlineStageWrapperRef.current?.getBoundingClientRect() ?? null
  );
  if (wrapperRect) return wrapperRect;
  const frameStackRect = resolveValidStageRect(
    primaryCanvasFrameStackRef.current?.getBoundingClientRect() ?? null
  );
  if (frameStackRect) return frameStackRect;
  const compositionSurfaceRect = resolveValidStageRect(
    primaryCompositionSurfaceRef.current?.getBoundingClientRect() ?? null
  );
  if (compositionSurfaceRect) return compositionSurfaceRect;
  return resolveValidStageRect(currentTarget?.getBoundingClientRect() ?? null);
};

/**
 * Resolves viewport pan offsets for either inline or modal stage interaction targets.
 */
export const resolveInteractionViewportOffsetPixelsFromRefs = ({
  refs,
  hasPrimaryCompositePreview,
  markupModalViewportSize,
  inlineStageViewportSize,
  markupViewport,
  interactionRect,
  currentTarget,
}: {
  refs: Pick<
    StageViewportRefSet,
    | "inlineStageWrapperRef"
    | "primaryCanvasFrameStackRef"
    | "primaryCompositionSurfaceRef"
    | "markupModalStageRef"
  >;
  hasPrimaryCompositePreview: boolean;
  markupModalViewportSize: StageViewportSize;
  inlineStageViewportSize: StageViewportSize;
  markupViewport: MarkupViewportState;
  interactionRect: DOMRect;
  currentTarget: HTMLDivElement;
}): { offsetX: number; offsetY: number } => {
  if (!hasPrimaryCompositePreview) {
    return {
      offsetX: 0,
      offsetY: 0,
    };
  }
  const authoritativeViewportSize =
    currentTarget === refs.markupModalStageRef.current
      ? isResolvedStageViewportSize(markupModalViewportSize)
        ? markupModalViewportSize
        : resolveStageViewportSize(
            resolveValidStageRect(
              refs.markupModalStageRef.current?.getBoundingClientRect() ?? interactionRect
            )
          )
      : isResolvedStageViewportSize(inlineStageViewportSize)
        ? inlineStageViewportSize
        : resolveStageViewportSize(
            resolveInlineStageRectFromRefs({
              inlineStageWrapperRef: refs.inlineStageWrapperRef,
              primaryCanvasFrameStackRef: refs.primaryCanvasFrameStackRef,
              primaryCompositionSurfaceRef: refs.primaryCompositionSurfaceRef,
              currentTarget,
            }) ?? interactionRect
          );
  return resolveMarkupViewportOffsetPixels(markupViewport, authoritativeViewportSize);
};

const resolveInlineCompositionSurfaceMetrics = ({
  inlineStageWrapperRef,
  primaryCanvasFrameStackRef,
  primaryCompositionSurfaceRef,
}: Pick<
  StageViewportRefSet,
  "inlineStageWrapperRef" | "primaryCanvasFrameStackRef" | "primaryCompositionSurfaceRef"
>) => {
  const wrapperRect = resolveInlineStageRectFromRefs({
    inlineStageWrapperRef,
    primaryCanvasFrameStackRef,
    primaryCompositionSurfaceRef,
  });
  const frameStackElement = primaryCanvasFrameStackRef.current;
  const surfaceElement = primaryCompositionSurfaceRef.current;
  if (!wrapperRect) {
    return null;
  }
  const fallbackSurfaceRect = resolveValidStageRect(
    surfaceElement?.getBoundingClientRect() ?? null
  );
  const surfaceWidth = Math.max(
    1,
    frameStackElement?.clientWidth || surfaceElement?.clientWidth || fallbackSurfaceRect?.width || 1
  );
  const surfaceHeight = Math.max(
    1,
    frameStackElement?.clientHeight ||
      surfaceElement?.clientHeight ||
      fallbackSurfaceRect?.height ||
      1
  );
  if (surfaceWidth <= 0 || surfaceHeight <= 0) {
    return null;
  }
  return {
    wrapperRect,
    frameStackElement,
    surfaceElement,
    fallbackSurfaceRect,
    surfaceWidth,
    surfaceHeight,
  };
};

/**
 * Resolves a client point into composition-surface pixel space for the inline stage.
 */
export const resolveInlineCompositionSurfacePointFromRefs = ({
  refs,
  markupViewport,
  clientX,
  clientY,
  clampToBounds,
}: {
  refs: Pick<
    StageViewportRefSet,
    "inlineStageWrapperRef" | "primaryCanvasFrameStackRef" | "primaryCompositionSurfaceRef"
  >;
  markupViewport: MarkupViewportState;
  clientX: number;
  clientY: number;
  clampToBounds: boolean;
}): { x: number; y: number } | null => {
  const metrics = resolveInlineCompositionSurfaceMetrics(refs);
  if (!metrics) return null;
  const viewportTransform = {
    scale: markupViewport.scale,
    offsetX: markupViewport.offsetXRatio * metrics.wrapperRect.width,
    offsetY: markupViewport.offsetYRatio * metrics.wrapperRect.height,
  };
  const resolvedSurfaceOffset = metrics.fallbackSurfaceRect
    ? resolveNestedSurfaceOffsetFromClientRect({
        viewportRect: metrics.wrapperRect,
        viewportTransform,
        surfaceRect: metrics.fallbackSurfaceRect,
        surfaceWidth: metrics.surfaceWidth,
        surfaceHeight: metrics.surfaceHeight,
      })
    : null;
  return resolveNestedSurfacePointFromClientPoint({
    clientX,
    clientY,
    viewportRect: metrics.wrapperRect,
    viewportTransform,
    surfaceOffsetX:
      resolvedSurfaceOffset?.offsetX ??
      metrics.frameStackElement?.offsetLeft ??
      metrics.surfaceElement?.offsetLeft ??
      0,
    surfaceOffsetY:
      resolvedSurfaceOffset?.offsetY ??
      metrics.frameStackElement?.offsetTop ??
      metrics.surfaceElement?.offsetTop ??
      0,
    surfaceWidth: metrics.surfaceWidth,
    surfaceHeight: metrics.surfaceHeight,
    clampToBounds,
  });
};

/**
 * Resolves a client point into normalized scene space for the inline stage.
 */
export const resolveInlineCompositionScenePointFromRefs = ({
  refs,
  markupViewport,
  clientX,
  clientY,
  clampToBounds,
}: {
  refs: Pick<
    StageViewportRefSet,
    "inlineStageWrapperRef" | "primaryCanvasFrameStackRef" | "primaryCompositionSurfaceRef"
  >;
  markupViewport: MarkupViewportState;
  clientX: number;
  clientY: number;
  clampToBounds: boolean;
}): { sceneX: number; sceneY: number } | null => {
  const surfacePoint = resolveInlineCompositionSurfacePointFromRefs({
    refs,
    markupViewport,
    clientX,
    clientY,
    clampToBounds,
  });
  const metrics = resolveInlineCompositionSurfaceMetrics(refs);
  if (!surfacePoint || !metrics) {
    return null;
  }
  const scenePoint = resolveScenePointFromPixelSpace({
    x: surfacePoint.x,
    y: surfacePoint.y,
    spaceWidth: metrics.surfaceWidth,
    spaceHeight: metrics.surfaceHeight,
  });
  return {
    sceneX: scenePoint.x,
    sceneY: scenePoint.y,
  };
};

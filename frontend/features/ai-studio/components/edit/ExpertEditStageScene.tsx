import React from "react";

import {
  isMarkupStrokeClosedShape,
  MARKUP_LASSO_FILL_OPACITY,
  MARKUP_OVERLAY_OPACITY,
  resolveMarkupStrokeKind,
  resolveMarkupStrokePointRadiusPx,
  resolveMarkupStrokePointToSurfacePoint,
  resolveMarkupStrokeWidthPx,
  type MarkupStroke,
} from "./markupStrokeController";
import {
  clampLayerOpacity,
  resolveLayerVisualGeometry,
  type LayerTransform,
} from "./expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import {
  isResolvedStageViewportSize,
  resolveRenderableStageViewportSize,
  type StageViewportSize,
} from "./expertEditViewportUtils";

type ExpertEditStageSceneProps = {
  scope: "inline" | "modal";
  layers: ExpertEditLayer[];
  markupStrokes: MarkupStroke[];
  overlayCanvasRef: React.Ref<HTMLCanvasElement>;
  previewCanvasRef: React.Ref<HTMLCanvasElement>;
  stageSize: StageViewportSize;
  stageElement: HTMLDivElement | null;
  inlineFallbackStageSize: StageViewportSize;
  resolveLayerImageAspectRatio: (layer: ExpertEditLayer) => number;
  resolveRenderableLayerTransform: (layer: ExpertEditLayer) => LayerTransform;
  isFlattenPending: boolean;
  isRemoveBackgroundPending: boolean;
  isPrimaryStageGenerating: boolean;
};

const renderBusyOverlay = ({
  isFlattenPending,
  isRemoveBackgroundPending,
  isPrimaryStageGenerating,
}: Pick<
  ExpertEditStageSceneProps,
  "isFlattenPending" | "isRemoveBackgroundPending" | "isPrimaryStageGenerating"
>): React.ReactNode | null => {
  if (isFlattenPending) {
    return (
      <div
        className="edit-expert-primary-layer-loading-overlay"
        data-testid="edit-expert-flatten-loading-overlay"
      >
        <div
          className="edit-expert-primary-layer-loading"
          role="status"
          aria-label="Flattening layers"
          aria-live="polite"
        >
          <span className="edit-expert-primary-layer-loading-spinner" aria-hidden="true" />
          <span className="edit-expert-primary-layer-loading-text">Flattening layers...</span>
        </div>
      </div>
    );
  }

  if (isRemoveBackgroundPending) {
    return (
      <div
        className="edit-expert-primary-layer-loading-overlay"
        data-testid="edit-expert-remove-background-loading-overlay"
      >
        <div
          className="edit-expert-primary-layer-loading"
          role="status"
          aria-label="Removing background"
          aria-live="polite"
        >
          <span className="edit-expert-primary-layer-loading-spinner" aria-hidden="true" />
          <span className="edit-expert-primary-layer-loading-text">Removing background...</span>
        </div>
      </div>
    );
  }

  if (isPrimaryStageGenerating) {
    return (
      <div
        className="edit-expert-primary-layer-loading-overlay"
        data-testid="edit-expert-inline-generate-loading-overlay"
      >
        <div
          className="edit-expert-primary-layer-loading"
          role="status"
          aria-label="Generating image"
          aria-live="polite"
        >
          <span className="edit-expert-primary-layer-loading-spinner" aria-hidden="true" />
          <span className="edit-expert-primary-layer-loading-text">Generating...</span>
        </div>
      </div>
    );
  }

  return null;
};

const renderMarkupStrokeOverlay = ({
  scope,
  markupStrokes,
  stageSize,
}: Pick<ExpertEditStageSceneProps, "scope" | "markupStrokes"> & {
  stageSize: StageViewportSize;
}) => {
  if (!markupStrokes.length) return null;

  const stageWidth = Math.max(1, stageSize.width);
  const stageHeight = Math.max(1, stageSize.height);

  return (
    <svg
      className="edit-expert-markup-strokes-overlay"
      viewBox={`0 0 ${stageWidth} ${stageHeight}`}
      aria-hidden="true"
    >
      <g data-markup-layer="strokes" opacity={MARKUP_OVERLAY_OPACITY}>
        {markupStrokes.map((stroke) => {
          const strokeWidthPx = resolveMarkupStrokeWidthPx({
            stroke,
            stageHeight,
          });
          const strokeKind = resolveMarkupStrokeKind(stroke);
          if (stroke.points.length <= 1) {
            const point = stroke.points[0];
            if (!point) return null;
            const pointPx = resolveMarkupStrokePointToSurfacePoint({
              point,
              stageWidth,
              stageHeight,
            });
            return (
              <circle
                key={`${scope}-${stroke.id}-point`}
                cx={pointPx.x}
                cy={pointPx.y}
                r={resolveMarkupStrokePointRadiusPx({
                  stroke,
                  stageHeight,
                })}
                fill={stroke.color}
              />
            );
          }

          const pointsValue = stroke.points
            .map((point) => {
              const pointPx = resolveMarkupStrokePointToSurfacePoint({
                point,
                stageWidth,
                stageHeight,
              });
              return `${pointPx.x},${pointPx.y}`;
            })
            .join(" ");

          if (isMarkupStrokeClosedShape(stroke)) {
            return (
              <polygon
                key={`${scope}-${stroke.id}`}
                points={pointsValue}
                fill={stroke.color}
                fillOpacity={MARKUP_LASSO_FILL_OPACITY}
                stroke={stroke.color}
                strokeWidth={strokeWidthPx}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }

          return (
            <polyline
              key={`${scope}-${stroke.id}`}
              points={pointsValue}
              fill="none"
              stroke={stroke.color}
              strokeWidth={strokeWidthPx}
              strokeLinecap="round"
              strokeLinejoin="round"
              data-markup-kind={strokeKind}
            />
          );
        })}
      </g>
    </svg>
  );
};

export function ExpertEditStageScene({
  scope,
  layers,
  markupStrokes,
  overlayCanvasRef,
  previewCanvasRef,
  stageSize,
  stageElement,
  inlineFallbackStageSize,
  resolveLayerImageAspectRatio,
  resolveRenderableLayerTransform,
  isFlattenPending,
  isRemoveBackgroundPending,
  isPrimaryStageGenerating,
}: ExpertEditStageSceneProps) {
  const resolvedStageSize = resolveRenderableStageViewportSize({
    preferredSize: stageSize,
    stageElement,
  });
  const renderStageSize =
    scope === "modal" &&
    !isResolvedStageViewportSize(resolvedStageSize) &&
    isResolvedStageViewportSize(inlineFallbackStageSize)
      ? inlineFallbackStageSize
      : resolvedStageSize;

  return (
    <>
      {layers.map((layer, index) =>
        layer.imageUrl
          ? (() => {
              const constrainedTransform = resolveRenderableLayerTransform(layer);
              const layerGeometry = resolveLayerVisualGeometry({
                imageAspectRatio: resolveLayerImageAspectRatio(layer),
                viewportWidth: renderStageSize.width,
                viewportHeight: renderStageSize.height,
                transform: constrainedTransform,
              });
              const layerRect = layerGeometry.containedRect;

              return (
                <div
                  key={scope === "modal" ? `markup-modal-${layer.id}` : layer.id}
                  className="edit-expert-primary-layer-frame"
                  style={{
                    left: `${layerRect.leftPercent}%`,
                    top: `${layerRect.topPercent}%`,
                    width: `${layerRect.widthPercent}%`,
                    height: `${layerRect.heightPercent}%`,
                    backgroundImage: `url(${layer.imageUrl})`,
                    zIndex: layers.length - index,
                    opacity: clampLayerOpacity(layer.opacity),
                    transform: layerGeometry.transformCss,
                    transformOrigin: "center center",
                  }}
                />
              );
            })()
          : null
      )}
      <canvas
        ref={overlayCanvasRef}
        className="edit-expert-inpaint-overlay-canvas"
        aria-hidden="true"
      />
      <canvas
        ref={previewCanvasRef}
        className="edit-expert-inpaint-live-preview-canvas"
        aria-hidden="true"
      />
      {renderMarkupStrokeOverlay({
        scope,
        markupStrokes,
        stageSize: renderStageSize,
      })}
      {renderBusyOverlay({
        isFlattenPending,
        isRemoveBackgroundPending,
        isPrimaryStageGenerating,
      })}
    </>
  );
}

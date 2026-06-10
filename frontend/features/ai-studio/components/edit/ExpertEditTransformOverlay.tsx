/**
 * Presentational selected-layer transform overlay for Expert Edit.
 */
import React from "react";

import { selectedLayerTransformHandleCorners } from "./expertEditPanelViewContract";
import { resolveLayerVisualGeometry, type LayerTransform } from "./expertEditLayerTransformUtils";

type ExpertEditTransformOverlayProps = {
  scope: "inline" | "modal";
  viewportWidth: number;
  viewportHeight: number;
  viewportScale?: number;
  imageAspectRatio: number;
  transform: LayerTransform;
  interactionHandlers?: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onPointerLeave"
  >;
};

/**
 * Renders the selected-layer transform box and corner handles.
 */
export function ExpertEditTransformOverlay({
  scope,
  viewportWidth,
  viewportHeight,
  viewportScale = 1,
  imageAspectRatio,
  transform,
  interactionHandlers,
}: ExpertEditTransformOverlayProps) {
  const layerGeometry = resolveLayerVisualGeometry({
    imageAspectRatio,
    viewportWidth,
    viewportHeight,
    viewportScale,
    transform,
  });
  const layerRect = layerGeometry.containedRect;
  const overlayStyle: React.CSSProperties & {
    "--edit-expert-transform-handle-counter-scale": string;
  } = {
    left: `${layerRect.leftPercent}%`,
    top: `${layerRect.topPercent}%`,
    width: `${layerRect.widthPercent}%`,
    height: `${layerRect.heightPercent}%`,
    transform: layerGeometry.transformCss,
    transformOrigin: "center center",
    "--edit-expert-transform-handle-counter-scale": String(
      layerGeometry.transformHandleCounterScale
    ),
  };

  return (
    <div
      className="edit-expert-primary-layer-selection-overlay"
      onPointerDown={interactionHandlers?.onPointerDown}
      onPointerMove={interactionHandlers?.onPointerMove}
      onPointerUp={interactionHandlers?.onPointerUp}
      onPointerCancel={interactionHandlers?.onPointerCancel}
      onPointerLeave={interactionHandlers?.onPointerLeave}
      style={overlayStyle}
      aria-hidden="true"
      data-edit-expert-transform-drag-mode="move"
      data-testid={`edit-expert-transform-overlay-${scope}`}
    >
      <div className="edit-expert-primary-layer-selection-box">
        <span className="edit-expert-primary-layer-selection-outline" />
        {selectedLayerTransformHandleCorners.map((corner) => (
          <span
            key={`${scope}-selected-layer-handle-${corner}`}
            className={`edit-expert-primary-layer-selection-handle is-corner-${corner}`}
            data-edit-expert-transform-drag-mode="resize"
            data-testid={`edit-expert-transform-handle-${scope}-${corner}`}
          />
        ))}
      </div>
    </div>
  );
}

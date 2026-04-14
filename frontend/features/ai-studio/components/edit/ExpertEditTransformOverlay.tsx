/**
 * Presentational selected-layer transform overlay for Expert Edit.
 */
import React from "react";

import { selectedLayerTransformHandleCorners } from "./expertEditPanelViewContract";
import { resolveContainedLayerRect, type LayerTransform } from "./expertEditLayerTransformUtils";

type ExpertEditTransformOverlayProps = {
  scope: "inline" | "modal";
  viewportWidth: number;
  viewportHeight: number;
  imageAspectRatio: number;
  transform: LayerTransform;
  scale: number;
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
  imageAspectRatio,
  transform,
  scale,
  interactionHandlers,
}: ExpertEditTransformOverlayProps) {
  const layerRect = resolveContainedLayerRect({
    imageAspectRatio,
    viewportWidth,
    viewportHeight,
  });
  const translateX = transform.translateXRatio * viewportWidth;
  const translateY = transform.translateYRatio * viewportHeight;

  return (
    <div
      className="edit-expert-primary-layer-selection-overlay"
      onPointerDown={interactionHandlers?.onPointerDown}
      onPointerMove={interactionHandlers?.onPointerMove}
      onPointerUp={interactionHandlers?.onPointerUp}
      onPointerCancel={interactionHandlers?.onPointerCancel}
      onPointerLeave={interactionHandlers?.onPointerLeave}
      style={{
        left: `${layerRect.leftPercent}%`,
        top: `${layerRect.topPercent}%`,
        width: `${layerRect.widthPercent}%`,
        height: `${layerRect.heightPercent}%`,
        transform: `translate(${Math.round(translateX * 100) / 100}px, ${
          Math.round(translateY * 100) / 100
        }px) rotate(${transform.rotationDeg}deg)`,
        transformOrigin: "center center",
      }}
      aria-hidden="true"
      data-testid={`edit-expert-transform-overlay-${scope}`}
    >
      <div
        className="edit-expert-primary-layer-selection-box"
        style={{
          width: `${Math.max(0.0001, scale * 100)}%`,
          height: `${Math.max(0.0001, scale * 100)}%`,
        }}
      >
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

import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultLayerTransform } from "../expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import { useExpertEditTransformSession } from "../useExpertEditTransformSession";

const createLayer = (transform: ExpertEditLayer["transform"]): ExpertEditLayer => ({
  id: "layer-1",
  name: "layer 1",
  imageUrl: "https://example.com/image.png",
  opacity: 1,
  isAutoNamed: true,
  ownsImageUrl: false,
  transform,
});

describe("useExpertEditTransformSession", () => {
  it("renders selected-layer handles counter-scaled by layer scale and stage zoom", () => {
    const layer = createLayer({
      translateXRatio: 0,
      translateYRatio: 0,
      scale: 0.25,
      rotationDeg: 0,
    });

    const { result } = renderHook(() =>
      useExpertEditTransformSession({
        layers: [layer],
        setLayers: vi.fn(),
        selectedLayer: layer,
        selectedLayerInteractionTransform: layer.transform,
        selectedLayerImageAspectRatio: 1,
        shouldShowSelectedLayerTransformOverlay: true,
        resolveRenderableLayerTransform: (selectedLayer) => selectedLayer.transform,
        sceneZoomScale: 2,
        viewportOffsetXRatio: 0,
        viewportOffsetYRatio: 0,
        resolveViewportOffsetPixels: () => ({ offsetX: 0, offsetY: 0 }),
        beginPanelHistoryGestureForLayers: vi.fn(),
        finalizePanelHistoryGesture: vi.fn(),
        commitTransformHistoryTransition: vi.fn(),
        showStatusToast: vi.fn(),
        transformHistoryState: {
          past: [],
          present: {
            layerOrderSignature: "layer-1",
            layerSnapshots: [{ layerId: "layer-1", transform: layer.transform }],
          },
          future: [],
        },
        setTransformHistoryState: vi.fn(),
      })
    );

    render(
      result.current.renderSelectedLayerTransformOverlay(
        "inline",
        { width: 400, height: 400 },
        null
      )
    );

    const overlay = screen.getByTestId("edit-expert-transform-overlay-inline");
    expect(overlay.style.transform).toContain("scale(0.25)");
    expect(overlay.style.getPropertyValue("--edit-expert-transform-handle-counter-scale")).toBe(
      "2"
    );
  });

  it("does not persist presentation-safe transforms back into layer state on mount", () => {
    const setLayers = vi.fn();
    const setTransformHistoryState = vi.fn();
    const tinyTransform = {
      translateXRatio: 0.1,
      translateYRatio: -0.1,
      scale: 0.2,
      rotationDeg: 12,
    };
    const layers = [createLayer(tinyTransform)];

    renderHook(() =>
      useExpertEditTransformSession({
        layers,
        setLayers,
        selectedLayer: layers[0] ?? null,
        selectedLayerInteractionTransform: defaultLayerTransform(),
        selectedLayerImageAspectRatio: 1,
        shouldShowSelectedLayerTransformOverlay: true,
        resolveRenderableLayerTransform: () => defaultLayerTransform(),
        sceneZoomScale: 1,
        viewportOffsetXRatio: 0,
        viewportOffsetYRatio: 0,
        resolveViewportOffsetPixels: () => ({ offsetX: 0, offsetY: 0 }),
        beginPanelHistoryGestureForLayers: vi.fn(),
        finalizePanelHistoryGesture: vi.fn(),
        commitTransformHistoryTransition: vi.fn(),
        showStatusToast: vi.fn(),
        transformHistoryState: {
          past: [],
          present: {
            layerOrderSignature: "layer-1",
            layerSnapshots: [{ layerId: "layer-1", transform: tinyTransform }],
          },
          future: [],
        },
        setTransformHistoryState,
      })
    );

    expect(setLayers).not.toHaveBeenCalled();
  });

  it("preserves transform undo history across same-topology sync updates", () => {
    const committedTransform = {
      translateXRatio: 0.25,
      translateYRatio: -0.1,
      scale: 1.2,
      rotationDeg: 0,
    };
    const originalTransform = defaultLayerTransform();
    const undoEntry = {
      layerOrderSignature: "layer-1",
      layerSnapshots: [{ layerId: "layer-1", transform: originalTransform }],
    };
    const presentEntry = {
      layerOrderSignature: "layer-1",
      layerSnapshots: [{ layerId: "layer-1", transform: committedTransform }],
    };
    const futureEntry = {
      layerOrderSignature: "layer-1",
      layerSnapshots: [
        {
          layerId: "layer-1",
          transform: {
            translateXRatio: 0.4,
            translateYRatio: 0,
            scale: 1.4,
            rotationDeg: 0,
          },
        },
      ],
    };
    const setTransformHistoryState = vi.fn();

    renderHook(() =>
      useExpertEditTransformSession({
        layers: [createLayer(defaultLayerTransform())],
        setLayers: vi.fn(),
        selectedLayer: createLayer(defaultLayerTransform()),
        selectedLayerInteractionTransform: defaultLayerTransform(),
        selectedLayerImageAspectRatio: 1,
        shouldShowSelectedLayerTransformOverlay: true,
        resolveRenderableLayerTransform: (layer) => layer.transform,
        sceneZoomScale: 1,
        viewportOffsetXRatio: 0,
        viewportOffsetYRatio: 0,
        resolveViewportOffsetPixels: () => ({ offsetX: 0, offsetY: 0 }),
        beginPanelHistoryGestureForLayers: vi.fn(),
        finalizePanelHistoryGesture: vi.fn(),
        commitTransformHistoryTransition: vi.fn(),
        showStatusToast: vi.fn(),
        transformHistoryState: {
          past: [undoEntry],
          present: presentEntry,
          future: [futureEntry],
        },
        setTransformHistoryState,
      })
    );

    const updateHistoryState = setTransformHistoryState.mock.calls[0]?.[0];
    expect(typeof updateHistoryState).toBe("function");
    expect(
      updateHistoryState({
        past: [undoEntry],
        present: presentEntry,
        future: [futureEntry],
      })
    ).toEqual({
      past: [undoEntry],
      present: {
        layerOrderSignature: "layer-1",
        layerSnapshots: [{ layerId: "layer-1", transform: defaultLayerTransform() }],
      },
      future: [futureEntry],
    });
  });
});

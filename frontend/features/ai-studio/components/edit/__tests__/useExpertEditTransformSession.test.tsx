import { renderHook } from "@testing-library/react";
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
});

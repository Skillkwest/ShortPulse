import { describe, expect, it } from "vitest";

import { resolveInitialLayerSessionState } from "../expertEditLayerSessionUtils";

describe("resolveInitialLayerSessionState", () => {
  it("preserves raw tiny single-image transforms during restore", () => {
    const state = resolveInitialLayerSessionState({
      referenceImageUrl: null,
      layerState: {
        layerIdCounter: 2,
        foundationLayerId: "layer-1",
        selectedLayerIndex: 0,
        layers: [
          {
            id: "layer-1",
            name: "layer 1",
            imageUrl: "https://example.com/image.png",
            opacity: 1,
            isAutoNamed: true,
            ownsImageUrl: false,
            transform: {
              translateXRatio: 0,
              translateYRatio: 0,
              scale: 0.2,
              rotationDeg: 0,
            },
          },
        ],
      },
    });

    expect(state.layers[0]?.transform).toEqual({
      translateXRatio: 0,
      translateYRatio: 0,
      scale: 0.2,
      rotationDeg: 0,
    });
  });

  it("preserves multi-layer transforms so compositing workflows are not rewritten", () => {
    const state = resolveInitialLayerSessionState({
      referenceImageUrl: null,
      layerState: {
        layerIdCounter: 3,
        foundationLayerId: "layer-1",
        selectedLayerIndex: 1,
        layers: [
          {
            id: "layer-1",
            name: "layer 1",
            imageUrl: "https://example.com/base.png",
            opacity: 1,
            isAutoNamed: true,
            ownsImageUrl: false,
            transform: {
              translateXRatio: 0,
              translateYRatio: 0,
              scale: 1,
              rotationDeg: 0,
            },
          },
          {
            id: "layer-2",
            name: "layer 2",
            imageUrl: "https://example.com/overlay.png",
            opacity: 1,
            isAutoNamed: true,
            ownsImageUrl: false,
            transform: {
              translateXRatio: 0,
              translateYRatio: 0,
              scale: 0.2,
              rotationDeg: 0,
            },
          },
        ],
      },
    });

    expect(state.layers[1]?.transform.scale).toBe(0.2);
  });
});

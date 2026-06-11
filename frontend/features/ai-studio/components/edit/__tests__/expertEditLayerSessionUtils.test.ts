import { describe, expect, it } from "vitest";

import { resolveInitialLayerSessionState } from "../expertEditLayerSessionUtils";

describe("resolveInitialLayerSessionState", () => {
  it("preserves raw tiny single-image transforms during restore", () => {
    const state = resolveInitialLayerSessionState({
      referenceImageUrl: "https://example.com/image.png",
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
      flipX: false,
      flipY: false,
    });
  });

  it("preserves multi-layer transforms so compositing workflows are not rewritten", () => {
    const state = resolveInitialLayerSessionState({
      referenceImageUrl: "https://example.com/base.png",
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

  it("does not seed a fallback layer for non-image reference URLs", () => {
    const state = resolveInitialLayerSessionState({
      referenceImageUrl: "https://example.com/reference-audio.mp3",
      layerState: null,
    });

    expect(state).toEqual({
      layers: [],
      foundationLayerId: null,
      selectedLayerIndex: null,
      layerIdCounter: 1,
    });
  });

  it("ignores stale restored edit layers when the current entry has no image authority", () => {
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
            imageUrl: "https://example.com/stale-image.png",
            opacity: 1,
            isAutoNamed: true,
            ownsImageUrl: false,
            transform: {
              translateXRatio: 0.2,
              translateYRatio: -0.1,
              scale: 0.8,
              rotationDeg: 15,
            },
          },
        ],
      },
    });

    expect(state).toEqual({
      layers: [],
      foundationLayerId: null,
      selectedLayerIndex: null,
      layerIdCounter: 1,
    });
  });
});

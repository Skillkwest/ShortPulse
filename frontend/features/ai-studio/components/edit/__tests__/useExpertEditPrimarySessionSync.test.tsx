import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultLayerTransform } from "../expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import { useExpertEditPrimarySessionSync } from "../useExpertEditPrimarySessionSync";

const createLayer = (
  id: string,
  {
    imageUrl = null,
    transform = defaultLayerTransform(),
  }: {
    imageUrl?: string | null;
    transform?: ExpertEditLayer["transform"];
  } = {}
): ExpertEditLayer => ({
  id,
  name: id,
  imageUrl,
  opacity: 1,
  isAutoNamed: true,
  ownsImageUrl: false,
  transform,
});

describe("useExpertEditPrimarySessionSync", () => {
  it("preserves raw tiny single-image transforms during remove-background host sync", async () => {
    const onPrimaryImageChange = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/original.png" };

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayer("layer-1", {
          imageUrl: "https://example.com/original.png",
          transform: {
            translateXRatio: 0.1,
            translateYRatio: -0.1,
            scale: 0.2,
            rotationDeg: 12,
          },
        }),
      ]);

      useExpertEditPrimarySessionSync({
        selectedLayerIndex: 0,
        referenceImageUrl: "https://example.com/updated.png",
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: "layer-1",
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        setLayers,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/updated.png");
    expect(result.current.layers[0]?.transform).toEqual({
      translateXRatio: 0.1,
      translateYRatio: -0.1,
      scale: 0.2,
      rotationDeg: 12,
    });
  });

  it("preserves tiny transforms for multi-layer remove-background reconciliation", async () => {
    const onPrimaryImageChange = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/base.png" };
    const tinyTransform = {
      translateXRatio: 0.05,
      translateYRatio: 0.02,
      scale: 0.2,
      rotationDeg: 0,
    };

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayer("layer-1", {
          imageUrl: "https://example.com/base.png",
          transform: tinyTransform,
        }),
        createLayer("layer-2", {
          imageUrl: "https://example.com/overlay.png",
        }),
      ]);

      useExpertEditPrimarySessionSync({
        selectedLayerIndex: 0,
        referenceImageUrl: "https://example.com/base-updated.png",
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: "layer-1",
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        setLayers,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/base-updated.png");
    expect(result.current.layers[0]?.transform).toEqual(tinyTransform);
  });

  it("targets the foundation layer instead of the selected overlay during host sync", async () => {
    const onPrimaryImageChange = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/base.png" };

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayer("layer-1", {
          imageUrl: "https://example.com/base.png",
        }),
        createLayer("layer-2", {
          imageUrl: "https://example.com/overlay.png",
        }),
      ]);

      useExpertEditPrimarySessionSync({
        selectedLayerIndex: 1,
        referenceImageUrl: "https://example.com/base-updated.png",
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: null,
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        setLayers,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/base-updated.png");
    expect(result.current.layers[1]?.imageUrl).toBe("https://example.com/overlay.png");
  });
});

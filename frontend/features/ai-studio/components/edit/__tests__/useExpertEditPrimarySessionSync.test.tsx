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
    const rebasePanelHistoryLayerImage = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/original.png" };
    const suppressNextPrimaryPublishUrlRef = { current: null as string | null };
    const removeBackgroundPendingSourceUrlRef = {
      current: "https://example.com/original.png" as string | null,
    };

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
        layers,
        selectedLayerIndex: 0,
        referenceImageUrl: "https://example.com/updated.png",
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: "layer-1",
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        suppressNextPrimaryPublishUrlRef,
        removeBackgroundPendingSourceUrlRef,
        setLayers,
        rebasePanelHistoryLayerImage,
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
    expect(rebasePanelHistoryLayerImage).toHaveBeenCalledWith({
      layerId: "layer-1",
      previousImageUrl: "https://example.com/original.png",
      nextImageUrl: "https://example.com/updated.png",
      ownsImageUrl: false,
    });
  });

  it("preserves tiny transforms for multi-layer remove-background reconciliation", async () => {
    const onPrimaryImageChange = vi.fn();
    const rebasePanelHistoryLayerImage = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/base.png" };
    const suppressNextPrimaryPublishUrlRef = { current: null as string | null };
    const removeBackgroundPendingSourceUrlRef = {
      current: "https://example.com/base.png" as string | null,
    };
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
        layers,
        selectedLayerIndex: 0,
        referenceImageUrl: "https://example.com/base-updated.png",
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: "layer-1",
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        suppressNextPrimaryPublishUrlRef,
        removeBackgroundPendingSourceUrlRef,
        setLayers,
        rebasePanelHistoryLayerImage,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/base-updated.png");
    expect(result.current.layers[0]?.transform).toEqual(tinyTransform);
    expect(rebasePanelHistoryLayerImage).toHaveBeenCalledWith({
      layerId: "layer-1",
      previousImageUrl: "https://example.com/base.png",
      nextImageUrl: "https://example.com/base-updated.png",
      ownsImageUrl: false,
    });
  });

  it("targets the foundation layer instead of the selected overlay during host sync", async () => {
    const onPrimaryImageChange = vi.fn();
    const rebasePanelHistoryLayerImage = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/base.png" };
    const suppressNextPrimaryPublishUrlRef = { current: null as string | null };
    const removeBackgroundPendingSourceUrlRef = { current: null as string | null };

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
        layers,
        selectedLayerIndex: 1,
        referenceImageUrl: "https://example.com/base-updated.png",
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: null,
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        suppressNextPrimaryPublishUrlRef,
        removeBackgroundPendingSourceUrlRef,
        setLayers,
        rebasePanelHistoryLayerImage,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/base-updated.png");
    expect(result.current.layers[1]?.imageUrl).toBe("https://example.com/overlay.png");
    expect(rebasePanelHistoryLayerImage).not.toHaveBeenCalled();
  });

  it("clears the foundation image when host image authority becomes non-image", async () => {
    const onPrimaryImageChange = vi.fn();
    const rebasePanelHistoryLayerImage = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/base.png" };
    const suppressNextPrimaryPublishUrlRef = { current: null as string | null };
    const removeBackgroundPendingSourceUrlRef = { current: null as string | null };

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayer("layer-1", {
          imageUrl: "https://example.com/base.png",
        }),
      ]);

      useExpertEditPrimarySessionSync({
        layers,
        selectedLayerIndex: 0,
        referenceImageUrl: "https://example.com/reference-audio.mp3",
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: null,
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        suppressNextPrimaryPublishUrlRef,
        removeBackgroundPendingSourceUrlRef,
        setLayers,
        rebasePanelHistoryLayerImage,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.layers[0]?.imageUrl).toBeNull();
    expect(result.current.layers[0]?.transform).toEqual(defaultLayerTransform());
    expect(rebasePanelHistoryLayerImage).not.toHaveBeenCalled();
  });

  it("clears a stale foundation image on the initial sync pass when no host image exists", async () => {
    const onPrimaryImageChange = vi.fn();
    const rebasePanelHistoryLayerImage = vi.fn();
    const lastDispatchedPrimaryRef = { current: null as string | null };
    const previousPrimaryPropRef = { current: null as string | null };
    const suppressNextPrimaryPublishUrlRef = { current: null as string | null };
    const removeBackgroundPendingSourceUrlRef = { current: null as string | null };

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayer("layer-1", {
          imageUrl: "https://example.com/stale.png",
          transform: {
            translateXRatio: 0.2,
            translateYRatio: -0.1,
            scale: 0.75,
            rotationDeg: 10,
          },
        }),
      ]);

      useExpertEditPrimarySessionSync({
        layers,
        selectedLayerIndex: 0,
        referenceImageUrl: null,
        hostPrimaryImageUrl: null,
        removeBackgroundPendingLayerId: null,
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        suppressNextPrimaryPublishUrlRef,
        removeBackgroundPendingSourceUrlRef,
        setLayers,
        rebasePanelHistoryLayerImage,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.layers[0]?.imageUrl).toBeNull();
    expect(result.current.layers[0]?.transform).toEqual(defaultLayerTransform());
    expect(rebasePanelHistoryLayerImage).not.toHaveBeenCalled();
  });

  it("suppresses the next host publish when manual flatten marks the primary as panel-local only", async () => {
    const onPrimaryImageChange = vi.fn();
    const rebasePanelHistoryLayerImage = vi.fn();
    const lastDispatchedPrimaryRef = { current: "https://example.com/base.png" as string | null };
    const previousPrimaryPropRef = { current: "https://example.com/base.png" as string | null };
    const suppressNextPrimaryPublishUrlRef = {
      current: "blob:flattened-primary" as string | null,
    };
    const removeBackgroundPendingSourceUrlRef = { current: null as string | null };

    renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayer("layer-1", {
          imageUrl: "blob:flattened-primary",
          transform: defaultLayerTransform(),
        }),
      ]);

      useExpertEditPrimarySessionSync({
        layers,
        selectedLayerIndex: 0,
        referenceImageUrl: "https://example.com/base.png",
        hostPrimaryImageUrl: "blob:flattened-primary",
        removeBackgroundPendingLayerId: null,
        foundationLayerId: "layer-1",
        lastDispatchedPrimaryRef,
        previousPrimaryPropRef,
        suppressNextPrimaryPublishUrlRef,
        removeBackgroundPendingSourceUrlRef,
        setLayers,
        rebasePanelHistoryLayerImage,
        onPrimaryImageChange,
      });

      return { layers };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onPrimaryImageChange).not.toHaveBeenCalled();
    expect(suppressNextPrimaryPublishUrlRef.current).toBeNull();
    expect(lastDispatchedPrimaryRef.current).toBe("https://example.com/base.png");
    expect(rebasePanelHistoryLayerImage).not.toHaveBeenCalled();
  });
});

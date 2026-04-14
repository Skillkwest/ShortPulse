import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildTransformHistoryEntry,
  defaultLayerTransform,
  type TransformHistoryState,
} from "../expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import { useExpertEditTransformHistory } from "../useExpertEditTransformHistory";

const createLayer = (id: string, translateXRatio = 0): ExpertEditLayer => ({
  id,
  name: id,
  imageUrl: `https://example.com/${id}.png`,
  opacity: 1,
  isAutoNamed: false,
  ownsImageUrl: false,
  transform: {
    ...defaultLayerTransform(),
    translateXRatio,
  },
});

describe("useExpertEditTransformHistory", () => {
  it("queues the previous transform entry on undo", () => {
    const originalLayer = createLayer("layer-1");
    const movedLayer = createLayer("layer-1", 0.25);
    const originalEntry = buildTransformHistoryEntry([originalLayer]);
    const movedEntry = buildTransformHistoryEntry([movedLayer]);
    let latestHistoryState: TransformHistoryState = {
      past: [originalEntry],
      present: movedEntry,
      future: [],
    };

    const queuePendingHistoryApplyEntry = vi.fn();
    const setTransformHistoryState = vi.fn(
      (
        update: TransformHistoryState | ((previous: TransformHistoryState) => TransformHistoryState)
      ) => {
        latestHistoryState = typeof update === "function" ? update(latestHistoryState) : update;
        return latestHistoryState;
      }
    );

    const { result } = renderHook(() =>
      useExpertEditTransformHistory({
        layers: [movedLayer],
        selectedLayer: movedLayer,
        setLayers: vi.fn(),
        queuePendingHistoryApplyEntry,
        transformHistoryState: latestHistoryState,
        setTransformHistoryState,
        commitTransformHistoryTransition: vi.fn(),
      })
    );

    act(() => {
      result.current.handleUndoMoveAction();
    });

    expect(queuePendingHistoryApplyEntry).toHaveBeenCalledWith(originalEntry);
    expect(setTransformHistoryState).toHaveBeenCalledTimes(1);
  });

  it("resets moved layers and commits a new transform history entry", () => {
    const movedLayer = createLayer("layer-1", 0.25);
    const baselineEntry = buildTransformHistoryEntry([movedLayer]);
    const setLayers = vi.fn();
    const commitTransformHistoryTransition = vi.fn();

    const { result } = renderHook(() =>
      useExpertEditTransformHistory({
        layers: [movedLayer],
        selectedLayer: movedLayer,
        setLayers,
        queuePendingHistoryApplyEntry: vi.fn(),
        transformHistoryState: {
          past: [],
          present: baselineEntry,
          future: [],
        },
        setTransformHistoryState: vi.fn(),
        commitTransformHistoryTransition,
      })
    );

    act(() => {
      result.current.resetAllMoveToolTransforms();
    });

    expect(setLayers).toHaveBeenCalledWith([
      expect.objectContaining({
        transform: defaultLayerTransform(),
      }),
    ]);
    expect(commitTransformHistoryTransition).toHaveBeenCalledTimes(1);
  });
});

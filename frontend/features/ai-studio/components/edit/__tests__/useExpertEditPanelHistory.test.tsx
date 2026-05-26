import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useExpertEditPanelHistory } from "../useExpertEditPanelHistory";

describe("useExpertEditPanelHistory", () => {
  it("undoes and redoes layer-stack changes from one shared panel history", async () => {
    const { result } = renderHook(() => {
      const layerIdCounterRef = React.useRef(2);
      const [layerIdCounter, setLayerIdCounter] = React.useState(2);
      const [foundationLayerId, setFoundationLayerId] = React.useState<string | null>("layer-1");
      const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
      const [layers, setLayers] = React.useState([
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
      ]);
      const [markupStrokes, setMarkupStrokes] = React.useState([]);
      const [inpaintSnapshot, setInpaintSnapshot] = React.useState({ layers: [] });
      const history = useExpertEditPanelHistory({
        historyLimit: 20,
        foundationLayerId,
        selectedLayerIndex,
        layerIdCounter,
        layerIdCounterRef,
        layers,
        markupStrokes,
        inpaintSnapshot,
        setFoundationLayerId,
        setLayerIdCounter,
        setSelectedLayerIndex,
        setLayers,
        setMarkupStrokes,
        restoreInpaintMaskSnapshot: setInpaintSnapshot,
        clearLayerEditing: () => {},
      });

      return {
        ...history,
        layers,
        setLayers,
        setSelectedLayerIndex,
      };
    });

    act(() => {
      result.current.queuePanelHistoryBaselineFromCurrent();
      result.current.setLayers((previousLayers) => [
        {
          id: "layer-2",
          name: "layer 2",
          imageUrl: "https://example.com/added.png",
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
        ...previousLayers,
      ]);
      result.current.setSelectedLayerIndex(0);
    });

    await waitFor(() => {
      expect(result.current.canUndoPanelHistoryAction).toBe(true);
    });
    expect(result.current.layers).toHaveLength(2);

    act(() => {
      result.current.handleUndoPanelHistoryAction();
    });

    await waitFor(() => {
      expect(result.current.layers).toHaveLength(1);
    });
    expect(result.current.layers[0]?.id).toBe("layer-1");

    act(() => {
      result.current.handleRedoPanelHistoryAction();
    });

    await waitFor(() => {
      expect(result.current.layers).toHaveLength(2);
    });
    expect(result.current.layers[0]?.id).toBe("layer-2");
  });

  it("commits one undo step for a multi-frame gesture change", async () => {
    const { result } = renderHook(() => {
      const layerIdCounterRef = React.useRef(2);
      const [layerIdCounter, setLayerIdCounter] = React.useState(2);
      const [foundationLayerId, setFoundationLayerId] = React.useState<string | null>("layer-1");
      const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
      const [layers, setLayers] = React.useState([
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
      ]);
      const [markupStrokes, setMarkupStrokes] = React.useState<
        Array<{
          id: string;
          color: string;
          sizeRatio: number;
          points: Array<{ sceneX: number; sceneY: number }>;
        }>
      >([]);
      const [inpaintSnapshot, setInpaintSnapshot] = React.useState({ layers: [] });
      const history = useExpertEditPanelHistory({
        historyLimit: 20,
        foundationLayerId,
        selectedLayerIndex,
        layerIdCounter,
        layerIdCounterRef,
        layers,
        markupStrokes,
        inpaintSnapshot,
        setFoundationLayerId,
        setLayerIdCounter,
        setSelectedLayerIndex,
        setLayers,
        setMarkupStrokes,
        restoreInpaintMaskSnapshot: setInpaintSnapshot,
        clearLayerEditing: () => {},
      });

      return {
        ...history,
        markupStrokes,
        setMarkupStrokes,
      };
    });

    act(() => {
      result.current.beginPanelHistoryGesture();
      result.current.setMarkupStrokes([
        {
          id: "stroke-1",
          color: "#f43f5e",
          sizeRatio: 0.02,
          points: [{ sceneX: 0.1, sceneY: 0.1 }],
        },
      ]);
      result.current.setMarkupStrokes([
        {
          id: "stroke-1",
          color: "#f43f5e",
          sizeRatio: 0.02,
          points: [
            { sceneX: 0.1, sceneY: 0.1 },
            { sceneX: 0.2, sceneY: 0.2 },
          ],
        },
      ]);
      result.current.finalizePanelHistoryGesture();
    });

    await waitFor(() => {
      expect(result.current.canUndoPanelHistoryAction).toBe(true);
    });
    expect(result.current.markupStrokes).toHaveLength(1);
    expect(result.current.markupStrokes[0]?.points).toHaveLength(2);

    act(() => {
      result.current.handleUndoPanelHistoryAction();
    });

    await waitFor(() => {
      expect(result.current.markupStrokes).toHaveLength(0);
    });
  });

  it("rebases layer image snapshots so undo preserves a non-undoable image replacement", async () => {
    const { result } = renderHook(() => {
      const layerIdCounterRef = React.useRef(2);
      const [layerIdCounter, setLayerIdCounter] = React.useState(2);
      const [foundationLayerId, setFoundationLayerId] = React.useState<string | null>("layer-1");
      const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
      const [layers, setLayers] = React.useState([
        {
          id: "layer-1",
          name: "layer 1",
          imageUrl: "https://example.com/original.png",
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
      ]);
      const [markupStrokes, setMarkupStrokes] = React.useState([]);
      const [inpaintSnapshot, setInpaintSnapshot] = React.useState({ layers: [] });
      const history = useExpertEditPanelHistory({
        historyLimit: 20,
        foundationLayerId,
        selectedLayerIndex,
        layerIdCounter,
        layerIdCounterRef,
        layers,
        markupStrokes,
        inpaintSnapshot,
        setFoundationLayerId,
        setLayerIdCounter,
        setSelectedLayerIndex,
        setLayers,
        setMarkupStrokes,
        restoreInpaintMaskSnapshot: setInpaintSnapshot,
        clearLayerEditing: () => {},
      });

      return {
        ...history,
        layers,
        setLayers,
      };
    });

    act(() => {
      result.current.queuePanelHistoryBaselineFromCurrent();
      result.current.setLayers((previousLayers) =>
        previousLayers.map((layer) => ({
          ...layer,
          transform: {
            ...layer.transform,
            scale: 1.5,
          },
        }))
      );
    });

    await waitFor(() => {
      expect(result.current.canUndoPanelHistoryAction).toBe(true);
    });
    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/original.png");
    expect(result.current.layers[0]?.transform.scale).toBe(1.5);

    act(() => {
      result.current.setLayers((previousLayers) =>
        previousLayers.map((layer) => ({
          ...layer,
          imageUrl: "https://example.com/removed-bg.png",
          ownsImageUrl: false,
        }))
      );
      result.current.rebasePanelHistoryLayerImage({
        layerId: "layer-1",
        previousImageUrl: "https://example.com/original.png",
        nextImageUrl: "https://example.com/removed-bg.png",
        ownsImageUrl: false,
      });
    });

    await waitFor(() => {
      expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/removed-bg.png");
    });

    act(() => {
      result.current.handleUndoPanelHistoryAction();
    });

    await waitFor(() => {
      expect(result.current.layers[0]?.transform.scale).toBe(1);
    });
    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/removed-bg.png");
  });
});

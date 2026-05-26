import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildTransformHistoryEntry,
  defaultLayerTransform,
  type TransformHistoryState,
} from "../expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import { useExpertEditStageHistory } from "../useExpertEditStageHistory";
import type { InpaintMaskSnapshot } from "../useInpaintMaskController";
import type { MarkupStroke } from "../markupStrokeController";

const createLayer = (id: string): ExpertEditLayer => ({
  id,
  name: id,
  imageUrl: `https://example.com/${id}.png`,
  opacity: 1,
  isAutoNamed: false,
  ownsImageUrl: false,
  transform: defaultLayerTransform(),
});

const createMarkupStroke = (id: string): MarkupStroke => ({
  id,
  color: "#ff0000",
  sizeRatio: 0.05,
  points: [
    { sceneX: 0.1, sceneY: 0.2 },
    { sceneX: 0.3, sceneY: 0.4 },
  ],
});

const createMaskSnapshot = (value: number): InpaintMaskSnapshot => ({
  layers: [
    {
      layerId: "layer-1",
      width: 2,
      height: 2,
      alpha: new Uint8ClampedArray([value, 0, 0, 0]),
    },
  ],
});

const buildArgs = ({
  isInpaintToolSelected = false,
  isMarkupToolSelected = false,
}: {
  isInpaintToolSelected?: boolean;
  isMarkupToolSelected?: boolean;
} = {}) => {
  const initialLayer = createLayer("layer-1");
  const changedLayer: ExpertEditLayer = {
    ...initialLayer,
    transform: {
      ...defaultLayerTransform(),
      translateXRatio: 0.25,
    },
  };
  const initialTransformEntry = buildTransformHistoryEntry([initialLayer]);
  const changedTransformEntry = buildTransformHistoryEntry([changedLayer]);
  const transformHistoryState: TransformHistoryState = {
    past: [initialTransformEntry],
    present: changedTransformEntry,
    future: [],
  };
  const initialMaskSnapshot = createMaskSnapshot(0);
  const nextMaskSnapshot = createMaskSnapshot(255);
  let latestMaskSnapshot = initialMaskSnapshot;
  let latestTransformHistoryState: TransformHistoryState = transformHistoryState;

  const setTransformHistoryState = vi.fn(
    (
      update: TransformHistoryState | ((previous: TransformHistoryState) => TransformHistoryState)
    ) => {
      latestTransformHistoryState =
        typeof update === "function" ? update(latestTransformHistoryState) : update;
      return latestTransformHistoryState;
    }
  );

  return {
    layers: [initialLayer],
    selectedLayer: initialLayer,
    setLayers: vi.fn(),
    markupStrokes: [] as MarkupStroke[],
    setMarkupStrokes: vi.fn(),
    hasPrimaryCompositePreview: true,
    inpaintLayerSources: [{ id: "layer-1", imageUrl: initialLayer.imageUrl }],
    stageViewport: {
      scale: 1,
      offsetXRatio: 0,
      offsetYRatio: 0,
    },
    resetStageViewport: vi.fn(),
    captureInpaintMaskSnapshot: vi.fn(() => latestMaskSnapshot),
    restoreInpaintMaskSnapshot: vi.fn((snapshot: InpaintMaskSnapshot) => {
      latestMaskSnapshot = snapshot;
    }),
    clearSelectedLayerMask: vi.fn(() => {
      latestMaskSnapshot = initialMaskSnapshot;
    }),
    invertSelectedLayerMask: vi.fn(() => {
      latestMaskSnapshot = nextMaskSnapshot;
    }),
    clearAllInpaintMasks: vi.fn(() => {
      latestMaskSnapshot = initialMaskSnapshot;
    }),
    beginPanelHistoryGesture: vi.fn(),
    finalizePanelHistoryGesture: vi.fn(),
    queuePanelHistoryBaselineFromCurrent: vi.fn(),
    isInpaintToolSelected,
    isMarkupToolSelected,
    queuePendingHistoryApplyEntry: vi.fn(),
    transformHistoryState,
    setTransformHistoryState,
    commitTransformHistoryTransition: vi.fn(),
    initialMarkupHistoryState: {
      past: [],
      present: [],
      future: [],
    },
    initialInpaintHistoryState: {
      past: [],
      present: initialMaskSnapshot,
      future: [],
    },
    initialInpaintPresentSnapshot: initialMaskSnapshot,
    nextMaskSnapshot,
  };
};

describe("useExpertEditStageHistory", () => {
  it("routes general undo to markup history when markup is active", async () => {
    const args = buildArgs({ isMarkupToolSelected: true });
    const { result, rerender } = renderHook(
      (props: typeof args) => useExpertEditStageHistory(props),
      {
        initialProps: args,
      }
    );

    const nextMarkupStrokes = [createMarkupStroke("markup-2")];

    act(() => {
      result.current.beginMarkupGestureHistory();
    });

    rerender({
      ...args,
      markupStrokes: nextMarkupStrokes,
    });

    act(() => {
      result.current.finalizeMarkupGestureHistory();
    });

    await waitFor(() => {
      expect(result.current.markupHistoryState.past).toHaveLength(1);
    });

    act(() => {
      result.current.handleUndoGeneralAction();
    });

    await waitFor(() => {
      expect(args.setMarkupStrokes).toHaveBeenCalledWith([]);
    });
  });

  it("routes general undo to inpaint history when inpaint is active", async () => {
    const args = buildArgs({ isInpaintToolSelected: true });
    const { result } = renderHook(() => useExpertEditStageHistory(args));

    args.restoreInpaintMaskSnapshot.mockClear();

    act(() => {
      result.current.beginInpaintGestureHistory();
    });

    args.captureInpaintMaskSnapshot.mockReturnValue(args.nextMaskSnapshot);

    act(() => {
      result.current.finalizeInpaintGestureHistory();
    });

    await waitFor(() => {
      expect(result.current.inpaintHistoryState.past).toHaveLength(1);
    });

    act(() => {
      result.current.handleUndoGeneralAction();
    });

    await waitFor(() => {
      expect(args.restoreInpaintMaskSnapshot).toHaveBeenCalledWith(
        args.initialInpaintPresentSnapshot
      );
    });
  });

  it("routes general undo to transform history when no edit-specific history is active", () => {
    const args = buildArgs();
    const { result } = renderHook(() => useExpertEditStageHistory(args));

    act(() => {
      result.current.handleUndoGeneralAction();
    });

    expect(args.queuePendingHistoryApplyEntry).toHaveBeenCalledWith(
      args.transformHistoryState.past[0]
    );
    expect(args.setTransformHistoryState).toHaveBeenCalledTimes(1);
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  getAiStudioOutputSnapshot,
  resetAiStudioOutputStore,
  selectQuickSlotOutputIdsFromStoreSnapshot,
  selectVisibleAllRefsOutputIdsFromStoreSnapshot,
  setAiStudioOutputStoreSnapshot,
  subscribeAiStudioOutputs,
  useOutputById,
  useOutputCounts,
  useOutputMapByIds,
  useVisibleOutputWindow,
} from "../aiStudioOutputStore";
import {
  getFreezeInvestigationSnapshot,
  resetFreezeInvestigationSnapshot,
} from "../../logic/freezeInvestigationTelemetry";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/seedream",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

describe("aiStudioOutputStore", () => {
  beforeEach(() => {
    resetAiStudioOutputStore();
    resetFreezeInvestigationSnapshot();
  });

  it("keeps output-by-id subscriptions stable for unrelated output updates", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b");

    const { result } = renderHook(() => {
      const target = useOutputById("a");
      return target;
    });

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b"],
        outputById: { a: outputA, b: outputB },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const selectedAfterInitialSeed = result.current;

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b"],
        outputById: { a: outputA, b: { ...outputB, timestamp: "updated" } },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(result.current).toBe(selectedAfterInitialSeed);
  });

  it("updates count selectors incrementally", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b");
    const archived = makeOutput("z");

    const { result } = renderHook(() => useOutputCounts());

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b"],
        outputById: { a: outputA, b: outputB },
        archivedOutputOrder: ["z"],
        archivedOutputById: { z: archived },
      });
    });

    expect(result.current).toEqual({
      activeCount: 2,
      archivedCount: 1,
    });
  });

  it("returns stable visible windows when outside-slice outputs mutate", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b");
    const outputC = makeOutput("c");

    const { result } = renderHook(() => useVisibleOutputWindow(0, 2));

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b", "c"],
        outputById: { a: outputA, b: outputB, c: outputC },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const initialWindow = result.current;

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b", "c"],
        outputById: { a: outputA, b: outputB, c: { ...outputC, timestamp: "changed" } },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(result.current).toBe(initialWindow);
  });

  it("returns stable output maps when outside-slice outputs mutate", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b");
    const outputC = makeOutput("c");

    const { result } = renderHook(() => useOutputMapByIds(["a", "b"]));

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b", "c"],
        outputById: { a: outputA, b: outputB, c: outputC },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const initialMap = result.current;

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b", "c"],
        outputById: { a: outputA, b: outputB, c: { ...outputC, timestamp: "changed" } },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(result.current).toBe(initialMap);
  });

  it("does not notify listeners for equivalent cloned snapshots", () => {
    const outputA = makeOutput("a");
    const listener = vi.fn();
    const unsubscribe = subscribeAiStudioOutputs(listener);

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a"],
        outputById: { a: outputA },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a"],
        outputById: { a: outputA },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("coalesces re-entrant snapshot notifications without recursive listener loops", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b");
    let issuedNestedUpdate = false;
    const listener = vi.fn(() => {
      if (issuedNestedUpdate) return;
      issuedNestedUpdate = true;
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["b"],
        outputById: { b: outputB },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });
    const unsubscribe = subscribeAiStudioOutputs(listener);

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a"],
        outputById: { a: outputA },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("projects visible all-refs ids from the store snapshot with stable identity", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b", { hiddenInReferenceGrid: true });
    const outputC = makeOutput("c");

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b", "c"],
        outputById: { a: outputA, b: outputB, c: outputC },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const snapshot = getAiStudioOutputSnapshot();
    const first = selectVisibleAllRefsOutputIdsFromStoreSnapshot(snapshot, {
      removedFromAllRefsIds: ["c"],
    });
    const second = selectVisibleAllRefsOutputIdsFromStoreSnapshot(snapshot, {
      removedFromAllRefsIds: ["c"],
    });

    expect(first).toEqual(["a"]);
    expect(second).toBe(first);

    const telemetry = getFreezeInvestigationSnapshot();
    expect(telemetry.counters["referenceGrid.outputProjection.allRefs.scan"]).toBe(1);
    expect(telemetry.counters["referenceGrid.outputProjection.allRefs.cacheHit"]).toBe(1);
    expect(telemetry.gauges["referenceGrid.outputProjection.allRefs.inputCount"]).toBe(3);
  });

  it("keeps quick-slot projection ordered without scanning all output rows", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b", { hiddenInReferenceGrid: true });
    const outputC = makeOutput("c");

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b", "c"],
        outputById: { a: outputA, b: outputB, c: outputC },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const snapshot = getAiStudioOutputSnapshot();
    const first = selectQuickSlotOutputIdsFromStoreSnapshot(snapshot, {
      quickSlotIds: ["c", "missing", "b", "a"],
    });
    const second = selectQuickSlotOutputIdsFromStoreSnapshot(snapshot, {
      quickSlotIds: ["c", "missing", "b", "a"],
    });

    expect(first).toEqual(["c", "a"]);
    expect(second).toBe(first);

    const telemetry = getFreezeInvestigationSnapshot();
    expect(telemetry.counters["referenceGrid.outputProjection.quickSlot.lookup"]).toBe(1);
    expect(telemetry.counters["referenceGrid.outputProjection.quickSlot.cacheHit"]).toBe(1);
    expect(telemetry.gauges["referenceGrid.outputProjection.quickSlot.inputCount"]).toBe(4);
  });
});

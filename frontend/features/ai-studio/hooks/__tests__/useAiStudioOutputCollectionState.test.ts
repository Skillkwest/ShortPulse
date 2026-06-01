import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { getAiStudioOutputSnapshot, resetAiStudioOutputStore } from "../aiStudioOutputStore";
import { useAiStudioOutputCollectionState } from "../useAiStudioOutputCollectionState";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "9:16",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

describe("useAiStudioOutputCollectionState", () => {
  const queuedTasks: Array<() => void> = [];

  beforeEach(() => {
    queuedTasks.length = 0;
    resetAiStudioOutputStore();
    vi.stubGlobal("queueMicrotask", (task: () => void) => {
      queuedTasks.push(task);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores queued selector-store publishes from a previous authority after reset", () => {
    const { result, rerender } = renderHook(
      ({ authorityKey }) => useAiStudioOutputCollectionState({ authorityKey }),
      {
        initialProps: {
          authorityKey: "session:session-1",
        },
      }
    );

    act(() => {
      result.current.setOutputsState([makeOutput("out-1")]);
    });

    expect(getAiStudioOutputSnapshot().outputOrder).toEqual([]);

    rerender({
      authorityKey: "project:pending",
    });

    expect(result.current.outputs).toEqual([]);
    expect(getAiStudioOutputSnapshot().outputOrder).toEqual([]);

    act(() => {
      while (queuedTasks.length > 0) {
        const nextTask = queuedTasks.shift();
        nextTask?.();
      }
    });

    expect(result.current.outputs).toEqual([]);
    expect(result.current.archivedOutputs).toEqual([]);
    expect(getAiStudioOutputSnapshot().outputOrder).toEqual([]);
    expect(getAiStudioOutputSnapshot().archivedOutputOrder).toEqual([]);
  });

  it("sorts active outputs newest-first once every row has createdAt", () => {
    const { result } = renderHook(() => useAiStudioOutputCollectionState());

    act(() => {
      result.current.setOutputsState([
        makeOutput("oldest", { createdAt: "2026-05-24T10:00:00.000Z" }),
        makeOutput("newest", { createdAt: "2026-05-24T12:00:00.000Z" }),
        makeOutput("middle", { createdAt: "2026-05-24T11:00:00.000Z" }),
      ]);
    });

    expect(result.current.outputs.map((output) => output.id)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
  });

  it("preserves mixed legacy order until every active row has createdAt", () => {
    const { result } = renderHook(() => useAiStudioOutputCollectionState());

    act(() => {
      result.current.setOutputsState([
        makeOutput("legacy-upload"),
        makeOutput("new-generated", { createdAt: "2026-05-24T12:00:00.000Z" }),
        makeOutput("older-generated", { createdAt: "2026-05-24T11:00:00.000Z" }),
      ]);
    });

    expect(result.current.outputs.map((output) => output.id)).toEqual([
      "legacy-upload",
      "new-generated",
      "older-generated",
    ]);
  });

  it("preserves sequential functional updater semantics for active and archived collections", () => {
    const { result } = renderHook(() => useAiStudioOutputCollectionState());

    act(() => {
      result.current.setOutputsState((rows) => [...rows, makeOutput("active-1")]);
      result.current.setOutputsState((rows) => [...rows, makeOutput("active-2")]);
      result.current.setArchivedOutputs((rows) => [...rows, makeOutput("archived-1")]);
      result.current.setArchivedOutputs((rows) => [...rows, makeOutput("archived-2")]);
    });

    expect(result.current.outputs.map((output) => output.id)).toEqual(["active-1", "active-2"]);
    expect(result.current.archivedOutputs.map((output) => output.id)).toEqual([
      "archived-1",
      "archived-2",
    ]);
  });
});

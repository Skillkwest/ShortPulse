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
});

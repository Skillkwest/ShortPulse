import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useAgentOutputBubbleLinking } from "../useAgentOutputBubbleLinking";

const buildOutput = (overrides: Partial<StudioOutput>): StudioOutput => ({
  id: "out-1",
  prompt: "prompt",
  mode: "image",
  aspect: "1:1",
  model: "model",
  status: "ready",
  timestamp: "2026-03-01T00:00:00.000Z",
  taskState: "pending",
  ...overrides,
});

describe("useAgentOutputBubbleLinking", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps message ids to optimistic outputs and resolves thumbnail URLs", () => {
    const { result, rerender } = renderHook(
      ({ outputs, readyIds }: { outputs: StudioOutput[]; readyIds: ReadonlySet<string> }) =>
        useAgentOutputBubbleLinking({ outputs, referenceGridReadyOutputIds: readyIds }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
          readyIds: new Set<string>(),
        },
      }
    );

    act(() => {
      result.current.registerOutputLink({ messageId: "msg-1", optimisticOutputId: "out-1" });
    });
    expect(result.current.assistantBubbleMedia["msg-1"]).toEqual({
      outputId: "out-1",
      thumbnailUrl: null,
      state: "pending",
    });

    rerender({
      outputs: [
        buildOutput({
          id: "out-1",
          taskState: "success",
          previewUrl: "https://example.com/preview.png",
        }),
      ],
      readyIds: new Set<string>(),
    });

    expect(result.current.assistantBubbleMedia["msg-1"]).toEqual({
      outputId: "out-1",
      thumbnailUrl: null,
      state: "pending",
    });

    rerender({
      outputs: [
        buildOutput({
          id: "out-1",
          taskState: "success",
          previewUrl: "https://example.com/preview.png",
        }),
      ],
      readyIds: new Set<string>(["out-1"]),
    });

    expect(result.current.assistantBubbleMedia["msg-1"]).toEqual({
      outputId: "out-1",
      thumbnailUrl: "https://example.com/preview.png",
      state: "ready",
    });
  });

  it("marks linked outputs as failed when task state fails", () => {
    const { result, rerender } = renderHook(
      ({ outputs, readyIds }: { outputs: StudioOutput[]; readyIds: ReadonlySet<string> }) =>
        useAgentOutputBubbleLinking({ outputs, referenceGridReadyOutputIds: readyIds }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
          readyIds: new Set<string>(),
        },
      }
    );

    act(() => {
      result.current.registerOutputLink({ messageId: "msg-2", optimisticOutputId: "out-2" });
    });

    rerender({
      outputs: [
        buildOutput({
          id: "out-2",
          taskState: "fail",
        }),
      ],
      readyIds: new Set<string>(),
    });

    expect(result.current.assistantBubbleMedia["msg-2"]).toEqual({
      outputId: "out-2",
      thumbnailUrl: null,
      state: "failed",
    });
  });

  it("keeps the empty bubble media map stable across unrelated output updates", () => {
    const initialOutputs = [
      buildOutput({
        id: "out-stable-1",
        taskState: "pending",
      }),
    ];
    const { result, rerender } = renderHook(
      ({ outputs, readyIds }: { outputs: StudioOutput[]; readyIds: ReadonlySet<string> }) =>
        useAgentOutputBubbleLinking({ outputs, referenceGridReadyOutputIds: readyIds }),
      {
        initialProps: {
          outputs: initialOutputs,
          readyIds: new Set<string>(),
        },
      }
    );

    const initialMedia = result.current.assistantBubbleMedia;

    rerender({
      outputs: [
        buildOutput({
          id: "out-stable-1",
          taskState: "running",
        }),
      ],
      readyIds: new Set<string>(),
    });

    expect(result.current.assistantBubbleMedia).toBe(initialMedia);
    expect(result.current.assistantBubbleMedia).toEqual({});
  });

  it("prunes stale links when no matching output exists after grace window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
    const { result, rerender } = renderHook(
      ({ outputs, readyIds }: { outputs: StudioOutput[]; readyIds: ReadonlySet<string> }) =>
        useAgentOutputBubbleLinking({ outputs, referenceGridReadyOutputIds: readyIds }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
          readyIds: new Set<string>(),
        },
      }
    );

    act(() => {
      result.current.registerOutputLink({
        messageId: "msg-stale",
        optimisticOutputId: "out-stale",
      });
    });
    expect(result.current.assistantBubbleMedia["msg-stale"]?.state).toBe("pending");

    act(() => {
      vi.setSystemTime(new Date("2026-03-01T00:06:00.000Z"));
      rerender({ outputs: [], readyIds: new Set<string>() });
      vi.runOnlyPendingTimers();
    });

    expect(result.current.assistantBubbleMedia["msg-stale"]).toBeUndefined();
  });

  it("allows hidden-in-grid outputs to surface their thumbnail immediately", () => {
    const { result, rerender } = renderHook(
      ({ outputs, readyIds }: { outputs: StudioOutput[]; readyIds: ReadonlySet<string> }) =>
        useAgentOutputBubbleLinking({ outputs, referenceGridReadyOutputIds: readyIds }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
          readyIds: new Set<string>(),
        },
      }
    );

    act(() => {
      result.current.registerOutputLink({
        messageId: "msg-hidden",
        optimisticOutputId: "out-hidden",
      });
    });

    rerender({
      outputs: [
        buildOutput({
          id: "out-hidden",
          taskState: "success",
          previewUrl: "https://example.com/hidden.png",
          hiddenInReferenceGrid: true,
        }),
      ],
      readyIds: new Set<string>(),
    });

    expect(result.current.assistantBubbleMedia["msg-hidden"]).toEqual({
      outputId: "out-hidden",
      thumbnailUrl: "https://example.com/hidden.png",
      state: "ready",
    });
  });
});

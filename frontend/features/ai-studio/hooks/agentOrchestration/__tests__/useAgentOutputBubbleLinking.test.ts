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
      ({ outputs }: { outputs: StudioOutput[] }) => useAgentOutputBubbleLinking({ outputs }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
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
    });

    expect(result.current.assistantBubbleMedia["msg-1"]).toEqual({
      outputId: "out-1",
      thumbnailUrl: "https://example.com/preview.png",
      state: "ready",
    });
  });

  it("marks linked outputs as failed when task state fails", () => {
    const { result, rerender } = renderHook(
      ({ outputs }: { outputs: StudioOutput[] }) => useAgentOutputBubbleLinking({ outputs }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
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
    });

    expect(result.current.assistantBubbleMedia["msg-2"]).toEqual({
      outputId: "out-2",
      thumbnailUrl: null,
      state: "failed",
    });
  });

  it("prunes stale links when no matching output exists after grace window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
    const { result, rerender } = renderHook(
      ({ outputs }: { outputs: StudioOutput[] }) => useAgentOutputBubbleLinking({ outputs }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
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
      rerender({ outputs: [] });
      vi.runOnlyPendingTimers();
    });

    expect(result.current.assistantBubbleMedia["msg-stale"]).toBeUndefined();
  });
});

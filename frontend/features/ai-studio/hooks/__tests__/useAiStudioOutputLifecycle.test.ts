import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemo, useRef, useState } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioOutputLifecycle } from "../useAiStudioOutputLifecycle";

const reportAppErrorMock = vi.fn();

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: (...args: unknown[]) => reportAppErrorMock(...args),
}));

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: "Original prompt",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/seedream",
  status: "ready",
  timestamp: "now",
  previewText: "Original prompt",
  ...overrides,
});

const useHarness = (
  initialOutputs: StudioOutput[],
  initialActiveOutputId: string | null,
  options?: {
    useFastPath?: boolean;
  }
) => {
  const [outputs, setOutputs] = useState<StudioOutput[]>(initialOutputs);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(initialActiveOutputId);
  const [uiError, setUiError] = useState<string | null>(null);
  const pendingAutoSavesRef = useRef<Record<string, { taskId: string }>>({
    "out-1": { taskId: "task-1" },
  });
  const outputById = useMemo(
    () =>
      outputs.reduce<Record<string, StudioOutput>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [outputs]
  );

  const initialOutputById = useMemo(
    () =>
      initialOutputs.reduce<Record<string, StudioOutput>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [initialOutputs]
  );

  const lifecycle = useAiStudioOutputLifecycle({
    outputs,
    setOutputs,
    updateOutputByIdFast: options?.useFastPath
      ? (id, updater) => {
          setOutputs((prev) => {
            const targetIndex = prev.findIndex((item) => item.id === id);
            if (targetIndex === -1) return prev;
            const current = prev[targetIndex];
            if (!current) return prev;
            const nextItem = updater(current);
            if (nextItem === current) return prev;
            const next = [...prev];
            next[targetIndex] = nextItem;
            return next;
          });
        }
      : undefined,
    findOutputByIdFast: options?.useFastPath
      ? (id) => outputById[id] ?? initialOutputById[id] ?? null
      : undefined,
    activeOutputId,
    setActiveOutputId,
    pendingAutoSavesRef,
    setUiError,
  });

  return {
    outputs,
    activeOutputId,
    uiError,
    pendingAutoSavesRef,
    ...lifecycle,
  };
};

describe("useAiStudioOutputLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes failure output state and emits a UI error", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1", { taskState: "running" })], "out-1")
    );

    act(() => {
      result.current.notifyGenerationFailure("out-1", "Provider failure", "Detailed reason", {
        reasonCode: "provider_error",
        providerState: "error",
        pollAttempt: 3,
        elapsedMs: 12_000,
      });
    });

    expect(result.current.outputs[0]?.taskState).toBe("fail");
    expect(result.current.outputs[0]?.timestamp).toBe("Failed");
    expect(result.current.outputs[0]?.errorMessage).toBe("Provider failure");
    expect(result.current.outputs[0]?.errorDetail).toBe("Detailed reason");
    expect(result.current.uiError).toContain("failed");
    expect(result.current.pendingAutoSavesRef.current["out-1"]).toBeUndefined();
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "generation.workflow_failure",
        scope: "generation",
        message: "Provider failure",
        metadata: expect.objectContaining({
          failure_reason_code: "provider_error",
          provider_state: "error",
          poll_attempt: 3,
          elapsed_ms: 12_000,
        }),
      })
    );
  });

  it("updates prompts with trimmed text and ignores empty updates", () => {
    const { result } = renderHook(() => useHarness([makeOutput("out-1")], "out-1"));

    act(() => {
      result.current.updateOutputPrompt("out-1", "   ");
    });
    expect(result.current.outputs[0]?.prompt).toBe("Original prompt");

    act(() => {
      result.current.updateOutputPrompt("out-1", "  Updated prompt  ");
    });
    expect(result.current.outputs[0]?.prompt).toBe("Updated prompt");
    expect(result.current.outputs[0]?.previewText).toBe("Updated prompt");
    expect(result.current.outputs[0]?.timestamp).toBe("Edited");
  });

  it("deletes outputs and clears the active selection when needed", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1"), makeOutput("out-2")], "out-1")
    );

    act(() => {
      result.current.deleteOutput("out-1");
    });

    expect(result.current.outputs.map((item) => item.id)).toEqual(["out-2"]);
    expect(result.current.activeOutputId).toBeNull();
    expect(result.current.pendingAutoSavesRef.current["out-1"]).toBeUndefined();
  });

  it("supports keyed fast-path callbacks for output updates", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1", { taskState: "running" })], "out-1", { useFastPath: true })
    );

    act(() => {
      result.current.notifyGenerationFailure("out-1", "Provider failure", "Detailed reason");
    });

    expect(result.current.outputs[0]?.taskState).toBe("fail");
    expect(result.current.outputs[0]?.errorDetail).toBe("Detailed reason");
    expect(result.current.uiError).toContain("failed");
  });

  it("fails fast when a generated placeholder never receives a task id", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("out-1", {
              taskState: "pending",
              previewText: undefined,
              previewUrl: undefined,
              timestamp: "Submitting...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("fail");
      expect(result.current.outputs[0]?.timestamp).toBe("Failed to start");
      expect(result.current.outputs[0]?.errorMessage).toBe(
        "Generation failed to start. Please retry."
      );
      expect(reportAppErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "fal_submit_not_started",
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails fast for generated placeholders with non-optimistic ids when task id is missing", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("generation-db-1", {
              taskState: "pending",
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              timestamp: "Submitting...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("fail");
      expect(result.current.outputs[0]?.errorMessage).toBe(
        "Generation failed to start. Please retry."
      );
      expect(reportAppErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "fal_submit_not_started",
          metadata: expect.objectContaining({
            output_id: "generation-db-1",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fail queued placeholders at submit-start timeout", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("generation-db-queued", {
              taskState: "pending",
              queueState: "queued",
              queueEnqueuedAtMs: Date.now(),
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              timestamp: "Submitting...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("pending");
      expect(reportAppErrorMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          source: "fal_submit_not_started",
          metadata: expect.objectContaining({
            output_id: "generation-db-queued",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails queued placeholders after queue wait timeout", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("generation-db-queued-timeout", {
              taskState: "pending",
              queueState: "queued",
              queueEnqueuedAtMs: Date.now(),
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              timestamp: "Submitting...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20 * 60 * 1000 + 16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("fail");
      expect(result.current.outputs[0]?.timestamp).toBe("Queue timed out");
      expect(result.current.outputs[0]?.errorMessage).toBe(
        "Generation queue timed out. Please retry."
      );
      expect(reportAppErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "generation.queue_wait_timeout",
          metadata: expect.objectContaining({
            output_id: "generation-db-queued-timeout",
            failure_reason_code: "QUEUE_WAIT_TIMEOUT",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

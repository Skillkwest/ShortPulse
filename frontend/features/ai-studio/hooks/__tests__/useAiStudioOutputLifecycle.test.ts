import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemo, useRef, useState } from "react";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_MESSAGE,
  EXPLICIT_CONTENT_FAILURE_SHORT_MESSAGE,
} from "../../../../lib/explicitContentFailure";
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
  });

  return {
    outputs,
    activeOutputId,
    pendingAutoSavesRef,
    ...lifecycle,
  };
};

describe("useAiStudioOutputLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes failure output state without raising a duplicate UI error", () => {
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

  it("keeps validation failures in UI state without reporting an incident", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1", { taskState: "running" })], "out-1")
    );

    act(() => {
      result.current.notifyGenerationFailure(
        "out-1",
        "Reference image required.",
        "Reference image required.",
        {
          reasonCode: "USER_INPUT_VALIDATION",
          telemetryMode: "validation",
        }
      );
    });

    expect(result.current.outputs[0]?.taskState).toBe("fail");
    expect(result.current.outputs[0]?.errorMessage).toBe("Reference image required.");
    expect(reportAppErrorMock).not.toHaveBeenCalled();
  });

  it("keeps already-reported failures in UI state without reporting a generic workflow incident", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1", { taskState: "running" })], "out-1")
    );

    act(() => {
      result.current.notifyGenerationFailure(
        "out-1",
        "Generation failed to start. Please retry.",
        "Submit route completed without starting provider polling.",
        {
          reasonCode: "SUBMIT_NOT_STARTED",
          telemetryMode: "state_only",
        }
      );
    });

    expect(result.current.outputs[0]?.taskState).toBe("fail");
    expect(result.current.outputs[0]?.errorDetail).toBe(
      "Submit route completed without starting provider polling."
    );
    expect(reportAppErrorMock).not.toHaveBeenCalled();
  });

  it("normalizes explicit-content failures into shared user-facing copy", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1", { taskState: "running" })], "out-1")
    );

    act(() => {
      result.current.notifyGenerationFailure(
        "out-1",
        "Content not allowed",
        "Blocked by moderation."
      );
    });

    expect(result.current.outputs[0]?.errorMessage).toBe(EXPLICIT_CONTENT_FAILURE_MESSAGE);
    expect(result.current.outputs[0]?.errorMessageShort).toBe(
      EXPLICIT_CONTENT_FAILURE_SHORT_MESSAGE
    );
    expect(result.current.outputs[0]?.errorDetail).toBe(EXPLICIT_CONTENT_FAILURE_DETAIL);
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: EXPLICIT_CONTENT_FAILURE_MESSAGE,
        metadata: expect.objectContaining({
          detail: EXPLICIT_CONTENT_FAILURE_DETAIL,
        }),
      })
    );
  });

  it("treats generic safety-policy submit blocks as explicit-content failures", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1", { taskState: "running" })], "out-1")
    );

    act(() => {
      result.current.notifyGenerationFailure(
        "out-1",
        "Generation blocked by safety policy.",
        "Generation blocked by safety policy."
      );
    });

    expect(result.current.outputs[0]?.errorMessage).toBe(EXPLICIT_CONTENT_FAILURE_MESSAGE);
    expect(result.current.outputs[0]?.errorMessageShort).toBe(
      EXPLICIT_CONTENT_FAILURE_SHORT_MESSAGE
    );
    expect(result.current.outputs[0]?.errorDetail).toBe(EXPLICIT_CONTENT_FAILURE_DETAIL);
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
  });

  it("does not schedule the stale-output sweep interval when there are no outputs", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    renderHook(() => useHarness([], null));

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(reportAppErrorMock).not.toHaveBeenCalled();
  });

  it("does not schedule the stale-output sweep interval for settled outputs", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    renderHook(() => useHarness([makeOutput("out-ready")], "out-ready"));

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(reportAppErrorMock).not.toHaveBeenCalled();
  });

  it("schedules the stale-output sweep interval while unresolved outputs can timeout", () => {
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation(() => 1 as unknown as ReturnType<typeof window.setInterval>);

    renderHook(() =>
      useHarness(
        [
          makeOutput("out-loading", {
            taskState: "pending",
            previewText: undefined,
            previewUrl: undefined,
          }),
        ],
        null
      )
    );

    expect(setIntervalSpy).toHaveBeenCalled();
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
        await vi.advanceTimersByTimeAsync(95_000);
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
        await vi.advanceTimersByTimeAsync(95_000);
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

  it("keeps sourceRef-backed recovery outputs alive past the submit-start timeout", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("out-source-ref-recovery", {
              taskState: "pending",
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              sourceRef: "src-recovery-1",
              timestamp: "Waiting for server recovery...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(95_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("pending");
      expect(result.current.outputs[0]?.timestamp).toBe("Waiting for server recovery...");
      expect(result.current.outputs[0]?.errorMessage).toBeUndefined();
      expect(reportAppErrorMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          source: "fal_submit_not_started",
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not submit-start timeout direct-request placeholders before the direct-request budget", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("out-direct-request", {
              taskState: "pending",
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              submissionMode: "direct-request",
              timestamp: "Submitting...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(95_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("pending");
      expect(reportAppErrorMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          source: "fal_submit_not_started",
          metadata: expect.objectContaining({
            output_id: "out-direct-request",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("times out direct-request placeholders after the direct-request budget", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("out-direct-request-timeout", {
              taskState: "pending",
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              submissionMode: "direct-request",
              timestamp: "Submitting...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("fail");
      expect(result.current.outputs[0]?.timestamp).toBe("Failed to start");
      expect(result.current.outputs[0]?.errorMessage).toBe(
        "Generation failed to start. Please retry."
      );
      expect(reportAppErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "generation.direct_request_timeout",
          metadata: expect.objectContaining({
            output_id: "out-direct-request-timeout",
            failure_reason_code: "DIRECT_REQUEST_TIMEOUT",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not re-report submit-start failure for outputs that already failed", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("generation-db-failed-start", {
              taskState: "fail",
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              timestamp: "Failed",
              errorMessage: "Generation failed to start. Please retry.",
              errorMessageShort: "Generation failed to start.",
              errorDetail: "The generation did not receive a provider task id. Please retry.",
            }),
          ],
          null
        )
      );

      reportAppErrorMock.mockClear();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(95_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("fail");
      expect(result.current.outputs[0]?.timestamp).toBe("Failed");
      expect(reportAppErrorMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          source: "fal_submit_not_started",
          metadata: expect.objectContaining({
            output_id: "generation-db-failed-start",
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
        await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("pending");
      expect(result.current.outputs[0]?.timestamp).toBe("Waiting for server recovery...");
      expect(result.current.outputs[0]?.errorMessage).toBeNull();
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

  it("fails task-backed outputs that never resolve preview media after the extended timeout", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("generation-db-tasked-timeout", {
              taskId: "req-tasked-timeout",
              taskState: "running",
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              timestamp: "Processing...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("fail");
      expect(result.current.outputs[0]?.timestamp).toBe("Generation timed out");
      expect(result.current.outputs[0]?.errorMessage).toBe("Generation timed out. Please retry.");
      expect(reportAppErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "generation.task_backed_stale_timeout",
          metadata: expect.objectContaining({
            output_id: "generation-db-tasked-timeout",
            failure_reason_code: "TASK_BACKED_TIMEOUT",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not locally timeout success outputs that are still waiting on server recovery", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHarness(
          [
            makeOutput("generation-db-server-success", {
              taskId: "req-server-success",
              taskState: "success",
              previewText: undefined,
              previewUrl: undefined,
              mediaSource: "generated",
              timestamp: "Waiting for server recovery...",
            }),
          ],
          null
        )
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 16_000);
      });

      expect(result.current.outputs[0]?.taskState).toBe("success");
      expect(result.current.outputs[0]?.timestamp).toBe("Waiting for server recovery...");
      expect(result.current.outputs[0]?.errorMessage).toBeUndefined();
      expect(reportAppErrorMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          source: "generation.task_backed_stale_timeout",
          metadata: expect.objectContaining({
            output_id: "generation-db-server-success",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

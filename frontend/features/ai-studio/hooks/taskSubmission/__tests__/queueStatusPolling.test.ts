import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { fetchFalQueueStatus } from "../../../../../lib/falClient";
import {
  __resetQueueStatusPollingTestState,
  QUEUE_STATUS_MAX_WAIT_MS,
  startQueuedStatusPolling,
} from "../queueStatusPolling";
import { QUEUE_STATUS_NOT_FOUND_MAX_RETRIES } from "../queueStatusNotFoundPolicy";

vi.mock("../../../../../lib/falClient", () => ({
  fetchFalQueueStatus: vi.fn(),
}));

const createOutput = (id: string): StudioOutput => ({
  id,
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Model",
  status: "ready",
  timestamp: "Now",
});

describe("queueStatusPolling", () => {
  const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);

  beforeEach(() => {
    vi.clearAllMocks();
    __resetQueueStatusPollingTestState();
  });

  it("prefers server-authored pollingProvider when queue-status dispatches", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-queued");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock.mockResolvedValueOnce({
        status: "dispatched",
        generationId: "gen-queued-1",
        sourceRef: "src-queued-1",
        requestId: "req-queued-1",
        provider: "fal",
        pollingProvider: "fal-seedream",
      });

      startQueuedStatusPolling({
        outputId: "out-queued",
        provider: "fal-seedream",
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        effectiveTool: "edit",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-1",
          generationId: "gen-queued-1",
          pollAfterMs: 500,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(600);

      expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
        sourceRef: "src-queued-1",
        generationId: "gen-queued-1",
      });
      expect(onDispatched).toHaveBeenCalledWith("req-queued-1", "gen-queued-1", "fal-seedream");
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to client provider aliasing when pollingProvider is absent", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-queued-fallback");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock.mockResolvedValueOnce({
        status: "dispatched",
        generationId: "gen-queued-fallback",
        sourceRef: "src-queued-fallback",
        requestId: "req-queued-fallback",
        provider: "fal",
      });

      startQueuedStatusPolling({
        outputId: "out-queued-fallback",
        provider: "fal-seedream",
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        effectiveTool: "edit",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-fallback",
          generationId: "gen-queued-fallback",
          pollAfterMs: 500,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(600);

      expect(onDispatched).toHaveBeenCalledWith(
        "req-queued-fallback",
        "gen-queued-fallback",
        "fal-seedream"
      );
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("prefers server-authored kie pollingProvider when available", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-queued-kie");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock.mockResolvedValueOnce({
        status: "dispatched",
        generationId: "gen-queued-kie-1",
        sourceRef: "src-queued-kie-1",
        requestId: "req-queued-kie-1",
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
        pollingProvider: "kie-kling",
      });

      startQueuedStatusPolling({
        outputId: "out-queued-kie",
        provider: "kie-veo",
        finalModel: "kie-ai/kling-3.0",
        effectiveTool: "video",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-kie-1",
          generationId: "gen-queued-kie-1",
          pollAfterMs: 500,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(600);

      expect(onDispatched).toHaveBeenCalledWith(
        "req-queued-kie-1",
        "gen-queued-kie-1",
        "kie-kling"
      );
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves submit-time kie provider alias when dispatched modelId is unavailable", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-queued-kie-fallback");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock.mockResolvedValueOnce({
        status: "dispatched",
        generationId: "gen-queued-kie-2",
        sourceRef: "src-queued-kie-2",
        requestId: "req-queued-kie-2",
        provider: "kie",
      });

      startQueuedStatusPolling({
        outputId: "out-queued-kie-fallback",
        provider: "kie-kling",
        finalModel: "kie-ai/kling-3.0",
        effectiveTool: "video",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-kie-2",
          generationId: "gen-queued-kie-2",
          pollAfterMs: 500,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(600);

      expect(onDispatched).toHaveBeenCalledWith(
        "req-queued-kie-2",
        "gen-queued-kie-2",
        "kie-kling"
      );
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses queue-status fetches while the tab is hidden and resumes when visible", async () => {
    vi.useFakeTimers();
    const visibilityStateSpy = vi.spyOn(document, "visibilityState", "get");
    try {
      visibilityStateSpy.mockReturnValue("hidden");
      let output = createOutput("out-queued-hidden");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock.mockResolvedValue({
        status: "queued",
        generationId: "gen-queued-hidden",
        sourceRef: "src-queued-hidden",
        retryAfterMs: 1000,
        shortpulseLifecycle: {
          taskState: "pending",
          queueState: "queued",
          isTerminal: false,
        },
      });

      startQueuedStatusPolling({
        outputId: "out-queued-hidden",
        provider: "fal-seedream",
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        effectiveTool: "edit",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-hidden",
          generationId: "gen-queued-hidden",
          pollAfterMs: 500,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetchFalQueueStatusMock).not.toHaveBeenCalled();

      visibilityStateSpy.mockReturnValue("visible");
      await vi.advanceTimersByTimeAsync(10_500);
      expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
        sourceRef: "src-queued-hidden",
        generationId: "gen-queued-hidden",
      });
      expect(output.queueState).toBe("queued");
      expect(output.taskState).toBe("pending");
      expect(output.timestamp).toBe("Waiting in queue...");
    } finally {
      visibilityStateSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("syncs dispatching queue lifecycle hints before provider request id is available", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-queued-dispatching");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      fetchFalQueueStatusMock.mockResolvedValue({
        status: "dispatching",
        generationId: "gen-queued-dispatching",
        sourceRef: "src-queued-dispatching",
        retryAfterMs: 1000,
        shortpulseLifecycle: {
          taskState: "running",
          queueState: "dispatching",
          isTerminal: false,
        },
      });

      startQueuedStatusPolling({
        outputId: "out-queued-dispatching",
        provider: "fal-seedream",
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        effectiveTool: "edit",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-dispatching",
          generationId: "gen-queued-dispatching",
          pollAfterMs: 500,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
        onDispatched: vi.fn(),
      });

      await vi.advanceTimersByTimeAsync(600);

      expect(output.generationId).toBe("gen-queued-dispatching");
      expect(output.sourceRef).toBe("src-queued-dispatching");
      expect(output.queueState).toBe("dispatching");
      expect(output.taskState).toBe("running");
      expect(output.timestamp).toBe("Dispatching...");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands queued not_found polling over to server recovery after bounded retries", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-queued");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock.mockResolvedValue({
        status: "not_found",
      });

      startQueuedStatusPolling({
        outputId: "out-queued",
        provider: "fal-seedream",
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        effectiveTool: "edit",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-2",
          generationId: "gen-queued-2",
          pollAfterMs: 10_000,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(90_000);
      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(9);
      expect(output.taskState).toBe("pending");
      expect(output.timestamp).not.toBe("Waiting for server recovery...");

      await vi.advanceTimersByTimeAsync(40_000);

      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(12);
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
      expect(onDispatched).not.toHaveBeenCalled();
      expect(output.taskState).toBe("pending");
      expect(output.timestamp).toBe("Waiting for server recovery...");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands queued transport exhaustion over to server recovery instead of terminalizing locally", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-queued-timeout");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock.mockRejectedValue(new Error("queue unavailable"));

      startQueuedStatusPolling({
        outputId: "out-queued-timeout",
        provider: "fal-seedream",
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        effectiveTool: "edit",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-queued-timeout",
          generationId: "gen-queued-timeout",
          pollAfterMs: 500,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(QUEUE_STATUS_MAX_WAIT_MS + 10_000);

      expect(notifyGenerationFailure).not.toHaveBeenCalled();
      expect(onDispatched).not.toHaveBeenCalled();
      expect(output.taskState).toBe("pending");
      expect(output.timestamp).toBe("Waiting for server recovery...");
    } finally {
      vi.useRealTimers();
    }
  });

  it("continues polling through dispatching status and respects dispatch retry cadence", async () => {
    vi.useFakeTimers();
    try {
      let output = createOutput("out-dispatching");
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();
      fetchFalQueueStatusMock
        .mockResolvedValueOnce({
          status: "dispatching",
          generationId: "gen-dispatching-1",
          sourceRef: "src-dispatching-1",
          retryAfterMs: 2000,
        })
        .mockResolvedValueOnce({
          status: "dispatched",
          generationId: "gen-dispatching-1",
          sourceRef: "src-dispatching-1",
          requestId: "req-dispatching-1",
          provider: "fal",
        });

      startQueuedStatusPolling({
        outputId: "out-dispatching",
        provider: "fal-seedream",
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        effectiveTool: "edit",
        queuedResponse: {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-dispatching-1",
          generationId: "gen-dispatching-1",
          pollAfterMs: 2000,
        },
        patch: {},
        queueStatusTimersRef,
        queueStatusSessionRef,
        clearQueueStatusPolling,
        updateOutputById,
        notifyGenerationFailure,
        onDispatched,
      });

      await vi.advanceTimersByTimeAsync(2_100);
      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(1);
      expect(onDispatched).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_100);
      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(2);
      expect(onDispatched).toHaveBeenCalledWith(
        "req-dispatching-1",
        "gen-dispatching-1",
        "fal-seedream"
      );
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps concurrent queue-status fetches and defers excess pollers", async () => {
    vi.useFakeTimers();
    try {
      const queueStatusTimersRef = { current: {} as Record<string, number> };
      const queueStatusSessionRef = { current: {} as Record<string, number> };
      const updateOutputById = vi.fn();
      const clearQueueStatusPolling = vi.fn((outputId: string) => {
        const timeoutId = queueStatusTimersRef.current[outputId];
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          delete queueStatusTimersRef.current[outputId];
        }
      });
      const notifyGenerationFailure = vi.fn();
      const onDispatched = vi.fn();

      fetchFalQueueStatusMock.mockImplementation(
        () =>
          new Promise(() => {
            // Keep fetch pending so slots remain occupied during assertions.
          })
      );

      for (let index = 0; index < 4; index += 1) {
        startQueuedStatusPolling({
          outputId: `out-queued-${index}`,
          provider: "fal-seedream",
          finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
          effectiveTool: "edit",
          queuedResponse: {
            status: "queued",
            code: "GENERATION_QUEUED",
            sourceRef: `src-queued-${index}`,
            generationId: `gen-queued-${index}`,
            pollAfterMs: 500,
          },
          patch: {},
          queueStatusTimersRef,
          queueStatusSessionRef,
          clearQueueStatusPolling,
          updateOutputById,
          notifyGenerationFailure,
          onDispatched,
        });
      }

      await vi.advanceTimersByTimeAsync(700);
      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(3);
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
      expect(onDispatched).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      __resetQueueStatusPollingTestState();
    }
  });
});

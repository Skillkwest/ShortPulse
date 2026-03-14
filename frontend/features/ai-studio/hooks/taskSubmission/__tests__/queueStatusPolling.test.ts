import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { fetchFalQueueStatus } from "../../../../../lib/falClient";
import {
  QUEUE_STATUS_NOT_FOUND_MAX_RETRIES,
  startQueuedStatusPolling,
} from "../queueStatusPolling";

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
  });

  it("preserves submit-time provider alias when queue-status returns generic fal provider", async () => {
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

  it("resolves generic kie dispatched provider using modelId alias", async () => {
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

  it("fails queued status polling after bounded not_found retries", async () => {
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

      for (let index = 0; index < QUEUE_STATUS_NOT_FOUND_MAX_RETRIES + 2; index += 1) {
        await vi.advanceTimersByTimeAsync(12_000);
      }

      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(QUEUE_STATUS_NOT_FOUND_MAX_RETRIES);
      expect(notifyGenerationFailure).toHaveBeenCalledWith(
        "out-queued",
        "Queued generation could not be found. Please retry.",
        "Generation queue status remained unresolved while waiting for dispatch."
      );
      expect(onDispatched).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useAiStudioTaskRecoveryController } from "../useAiStudioTaskRecoveryController";

vi.mock("../../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

const makeOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "Processing...",
  taskState: "running",
  ...overrides,
});

describe("useAiStudioTaskRecoveryController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it("keeps background recovery scheduled after output-lookup hard stop", async () => {
    const fetchStatusByProvider = vi.fn().mockResolvedValue({
      status: "completed",
      data: { images: [{ url: "https://cdn.test/recovered.png" }] },
    });
    let output = makeOutput();
    const queueOutputUpdate = vi.fn(
      (outputId: string, updater: (item: StudioOutput) => StudioOutput) => {
        if (outputId === output.id) {
          output = updater(output);
        }
      }
    );
    const clearPollTimer = vi.fn();
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTaskRecoveryController({
        clearPollTimer,
        extractMediaUrls: (_provider, status) =>
          (status as { data?: { images?: Array<{ url: string }> } }).data?.images?.map(
            (row) => row.url
          ) ?? [],
        fetchStatusByProvider,
        findOutputById: (id) => (id === output.id ? output : null),
        onGenerationSuccess,
        queueOutputUpdate,
      })
    );

    act(() => {
      result.current.handleOutputLookupHardStop({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        lookupMisses: 10,
        missingDurationMs: 5 * 60 * 1000,
      });
    });

    expect(clearPollTimer).toHaveBeenCalledWith("out-1");
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Waiting for server recovery...");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });

    expect(fetchStatusByProvider).toHaveBeenCalledWith("fal", "task-1");
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        resultUrls: ["https://cdn.test/recovered.png"],
      })
    );
    expect(output.previewUrl).toBe("https://cdn.test/recovered.png");
    expect(output.taskState).toBe("success");
  });

  it("prefers lifecycle result urls over raw provider media during recovery", async () => {
    const fetchStatusByProvider = vi.fn().mockResolvedValue({
      shortpulseLifecycle: {
        taskState: "success",
        isTerminal: true,
        resultUrls: ["https://cdn.test/canonical.png"],
        queueState: "dispatched",
      },
      status: "completed",
      data: { images: [{ url: "https://cdn.test/raw.png" }] },
    });
    const extractMediaUrls = vi.fn(() => ["https://cdn.test/raw.png"]);
    let output = makeOutput();
    const queueOutputUpdate = vi.fn(
      (outputId: string, updater: (item: StudioOutput) => StudioOutput) => {
        if (outputId === output.id) {
          output = updater(output);
        }
      }
    );
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTaskRecoveryController({
        clearPollTimer: vi.fn(),
        extractMediaUrls,
        fetchStatusByProvider,
        findOutputById: (id) => (id === output.id ? output : null),
        onGenerationSuccess,
        queueOutputUpdate,
      })
    );

    act(() => {
      result.current.handleOutputLookupHardStop({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        lookupMisses: 10,
        missingDurationMs: 5 * 60 * 1000,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });

    expect(extractMediaUrls).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        resultUrls: ["https://cdn.test/canonical.png"],
      })
    );
    expect(output.previewUrl).toBe("https://cdn.test/canonical.png");
    expect(output.resultUrls).toEqual(["https://cdn.test/canonical.png"]);
    expect(output.taskState).toBe("success");
  });

  it("keeps recovery nonterminal when lifecycle reports recovery pending", async () => {
    const fetchStatusByProvider = vi.fn().mockResolvedValue({
      shortpulseLifecycle: {
        taskState: "running",
        isTerminal: false,
        recoveryPending: true,
        queueState: "dispatched",
        statusLabel: "Waiting for server recovery...",
      },
    });
    const extractMediaUrls = vi.fn(() => ["https://cdn.test/raw.png"]);
    let output = makeOutput();
    const queueOutputUpdate = vi.fn(
      (outputId: string, updater: (item: StudioOutput) => StudioOutput) => {
        if (outputId === output.id) {
          output = updater(output);
        }
      }
    );
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTaskRecoveryController({
        clearPollTimer: vi.fn(),
        extractMediaUrls,
        fetchStatusByProvider,
        findOutputById: (id) => (id === output.id ? output : null),
        onGenerationSuccess,
        queueOutputUpdate,
      })
    );

    act(() => {
      result.current.handleOutputLookupHardStop({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        lookupMisses: 10,
        missingDurationMs: 5 * 60 * 1000,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });

    expect(extractMediaUrls).not.toHaveBeenCalled();
    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Waiting for server recovery...");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });

    expect(fetchStatusByProvider).toHaveBeenCalledTimes(2);
  });

  it("stops recovery and marks fail when lifecycle reports terminal failure", async () => {
    const fetchStatusByProvider = vi.fn().mockResolvedValue({
      shortpulseLifecycle: {
        taskState: "fail",
        isTerminal: true,
        queueState: "failed",
        errorMessage: "Provider rejected request",
      },
    });
    const extractMediaUrls = vi.fn(() => ["https://cdn.test/raw.png"]);
    let output = makeOutput();
    const queueOutputUpdate = vi.fn(
      (outputId: string, updater: (item: StudioOutput) => StudioOutput) => {
        if (outputId === output.id) {
          output = updater(output);
        }
      }
    );
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTaskRecoveryController({
        clearPollTimer: vi.fn(),
        extractMediaUrls,
        fetchStatusByProvider,
        findOutputById: (id) => (id === output.id ? output : null),
        onGenerationSuccess,
        queueOutputUpdate,
      })
    );

    act(() => {
      result.current.handleOutputLookupHardStop({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        lookupMisses: 10,
        missingDurationMs: 5 * 60 * 1000,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });

    expect(extractMediaUrls).not.toHaveBeenCalled();
    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Provider rejected request");
    expect(output.errorMessageShort).toBe("Provider rejected request");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000);
    });

    expect(fetchStatusByProvider).toHaveBeenCalledTimes(1);
  });
});

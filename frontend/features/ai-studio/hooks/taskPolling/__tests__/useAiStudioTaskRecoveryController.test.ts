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
    vi.clearAllMocks();
  });

  it("marks lookup hard-stopped outputs as server-recovery pending and clears active polling", () => {
    let output = makeOutput();
    const queueOutputUpdate = vi.fn(
      (outputId: string, updater: (item: StudioOutput) => StudioOutput) => {
        if (outputId === output.id) {
          output = updater(output);
        }
      }
    );
    const clearPollTimer = vi.fn();
    const onPollingOutputLookupHardStop = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTaskRecoveryController({
        clearPollTimer,
        onPollingOutputLookupHardStop,
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
    expect(onPollingOutputLookupHardStop).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        lookupMisses: 10,
      })
    );
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Waiting for server recovery...");
    expect(output.errorMessage).toBeNull();
    expect(output.errorMessageShort).toBeNull();
    expect(output.errorDetail).toBeNull();
  });

  it("only emits one hard-stop notification per output until recovery state resets", () => {
    const queueOutputUpdate = vi.fn();
    const clearPollTimer = vi.fn();
    const onPollingOutputLookupHardStop = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTaskRecoveryController({
        clearPollTimer,
        onPollingOutputLookupHardStop,
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
      result.current.handleOutputLookupHardStop({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        lookupMisses: 11,
        missingDurationMs: 5 * 60 * 1000,
      });
    });

    expect(onPollingOutputLookupHardStop).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.resetRecoveryState();
      result.current.handleOutputLookupHardStop({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        lookupMisses: 12,
        missingDurationMs: 5 * 60 * 1000,
      });
    });

    expect(onPollingOutputLookupHardStop).toHaveBeenCalledTimes(2);
  });
});

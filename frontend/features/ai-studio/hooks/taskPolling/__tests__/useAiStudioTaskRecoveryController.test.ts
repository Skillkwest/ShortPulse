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
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioTasks } from "../useAiStudioTasks";
import { fetchFalSeedreamStatus, fetchFalStatus } from "../../../../lib/falClient";

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../../../lib/keiClient", () => ({
  fetchKeiTaskStatus: vi.fn(),
}));

vi.mock("../../../../lib/falClient", () => ({
  fetchFalStatus: vi.fn(),
  fetchFalFlux2Status: vi.fn(),
  fetchFalFlux2KleinStatus: vi.fn(),
  fetchFalFlux2EditStatus: vi.fn(),
  fetchFalFlux2ProStatus: vi.fn(),
  fetchFalFlux2ProEditStatus: vi.fn(),
  fetchFalKlingStatus: vi.fn(),
  fetchFalKlingV3ImageToVideoStatus: vi.fn(),
  fetchFalNanoBananaStatus: vi.fn(),
  fetchFalNanoBananaEditStatus: vi.fn(),
  fetchFalNanoBananaProStatus: vi.fn(),
  fetchFalNanoBananaProEditStatus: vi.fn(),
  fetchFalSoraStatus: vi.fn(),
  fetchFalSeedanceStatus: vi.fn(),
  fetchFalSeedanceI2VStatus: vi.fn(),
  fetchFalSeedreamStatus: vi.fn(),
  fetchFalVeoStatus: vi.fn(),
  fetchFalVeoImageToVideoStatus: vi.fn(),
}));

const makeOutput = (): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Model",
  modelId: "model-id",
  status: "ready",
  timestamp: "Now",
  taskState: "running",
});

const asFalStatusResponse = (value: unknown): Awaited<ReturnType<typeof fetchFalStatus>> =>
  value as Awaited<ReturnType<typeof fetchFalStatus>>;

const flushQueuedOutputUpdates = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("useAiStudioTasks", () => {
  const fetchFalStatusMock = vi.mocked(fetchFalStatus);
  const fetchFalSeedreamStatusMock = vi.mocked(fetchFalSeedreamStatus);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a 2-minute background recovery check and restores preview URL when it appears later", async () => {
    fetchFalStatusMock.mockResolvedValueOnce({ status: "completed" }).mockResolvedValueOnce({
      status: "completed",
      data: { images: [{ url: "https://cdn.test/recovered.png" }] },
    });

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const notifyGenerationFailure = vi.fn();
    const onGenerationFailure = vi.fn();
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
        onGenerationFailure,
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("task-1", "out-1", 0, "fal", Date.now(), 20);
    });

    await vi.advanceTimersByTimeAsync(1200);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Generation finished, but no media URL was returned. Please retry.",
      "Generation finished, but no media URL was returned. Please retry.",
      expect.objectContaining({
        reasonCode: "no_media_after_terminal_success",
      })
    );
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal",
        reasonCode: "no_media_after_terminal_success",
      })
    );

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(2);
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

  it("clears background recovery timers on unmount", async () => {
    fetchFalStatusMock.mockResolvedValue({ status: "completed" });

    const updateOutputById = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-1", "out-1", 0, "fal", Date.now(), 20);
    });

    await vi.advanceTimersByTimeAsync(1200);
    await flushQueuedOutputUpdates();
    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);

    unmount();
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces provider detail array messages (file_download_error) as primary failure text", async () => {
    fetchFalStatusMock.mockImplementationOnce(async () =>
      asFalStatusResponse({
        status: "error",
        detail: [
          {
            type: "file_download_error",
            msg: "Failed to download the file. Please check if the URL is accessible and try again.",
          },
        ],
      })
    );

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const notifyGenerationFailure = vi.fn();
    const onGenerationFailure = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
        onGenerationFailure,
      })
    );

    act(() => {
      result.current.startPollingTask("task-1", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(1200);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Failed to download the file.",
      "Failed to download the file. Please check if the URL is accessible and try again.",
      expect.objectContaining({
        reasonCode: "provider_error",
        providerState: "error",
      })
    );
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        provider: "fal",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toContain("Failed to download the file.");
  });

  it("forces success for image providers when media is present even if state is non-terminal", async () => {
    fetchFalSeedreamStatusMock.mockResolvedValueOnce({
      status: "in_progress",
      data: { images: [{ url: "https://cdn.test/final-seedream.png" }] },
    });

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const notifyGenerationFailure = vi.fn();
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("seedream-task-1", "out-1", 0, "fal-seedream");
    });

    await vi.advanceTimersByTimeAsync(1200);

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "seedream-task-1",
        provider: "fal-seedream",
        resultUrls: ["https://cdn.test/final-seedream.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/final-seedream.png");
  });

  it("treats done states as terminal and enters no-media finalization retries", async () => {
    fetchFalSeedreamStatusMock
      .mockResolvedValueOnce({
        status: "done",
      })
      .mockResolvedValueOnce({
        status: "done",
      });

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const notifyGenerationFailure = vi.fn();
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("seedream-task-2", "out-1", 0, "fal-seedream");
    });

    await vi.advanceTimersByTimeAsync(1200);
    await flushQueuedOutputUpdates();

    expect(fetchFalSeedreamStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");

    await vi.advanceTimersByTimeAsync(3000);
    await flushQueuedOutputUpdates();
    expect(fetchFalSeedreamStatusMock).toHaveBeenCalledTimes(2);
  });

  it("captures timeout context metadata when polling exceeds max wait", () => {
    const updateOutputById = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const onGenerationFailure = vi.fn();
    const startedAt = Date.now() - (9 * 60 * 1000 + 2_000);

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
        onGenerationFailure,
      })
    );

    act(() => {
      result.current.startPollingTask("task-timeout", "out-1", 4, "fal", startedAt, 2);
    });

    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Timed out waiting for provider result.",
      "Timed out waiting for provider result.",
      expect.objectContaining({
        reasonCode: "poll_timeout",
        pollAttempt: 4,
        noMediaAttempt: 2,
        maxWaitMs: 8 * 60 * 1000,
      })
    );
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-timeout",
        provider: "fal",
        reasonCode: "poll_timeout",
      })
    );
  });

  it("skips polling when the output was removed before the poll starts", async () => {
    const updateOutputById = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const findOutputById = vi.fn(() => null);

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        findOutputById,
        notifyGenerationFailure,
      })
    );

    act(() => {
      result.current.startPollingTask("task-gone", "out-gone", 0, "fal");
    });
    await vi.advanceTimersByTimeAsync(2_000);

    expect(fetchFalStatusMock).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(updateOutputById).not.toHaveBeenCalled();
  });

  it("recovers from transient output lookup misses and resumes polling", async () => {
    fetchFalStatusMock.mockResolvedValueOnce({
      status: "completed",
      data: { images: [{ url: "https://cdn.test/transient-recovery.png" }] },
    });

    let output = makeOutput();
    let lookups = 0;
    const findOutputById = vi.fn((id: string) => {
      if (id !== output.id) return null;
      lookups += 1;
      if (lookups <= 2) return null;
      return output;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const notifyGenerationFailure = vi.fn();
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        findOutputById,
        notifyGenerationFailure,
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("task-transient", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_500);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-transient",
        provider: "fal",
        resultUrls: ["https://cdn.test/transient-recovery.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/transient-recovery.png");
  });

  it("keeps polling alive after extended output lookup misses and resumes when output returns", async () => {
    fetchFalStatusMock.mockResolvedValueOnce({
      status: "completed",
      data: { images: [{ url: "https://cdn.test/extended-recovery.png" }] },
    });

    let output = makeOutput();
    let lookups = 0;
    const findOutputById = vi.fn((id: string) => {
      if (id !== output.id) return null;
      lookups += 1;
      if (lookups <= 9) return null;
      return output;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const notifyGenerationFailure = vi.fn();
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        findOutputById,
        notifyGenerationFailure,
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("task-extended", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(12_000);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-extended",
        provider: "fal",
        resultUrls: ["https://cdn.test/extended-recovery.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/extended-recovery.png");
  });

  it("resets an existing timer before restarting polling for the same output", async () => {
    fetchFalStatusMock.mockResolvedValue({
      status: "pending",
    });
    const output = makeOutput();
    const updateOutputById = vi.fn();
    const findOutputById = vi.fn((id: string) => (id === output.id ? output : null));

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        findOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-dup", "out-1", 0, "fal");
      result.current.startPollingTask("task-dup", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(1_250);
    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
  });
});

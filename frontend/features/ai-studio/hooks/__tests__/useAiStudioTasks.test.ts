import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS, useAiStudioTasks } from "../useAiStudioTasks";
import { MAX_CONCURRENT_STATUS_REQUESTS } from "../taskPolling/pollingSchedulePolicy";
import { resolveLatestPublishedGenerationDelivery } from "../../logic/generatedMediaAuthority";
import { resolveGenerationIdForRequestId } from "../../logic/mediaLibraryPersistence";
import {
  fetchFalBriaBackgroundRemoveStatus,
  fetchFalSeedreamStatus,
  fetchFalStatus,
  fetchKieKlingImageToVideoStatus,
  fetchKieSeedanceVideoStatus,
  fetchKieVeoImageToVideoStatus,
} from "../../../../lib/falClient";

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../../../lib/falClient", () => ({
  fetchFalStatus: vi.fn(),
  fetchFalBriaBackgroundRemoveStatus: vi.fn(),
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
  fetchFalSeedanceStatus: vi.fn(),
  fetchFalSeedanceI2VStatus: vi.fn(),
  fetchFalSeedreamStatus: vi.fn(),
  fetchFalVeoStatus: vi.fn(),
  fetchFalVeoImageToVideoStatus: vi.fn(),
  fetchKieVeoImageToVideoStatus: vi.fn(),
  fetchKieKlingImageToVideoStatus: vi.fn(),
  fetchKieSeedanceVideoStatus: vi.fn(),
}));

vi.mock("../../logic/generatedMediaAuthority", () => ({
  resolveLatestPublishedGenerationDelivery: vi.fn(),
}));

vi.mock("../../logic/mediaLibraryPersistence", () => ({
  resolveGenerationIdForRequestId: vi.fn(),
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

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const asFalStatusResponse = (value: unknown): Awaited<ReturnType<typeof fetchFalStatus>> =>
  value as Awaited<ReturnType<typeof fetchFalStatus>>;
const asKieVeoStatusResponse = (
  value: unknown
): Awaited<ReturnType<typeof fetchKieVeoImageToVideoStatus>> =>
  value as Awaited<ReturnType<typeof fetchKieVeoImageToVideoStatus>>;
const asKieKlingStatusResponse = (
  value: unknown
): Awaited<ReturnType<typeof fetchKieKlingImageToVideoStatus>> =>
  value as Awaited<ReturnType<typeof fetchKieKlingImageToVideoStatus>>;
const asKieSeedanceStatusResponse = (
  value: unknown
): Awaited<ReturnType<typeof fetchKieSeedanceVideoStatus>> =>
  value as Awaited<ReturnType<typeof fetchKieSeedanceVideoStatus>>;

const flushQueuedOutputUpdates = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("useAiStudioTasks", () => {
  const fetchFalStatusMock = vi.mocked(fetchFalStatus);
  const fetchFalBriaBackgroundRemoveStatusMock = vi.mocked(fetchFalBriaBackgroundRemoveStatus);
  const fetchFalSeedreamStatusMock = vi.mocked(fetchFalSeedreamStatus);
  const fetchKieVeoImageToVideoStatusMock = vi.mocked(fetchKieVeoImageToVideoStatus);
  const fetchKieKlingImageToVideoStatusMock = vi.mocked(fetchKieKlingImageToVideoStatus);
  const fetchKieSeedanceVideoStatusMock = vi.mocked(fetchKieSeedanceVideoStatus);
  const resolveGenerationIdForRequestIdMock = vi.mocked(resolveGenerationIdForRequestId);
  const resolveLatestPublishedGenerationDeliveryMock = vi.mocked(
    resolveLatestPublishedGenerationDelivery
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    resolveGenerationIdForRequestIdMock.mockResolvedValue(null);
    resolveLatestPublishedGenerationDeliveryMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("continues direct polling and restores preview URL when canonical media appears later", async () => {
    fetchFalStatusMock.mockResolvedValueOnce({ status: "completed" }).mockResolvedValueOnce({
      status: "completed",
      generationId: "gen-recovered-1",
      data: { images: [{ url: "https://cdn.test/recovered.png" }] },
      shortpulseLifecycle: {
        taskState: "success",
        isTerminal: true,
        resultUrls: ["https://cdn.test/recovered.png"],
      },
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

    await vi.advanceTimersByTimeAsync(2_500);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4_600);
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
    expect(output.generationId).toBe("gen-recovered-1");
    expect(output.taskState).toBe("success");
  });

  it("backfills generation id from status polling when provider returns it", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "completed",
        generationId: "gen-polled-1",
        data: { images: [{ url: "https://cdn.test/polled.png" }] },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/polled.png"],
        },
      })
    );

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-status-gen-1", "out-1", 0, "fal", Date.now(), 20);
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(output.previewUrl).toBe("https://cdn.test/polled.png");
    expect(output.generationId).toBe("gen-polled-1");
    expect(output.taskState).toBe("success");
  });

  it("honors the dispatch handoff delay override before the first status poll", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "completed",
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/handoff-delay.png"],
        },
      })
    );

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask(
        "task-handoff-delay",
        "out-1",
        0,
        "fal",
        Date.now(),
        0,
        undefined,
        { initialDelayMs: DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS }
      );
    });

    await vi.advanceTimersByTimeAsync(DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS - 25);
    expect(fetchFalStatusMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
    expect(output.taskState).toBe("success");
  });

  it("prefers server lifecycle success hints over raw provider payload interpretation", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "IN_PROGRESS",
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/server-hint.png"],
        },
      })
    );

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("task-server-hint-success", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/server-hint.png");
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-server-hint-success",
        resultUrls: ["https://cdn.test/server-hint.png"],
      })
    );
  });

  it("hands lifecycle success without canonical result URLs over to server recovery", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "completed",
        data: { images: [{ url: "https://cdn.test/raw-fallback.png" }] },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: [],
          providerState: "completed",
        },
      })
    );

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("task-lifecycle-no-urls", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.previewUrl).toBeUndefined();
    expect(output.timestamp).toBe("Processing...");
  });

  it("reconciles canonical published delivery on recovery recheck polls", async () => {
    fetchFalSeedreamStatusMock.mockResolvedValue({
      status: "done",
    });
    resolveGenerationIdForRequestIdMock.mockResolvedValue("gen-canonical-1");
    resolveLatestPublishedGenerationDeliveryMock.mockResolvedValue({
      previewUrl: "https://cdn.test/canonical-preview.png",
      fullUrl: "https://cdn.test/canonical-full.png",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("seedream-task-canonical", "out-1", 0, "fal-seedream");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith("seedream-task-canonical");
    expect(resolveLatestPublishedGenerationDeliveryMock).toHaveBeenCalledWith({
      generationId: "gen-canonical-1",
    });
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "seedream-task-canonical",
        provider: "fal-seedream",
        resultUrls: ["https://cdn.test/canonical-full.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.generationId).toBe("gen-canonical-1");
    expect(output.previewUrl).toBe("https://cdn.test/canonical-preview.png");
    expect(output.resultUrls).toEqual(["https://cdn.test/canonical-full.png"]);
  });

  it("prefers server lifecycle failure hints over raw provider failure parsing", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "IN_PROGRESS",
        shortpulseLifecycle: {
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Generation blocked",
          errorDetail: "Blocked by server-side policy",
          providerState: "failed",
        },
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
      result.current.startPollingTask("task-server-hint-failure", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Generation blocked",
      "Blocked by server-side policy",
      expect.objectContaining({
        reasonCode: "provider_error",
        providerState: "failed",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        message: "Blocked by server-side policy",
        reasonCode: "provider_error",
      })
    );
  });

  it("clears active poll timers on unmount", async () => {
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

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();
    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);

    unmount();
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
  });

  it("defers status polling while the tab is hidden and resumes when visible", async () => {
    const visibilityStateSpy = vi.spyOn(document, "visibilityState", "get");
    try {
      visibilityStateSpy.mockReturnValue("hidden");
      fetchFalStatusMock.mockResolvedValueOnce(
        asFalStatusResponse({
          status: "completed",
          data: { images: [{ url: "https://cdn.test/hidden-visible.png" }] },
          shortpulseLifecycle: {
            taskState: "success",
            isTerminal: true,
            resultUrls: ["https://cdn.test/hidden-visible.png"],
          },
        })
      );

      let output = makeOutput();
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
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
        result.current.startPollingTask("task-hidden-tab", "out-1", 0, "fal");
      });

      await vi.advanceTimersByTimeAsync(14_500);
      expect(fetchFalStatusMock).not.toHaveBeenCalled();

      visibilityStateSpy.mockReturnValue("visible");
      await vi.advanceTimersByTimeAsync(4_000);
      await flushQueuedOutputUpdates();

      expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
      expect(onGenerationSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          outputId: "out-1",
          taskId: "task-hidden-tab",
          provider: "fal",
          resultUrls: ["https://cdn.test/hidden-visible.png"],
        })
      );
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
      expect(output.taskState).toBe("success");
    } finally {
      visibilityStateSpy.mockRestore();
    }
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
        shortpulseLifecycle: {
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Failed to download the file.",
          errorDetail:
            "Failed to download the file. Please check if the URL is accessible and try again.",
          providerState: "error",
        },
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

    await vi.advanceTimersByTimeAsync(2_300);
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

  it("fails immediately on terminal provider error payloads and does not continue polling", async () => {
    fetchFalStatusMock.mockImplementationOnce(async () =>
      asFalStatusResponse({
        status: "error",
        detail: [{ type: "downstream_service_error", msg: "Downstream service error" }],
        shortpulseLifecycle: {
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Downstream service error",
          errorDetail: "Downstream service error",
          providerState: "error",
        },
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
      result.current.startPollingTask("task-terminal-error", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Downstream service error",
      "Downstream service error",
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
    expect(output.errorMessage).toBe("Downstream service error");

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await flushQueuedOutputUpdates();
    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
  });

  it("does not surface non-failure status text on terminal failures", async () => {
    fetchFalStatusMock.mockImplementationOnce(async () =>
      asFalStatusResponse({
        status: "failed",
        statusMessage: "Success",
        shortpulseLifecycle: {
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Generation failed",
          errorDetail: "Generation failed",
          providerState: "failed",
        },
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
      result.current.startPollingTask("task-failed-success-text", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Generation failed",
      "Generation failed",
      expect.objectContaining({
        reasonCode: "provider_error",
        providerState: "failed",
      })
    );
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        provider: "fal",
        message: "Generation failed",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Generation failed");
    expect(output.errorMessageShort).toBe("Generation failed");
  });

  it("does not surface neutral raw message text on terminal failures", async () => {
    fetchFalStatusMock.mockImplementationOnce(async () =>
      asFalStatusResponse({
        status: "failed",
        message: "Queued for retry",
        shortpulseLifecycle: {
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Generation failed",
          errorDetail: "Generation failed",
          providerState: "failed",
        },
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
      result.current.startPollingTask("task-failed-neutral-message", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Generation failed",
      "Generation failed",
      expect.objectContaining({
        reasonCode: "provider_error",
        providerState: "failed",
      })
    );
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        provider: "fal",
        message: "Generation failed",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Generation failed");
  });

  it("uses raw message text when provider explicitly reports error status", async () => {
    fetchFalStatusMock.mockImplementationOnce(async () =>
      asFalStatusResponse({
        status: "error",
        message: "Downstream service error",
        shortpulseLifecycle: {
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Downstream service error",
          errorDetail: "Downstream service error",
          providerState: "error",
        },
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
      result.current.startPollingTask("task-error-message-field", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Downstream service error",
      "Downstream service error",
      expect.objectContaining({
        reasonCode: "provider_error",
        providerState: "error",
      })
    );
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        provider: "fal",
        message: "Downstream service error",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Downstream service error");
  });

  it("does not force success for nonterminal raw provider payloads that only happen to include media", async () => {
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

    await vi.advanceTimersByTimeAsync(2_300);

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).not.toBe("success");
  });

  it("does not force success for raw provider payloads that include media without terminal state", async () => {
    fetchFalStatusMock.mockResolvedValueOnce({
      data: { images: [{ url: "https://cdn.test/raw-media-without-status.png" }] },
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
      result.current.startPollingTask("task-raw-media-without-status", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.previewUrl).toBeUndefined();
    expect(output.timestamp).toBe("Processing...");
  });

  it("prefers video URLs for video-mode outputs when provider payload includes images and videos", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "completed",
        data: {
          images: [{ url: "https://cdn.test/video-poster.png" }],
          videos: [{ url: "https://cdn.test/video-output.mp4" }],
        },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/video-output.mp4"],
        },
      })
    );

    let output: StudioOutput = {
      ...makeOutput(),
      mode: "video",
      modelId: "fal-ai/veo3.1/image-to-video",
    };
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const findOutputById = vi.fn((id: string) => (id === output.id ? output : null));
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
      result.current.startPollingTask("video-task-1", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledWith("video-task-1");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "video-task-1",
        provider: "fal",
        resultUrls: ["https://cdn.test/video-output.mp4"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/video-output.mp4");
  });

  it("polls Bria background-remove tasks via the Bria status endpoint", async () => {
    fetchFalBriaBackgroundRemoveStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "completed",
        data: { images: [{ url: "https://cdn.test/bria-output.png" }] },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/bria-output.png"],
        },
      })
    );

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
      result.current.startPollingTask("bria-task-1", "out-1", 0, "fal-bria-background-remove");
    });

    await vi.advanceTimersByTimeAsync(2_300);

    expect(fetchFalBriaBackgroundRemoveStatusMock).toHaveBeenCalledWith("bria-task-1");
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "bria-task-1",
        provider: "fal-bria-background-remove",
        resultUrls: ["https://cdn.test/bria-output.png"],
      })
    );
    expect(output.previewUrl).toBe("https://cdn.test/bria-output.png");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });

  it("marks Kie Veo outputs successful from data.response.resultUrls payloads", async () => {
    fetchKieVeoImageToVideoStatusMock.mockImplementationOnce(async () =>
      asKieVeoStatusResponse({
        status: "completed",
        data: {
          successFlag: 1,
          response: {
            resultUrls: ["https://cdn.test/kie-veo-result.mp4"],
          },
        },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/kie-veo-result.mp4"],
        },
      })
    );

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
      result.current.startPollingTask("kie-veo-task-1", "out-1", 0, "kie-veo");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchKieVeoImageToVideoStatusMock).toHaveBeenCalledWith("kie-veo-task-1");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "kie-veo-task-1",
        provider: "kie-veo",
        resultUrls: ["https://cdn.test/kie-veo-result.mp4"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/kie-veo-result.mp4");
  });

  it("marks Kie Kling outputs successful from data.resultJson payloads", async () => {
    fetchKieKlingImageToVideoStatusMock.mockImplementationOnce(async () =>
      asKieKlingStatusResponse({
        data: {
          state: "success",
          resultJson: JSON.stringify({
            resultUrls: ["https://cdn.test/kie-kling-result.mp4"],
          }),
        },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/kie-kling-result.mp4"],
        },
      })
    );

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
      result.current.startPollingTask("kie-kling-task-1", "out-1", 0, "kie-kling");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchKieKlingImageToVideoStatusMock).toHaveBeenCalledWith("kie-kling-task-1");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "kie-kling-task-1",
        provider: "kie-kling",
        resultUrls: ["https://cdn.test/kie-kling-result.mp4"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/kie-kling-result.mp4");
  });

  it("marks Kie Seedance outputs successful from resultUrls payloads", async () => {
    fetchKieSeedanceVideoStatusMock.mockImplementationOnce(async () =>
      asKieSeedanceStatusResponse({
        status: "completed",
        data: {
          resultUrls: ["https://cdn.test/kie-seedance-result.mp4"],
        },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/kie-seedance-result.mp4"],
        },
      })
    );

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
      result.current.startPollingTask("kie-seedance-task-1", "out-1", 0, "kie-seedance");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchKieSeedanceVideoStatusMock).toHaveBeenCalledWith("kie-seedance-task-1");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "kie-seedance-task-1",
        provider: "kie-seedance",
        resultUrls: ["https://cdn.test/kie-seedance-result.mp4"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/kie-seedance-result.mp4");
  });

  it("treats done states as terminal and keeps polling for canonical server settlement", async () => {
    fetchFalSeedreamStatusMock
      .mockResolvedValueOnce({
        status: "done",
      })
      .mockResolvedValue({
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

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchFalSeedreamStatusMock).toHaveBeenCalledTimes(2);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");

    await vi.advanceTimersByTimeAsync(1_000);
    await flushQueuedOutputUpdates();
    expect(fetchFalSeedreamStatusMock).toHaveBeenCalledTimes(3);
  });

  it("keeps image outputs live when terminal success lacks media", async () => {
    fetchFalSeedreamStatusMock.mockResolvedValue({ status: "done" });

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const notifyGenerationFailure = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
      })
    );

    act(() => {
      result.current.startPollingTask("seedream-task-bounded", "out-1", 0, "fal-seedream");
    });

    await vi.advanceTimersByTimeAsync(2_100);
    await flushQueuedOutputUpdates();

    expect(fetchFalSeedreamStatusMock).toHaveBeenCalledTimes(2);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(fetchFalSeedreamStatusMock).toHaveBeenCalledTimes(3);
  });

  it("normalizes provider nonterminal states to running task state", async () => {
    fetchFalStatusMock.mockResolvedValueOnce({ status: "processing" });

    let output: StudioOutput = {
      ...makeOutput(),
      taskState: "pending",
      timestamp: "Submitting...",
    };
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-processing", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });

  it("prefers server lifecycle running hints for nonterminal polling state", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "QUEUED",
        shortpulseLifecycle: {
          taskState: "running",
          isTerminal: false,
          providerState: "running",
        },
      })
    );

    let output: StudioOutput = {
      ...makeOutput(),
      taskState: "pending",
      timestamp: "Submitting...",
    };
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-lifecycle-running", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });

  it("prefers server lifecycle recovery-pending hints for nonterminal polling state", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "IN_PROGRESS",
        shortpulseLifecycle: {
          taskState: "running",
          isTerminal: false,
          providerState: "running",
          recoveryPending: true,
        },
      })
    );

    let output: StudioOutput = {
      ...makeOutput(),
      taskState: "running",
      timestamp: "Processing...",
      errorMessage: "Old error",
      errorMessageShort: "Old error",
      errorDetail: "Old error detail",
    };
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-lifecycle-recovery", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
    expect(output.errorMessage ?? null).toBeNull();
    expect(output.errorMessageShort).toBeNull();
    expect(output.errorDetail).toBeNull();
  });

  it("does not fail on transient error fields when server lifecycle marks the poll nonterminal", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        error: "upstream temporarily unavailable",
        shortpulseLifecycle: {
          taskState: "running",
          isTerminal: false,
          providerState: "running",
          recoveryPending: true,
        },
      })
    );

    let output: StudioOutput = {
      ...makeOutput(),
      taskState: "running",
      timestamp: "Processing...",
    };
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
      result.current.startPollingTask("task-transient-recovery-hint", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });

  it("does not treat raw completed status as success when server lifecycle marks recovery pending", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "COMPLETED",
        shortpulseLifecycle: {
          taskState: "running",
          isTerminal: false,
          providerState: "completed",
          recoveryPending: true,
        },
      })
    );

    let output: StudioOutput = {
      ...makeOutput(),
      taskState: "running",
      timestamp: "Processing...",
    };
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
        onGenerationSuccess,
      })
    );

    act(() => {
      result.current.startPollingTask("task-completed-recovery-hint", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });
  it("does not requeue identical running progress state across repeated pending polls", async () => {
    fetchFalStatusMock.mockResolvedValue({ status: "processing" });

    let output: StudioOutput = {
      ...makeOutput(),
      taskState: "pending",
      timestamp: "Submitting...",
    };
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-processing-repeat", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_100);
    await flushQueuedOutputUpdates();
    await vi.advanceTimersByTimeAsync(3_500);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(2);
    expect(updateOutputById).toHaveBeenCalledTimes(1);
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });

  it("keeps output live and stays in server-recovery posture when polling exceeds max wait", async () => {
    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const notifyGenerationFailure = vi.fn();
    const onGenerationFailure = vi.fn();
    const startedAt = Date.now() - (19 * 60 * 1000 + 2_000);

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

    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.errorMessage ?? null).toBeNull();
  });

  it("retries timeout-classified status transport errors and succeeds on a later poll", async () => {
    fetchFalStatusMock
      .mockRejectedValueOnce(new Error("[fal-status:flux] timed out after 75000ms"))
      .mockResolvedValueOnce(
        asFalStatusResponse({
          status: "completed",
          data: { images: [{ url: "https://cdn.test/timeout-retry-success.png" }] },
          shortpulseLifecycle: {
            taskState: "success",
            isTerminal: true,
            resultUrls: ["https://cdn.test/timeout-retry-success.png"],
          },
        })
      );

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const notifyGenerationFailure = vi.fn();
    const onGenerationSuccess = vi.fn();
    const onGenerationFailure = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
        onGenerationSuccess,
        onGenerationFailure,
      })
    );

    act(() => {
      result.current.startPollingTask("task-timeout-retry", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_100);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Retrying status...");

    await vi.advanceTimersByTimeAsync(2_200);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(2);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-timeout-retry",
        provider: "fal",
        resultUrls: ["https://cdn.test/timeout-retry-success.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/timeout-retry-success.png");
  });

  it("does not requeue identical retry progress state across repeated status errors", async () => {
    fetchFalStatusMock
      .mockRejectedValueOnce(new Error("[fal-status:flux] timed out after 75000ms"))
      .mockRejectedValueOnce(new Error("[fal-status:flux] timed out after 75000ms"));

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-timeout-repeat", "out-1", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(2_100);
    await flushQueuedOutputUpdates();
    await vi.advanceTimersByTimeAsync(2_500);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(2);
    expect(updateOutputById).toHaveBeenCalledTimes(1);
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Retrying status...");
  });

  it("keeps output live when status transport errors exhaust the retry budget", async () => {
    fetchFalStatusMock.mockRejectedValue(new Error("status transport unavailable"));

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
      result.current.startPollingTask("task-status-error", "out-1", 30, "fal");
    });

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
    expect(output.errorMessage).toBeNull();
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

  it("emits hard-stop callback when output lookup is missing for too long", async () => {
    const updateOutputById = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const findOutputById = vi.fn(() => null);
    const onPollingOutputLookupHardStop = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        findOutputById,
        notifyGenerationFailure,
        onPollingOutputLookupHardStop,
      })
    );

    act(() => {
      result.current.startPollingTask("task-hard-stop", "out-gone", 0, "fal");
    });

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 5_000);

    expect(fetchFalStatusMock).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onPollingOutputLookupHardStop).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-gone",
        taskId: "task-hard-stop",
        provider: "fal",
      })
    );
  });

  it("recovers from transient output lookup misses and resumes polling", async () => {
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "completed",
        data: { images: [{ url: "https://cdn.test/transient-recovery.png" }] },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/transient-recovery.png"],
        },
      })
    );

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

    await vi.advanceTimersByTimeAsync(4_500);
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
    fetchFalStatusMock.mockResolvedValueOnce(
      asFalStatusResponse({
        status: "completed",
        data: { images: [{ url: "https://cdn.test/extended-recovery.png" }] },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/extended-recovery.png"],
        },
      })
    );

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

    await vi.advanceTimersByTimeAsync(13_000);
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

    await vi.advanceTimersByTimeAsync(2_300);
    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);
  });

  it("allows four fresh status polls before deferring the fifth for concurrency backpressure", async () => {
    const deferreds = Array.from({ length: MAX_CONCURRENT_STATUS_REQUESTS + 1 }, () =>
      createDeferred<Awaited<ReturnType<typeof fetchFalStatus>>>()
    );
    let callIndex = 0;
    fetchFalStatusMock.mockImplementation(() => {
      const next = deferreds[callIndex];
      callIndex += 1;
      if (!next) {
        throw new Error("unexpected status poll");
      }
      return next.promise;
    });

    const outputsById = Object.fromEntries(
      Array.from({ length: MAX_CONCURRENT_STATUS_REQUESTS + 1 }, (_, index) => [
        `out-${index + 1}`,
        { ...makeOutput(), id: `out-${index + 1}` },
      ])
    ) as Record<string, StudioOutput>;
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputsById[id];
      if (current) {
        outputsById[id] = updater(current);
      }
    });
    const onGenerationSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        findOutputById: (id: string) => outputsById[id] ?? null,
        notifyGenerationFailure: vi.fn(),
        onGenerationSuccess,
      })
    );

    act(() => {
      Array.from({ length: MAX_CONCURRENT_STATUS_REQUESTS + 1 }, (_, index) => {
        result.current.startPollingTask(`task-${index + 1}`, `out-${index + 1}`, 0, "fal");
      });
    });

    await vi.advanceTimersByTimeAsync(2_300);

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(MAX_CONCURRENT_STATUS_REQUESTS);

    deferreds.slice(0, MAX_CONCURRENT_STATUS_REQUESTS).forEach((deferred, index) =>
      deferred.resolve(
        asFalStatusResponse({
          status: "completed",
          data: { images: [{ url: `https://cdn.test/concurrency-${index + 1}.png` }] },
          shortpulseLifecycle: {
            taskState: "success",
            isTerminal: true,
            resultUrls: [`https://cdn.test/concurrency-${index + 1}.png`],
          },
        })
      )
    );

    await Promise.resolve();
    await Promise.resolve();
    await flushQueuedOutputUpdates();
    await vi.advanceTimersByTimeAsync(6_000);
    await flushQueuedOutputUpdates();

    expect(fetchFalStatusMock).toHaveBeenCalledTimes(MAX_CONCURRENT_STATUS_REQUESTS + 1);

    deferreds[MAX_CONCURRENT_STATUS_REQUESTS]?.resolve(
      asFalStatusResponse({
        status: "completed",
        data: { images: [{ url: "https://cdn.test/concurrency-5.png" }] },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/concurrency-5.png"],
        },
      })
    );

    await Promise.resolve();
    await Promise.resolve();
    await flushQueuedOutputUpdates();

    expect(onGenerationSuccess).toHaveBeenCalledTimes(MAX_CONCURRENT_STATUS_REQUESTS + 1);
  });

  it("keeps direct polling alive across repeated no-media terminal responses", async () => {
    fetchFalStatusMock.mockResolvedValue({ status: "completed" });

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });
    const notifyGenerationFailure = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure,
      })
    );

    act(() => {
      result.current.startPollingTask("task-no-media-tail", "out-1", 0, "fal", Date.now(), 20);
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();
    expect(fetchFalStatusMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();
    expect(fetchFalStatusMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();
    expect(fetchFalStatusMock.mock.calls.length).toBeGreaterThanOrEqual(3);

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();
    expect(fetchFalStatusMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

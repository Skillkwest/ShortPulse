import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS, useAiStudioTasks } from "../useAiStudioTasks";
import { MAX_CONCURRENT_STATUS_REQUESTS } from "../taskPolling/pollingSchedulePolicy";
import {
  resolveGenerationProjectionLifecycle,
  resolveVisibleGenerationReconcile,
} from "../../logic/generatedMediaAuthority";
import type { FalStatusResponse } from "../../../../lib/falClient";

const falClientMocks = vi.hoisted(() => ({
  fetchFalBriaBackgroundRemoveStatus: vi.fn(),
  fetchFalFlux2KleinStatus: vi.fn(),
  fetchFalNanoBananaStatus: vi.fn(),
  fetchFalNanoBananaEditStatus: vi.fn(),
  fetchFalNanoBananaProStatus: vi.fn(),
  fetchFalNanoBananaProEditStatus: vi.fn(),
  fetchFalSeedreamStatus: vi.fn(),
  fetchKieVeoImageToVideoStatus: vi.fn(),
  fetchKieKlingImageToVideoStatus: vi.fn(),
  fetchKieSeedanceVideoStatus: vi.fn(),
}));

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../../../lib/falClient", () => {
  const fetchQueuedGenerationStatusByModelId = vi.fn((modelId: string, requestId: string) => {
    switch (modelId) {
      case "fal-ai/bria/background/remove":
        return falClientMocks.fetchFalBriaBackgroundRemoveStatus(requestId);
      case "fal-ai/flux-2/klein/9b":
        return falClientMocks.fetchFalFlux2KleinStatus(requestId);
      case "fal-ai/nano-banana-2":
        return falClientMocks.fetchFalNanoBananaStatus(requestId);
      case "fal-ai/nano-banana-2/edit":
        return falClientMocks.fetchFalNanoBananaEditStatus(requestId);
      case "fal-ai/nano-banana-pro":
        return falClientMocks.fetchFalNanoBananaProStatus(requestId);
      case "fal-ai/nano-banana-pro/edit":
        return falClientMocks.fetchFalNanoBananaProEditStatus(requestId);
      case "fal-ai/bytedance/seedream/v4.5/text-to-image":
        return falClientMocks.fetchFalSeedreamStatus(requestId);
      case "kie-ai/veo-3.1-fast-i2v":
        return falClientMocks.fetchKieVeoImageToVideoStatus(requestId);
      case "kie-ai/kling-3.0":
        return falClientMocks.fetchKieKlingImageToVideoStatus(requestId);
      case "kie-ai/seedance-2":
      case "kie-ai/seedance-2-fast":
        return falClientMocks.fetchKieSeedanceVideoStatus(requestId);
      default:
        return Promise.reject(new Error(`Unhandled mocked model id ${modelId}`));
    }
  });
  return {
    fetchQueuedGenerationStatusByModelId,
  };
});

vi.mock("../../logic/generatedMediaAuthority", () => ({
  resolveGenerationProjectionLifecycle: vi.fn(),
  resolveVisibleGenerationReconcile: vi.fn(),
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

const asFalNanoBananaStatusResponse = (value: unknown): FalStatusResponse =>
  value as FalStatusResponse;
const asKieVeoStatusResponse = (value: unknown): FalStatusResponse => value as FalStatusResponse;
const asKieKlingStatusResponse = (value: unknown): FalStatusResponse => value as FalStatusResponse;
const asKieSeedanceStatusResponse = (value: unknown): FalStatusResponse =>
  value as FalStatusResponse;

const flushQueuedOutputUpdates = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("useAiStudioTasks", () => {
  const fetchFalNanoBananaStatusMock = vi.mocked(falClientMocks.fetchFalNanoBananaStatus);
  const fetchFalBriaBackgroundRemoveStatusMock = vi.mocked(
    falClientMocks.fetchFalBriaBackgroundRemoveStatus
  );
  const fetchFalSeedreamStatusMock = vi.mocked(falClientMocks.fetchFalSeedreamStatus);
  const fetchKieVeoImageToVideoStatusMock = vi.mocked(falClientMocks.fetchKieVeoImageToVideoStatus);
  const fetchKieKlingImageToVideoStatusMock = vi.mocked(
    falClientMocks.fetchKieKlingImageToVideoStatus
  );
  const fetchKieSeedanceVideoStatusMock = vi.mocked(falClientMocks.fetchKieSeedanceVideoStatus);
  const resolveGenerationProjectionLifecycleMock = vi.mocked(resolveGenerationProjectionLifecycle);
  const resolveVisibleGenerationReconcileMock = vi.mocked(resolveVisibleGenerationReconcile);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    resolveGenerationProjectionLifecycleMock.mockResolvedValue(null);
    resolveVisibleGenerationReconcileMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("continues direct polling and restores preview URL when canonical media appears later", async () => {
    fetchFalNanoBananaStatusMock
      .mockResolvedValueOnce({ status: "completed" })
      .mockResolvedValueOnce({
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
      result.current.startPollingTask("task-1", "out-1", 0, "fal-nano-banana-2", Date.now(), 20);
    });

    await vi.advanceTimersByTimeAsync(2_500);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal-nano-banana-2",
        resultUrls: ["https://cdn.test/recovered.png"],
      })
    );
    expect(output.previewUrl).toBe("https://cdn.test/recovered.png");
    expect(output.generationId).toBe("gen-recovered-1");
    expect(output.taskState).toBe("success");
  });

  it("backfills generation id from status polling when provider returns it", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask(
        "task-status-gen-1",
        "out-1",
        0,
        "fal-nano-banana-2",
        Date.now(),
        20
      );
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(output.previewUrl).toBe("https://cdn.test/polled.png");
    expect(output.generationId).toBe("gen-polled-1");
    expect(output.taskState).toBe("success");
  });

  it("clears stale blocked_storage save copy when polling reports saved canonical media", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
        status: "completed",
        generationId: "gen-saved-1",
        data: { images: [{ url: "https://cdn.test/saved.png" }] },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/saved.png"],
          saveState: "saved",
          saveError: null,
        },
      })
    );

    let output: StudioOutput = {
      ...makeOutput(),
      saveState: "blocked_storage" as const,
      saveError:
        "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
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
      result.current.startPollingTask(
        "task-status-saved-1",
        "out-1",
        0,
        "fal-nano-banana-2",
        Date.now(),
        20
      );
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(output.saveState).toBe("saved");
    expect(output.status).toBe("saved");
    expect(output.saveError).toBeNull();
  });

  it("honors the dispatch handoff delay override before the first status poll", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
        status: "completed",
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/handoff-delay.png"],
        },
      })
    );

    let output: StudioOutput = {
      ...makeOutput(),
      saveState: "blocked_storage" as const,
      saveError:
        "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
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
      result.current.startPollingTask(
        "task-handoff-delay",
        "out-1",
        0,
        "fal-nano-banana-2",
        Date.now(),
        0,
        undefined,
        { initialDelayMs: DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS }
      );
    });

    await vi.advanceTimersByTimeAsync(DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS - 25);
    expect(fetchFalNanoBananaStatusMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
    expect(output.taskState).toBe("success");
  });

  it("prefers server lifecycle success hints over raw provider payload interpretation", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-server-hint-success", "out-1", 0, "fal-nano-banana-2");
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
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-lifecycle-no-urls", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.previewUrl).toBeUndefined();
    expect(output.timestamp).toBe("Processing...");
  });

  it("settles hidden terminal projection failures without polling the provider", async () => {
    fetchFalSeedreamStatusMock.mockResolvedValue({
      status: "processing",
    });
    resolveGenerationProjectionLifecycleMock.mockResolvedValue({
      generationId: "gen-hidden-failure",
      taskState: "fail",
      queueState: undefined,
      hiddenInReferenceGrid: true,
      referenceGridVisible: false,
      errorMessageShort: "Generation abandoned by user.",
      errorDetail: "Generation abandoned by user.",
    });

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
      result.current.startPollingTask("seedream-task-hidden", "out-1", 0, "fal-seedream");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(resolveGenerationProjectionLifecycleMock).toHaveBeenCalledWith({
      generationId: null,
      requestId: "seedream-task-hidden",
    });
    expect(resolveVisibleGenerationReconcileMock).not.toHaveBeenCalled();
    expect(fetchFalSeedreamStatusMock).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "seedream-task-hidden",
        provider: "fal-seedream",
        message: "Generation abandoned by user.",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.hiddenInReferenceGrid).toBe(true);
    expect(output.errorMessage).toBe("Generation abandoned by user.");
  });

  it("reconciles visible generation delivery on recovery recheck polls", async () => {
    fetchFalSeedreamStatusMock.mockResolvedValue({
      status: "done",
    });
    resolveVisibleGenerationReconcileMock.mockResolvedValue({
      generationId: "gen-canonical-1",
      previewUrl: "https://cdn.test/canonical-preview.png",
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://cdn.test/canonical-full.png"],
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

    expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
      generationId: null,
      requestId: "seedream-task-canonical",
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
    expect(output.saveState).toBe("saved");
    expect(output.status).toBe("saved");
    expect(output.saveError).toBeNull();
  });

  it("reconciles projection-backed delivery on ordinary retry polls", async () => {
    fetchFalSeedreamStatusMock.mockResolvedValue({
      status: "processing",
    });
    resolveVisibleGenerationReconcileMock.mockResolvedValue({
      generationId: "gen-projection-1",
      previewUrl: "https://cdn.test/projection-preview.png",
      previewPosterUrl: "https://cdn.test/projection-poster.jpg",
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://cdn.test/projection-full.png"],
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
      result.current.startPollingTask("seedream-task-projection", "out-1", 1, "fal-seedream");
    });

    await vi.advanceTimersByTimeAsync(1_500);
    await flushQueuedOutputUpdates();

    expect(fetchFalSeedreamStatusMock).not.toHaveBeenCalled();
    expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
      generationId: null,
      requestId: "seedream-task-projection",
    });
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "seedream-task-projection",
        provider: "fal-seedream",
        resultUrls: ["https://cdn.test/projection-full.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.generationId).toBe("gen-projection-1");
    expect(output.previewUrl).toBe("https://cdn.test/projection-preview.png");
    expect(output.previewPosterUrl).toBe("https://cdn.test/projection-poster.jpg");
    expect(output.resultUrls).toEqual(["https://cdn.test/projection-full.png"]);
  });

  it("checks canonical delivery before the first provider status request", async () => {
    fetchKieVeoImageToVideoStatusMock.mockResolvedValue(
      asKieVeoStatusResponse({
        status: "RUNNING",
      })
    );
    resolveVisibleGenerationReconcileMock.mockResolvedValue({
      generationId: "gen-first-poll-projection",
      previewUrl: "https://cdn.test/first-poll-preview.mp4",
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://cdn.test/first-poll-full.mp4"],
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
      result.current.startPollingTask("kie-task-first-poll", "out-1", 0, "kie-veo");
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(fetchKieVeoImageToVideoStatusMock).not.toHaveBeenCalled();
    expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
      generationId: null,
      requestId: "kie-task-first-poll",
    });
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "kie-task-first-poll",
        provider: "kie-veo",
        resultUrls: ["https://cdn.test/first-poll-full.mp4"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.generationId).toBe("gen-first-poll-projection");
    expect(output.previewUrl).toBe("https://cdn.test/first-poll-preview.mp4");
    expect(output.resultUrls).toEqual(["https://cdn.test/first-poll-full.mp4"]);
  });

  it("passes projectId to reconcile only on project routes", async () => {
    fetchFalSeedreamStatusMock.mockResolvedValue({
      status: "processing",
    });
    resolveVisibleGenerationReconcileMock.mockResolvedValue({
      generationId: "gen-project-projection-1",
      previewUrl: "https://cdn.test/project-projection-preview.png",
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://cdn.test/project-projection-full.png"],
    });

    let output = makeOutput();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (id === output.id) {
        output = updater(output);
      }
    });

    const { result } = renderHook(() =>
      useAiStudioTasks({
        projectId: "project-1",
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
        onGenerationSuccess: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("seedream-task-project", "out-1", 1, "fal-seedream");
    });

    await vi.advanceTimersByTimeAsync(1_500);
    await flushQueuedOutputUpdates();

    expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
      generationId: null,
      requestId: "seedream-task-project",
      projectId: "project-1",
    });
    expect(output.generationId).toBe("gen-project-projection-1");
  });

  it("prefers server lifecycle failure hints over raw provider failure parsing", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-server-hint-failure", "out-1", 0, "fal-nano-banana-2");
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
    fetchFalNanoBananaStatusMock.mockResolvedValue({ status: "completed" });

    const updateOutputById = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAiStudioTasks({
        updateOutputById,
        notifyGenerationFailure: vi.fn(),
      })
    );

    act(() => {
      result.current.startPollingTask("task-1", "out-1", 0, "fal-nano-banana-2", Date.now(), 20);
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();
    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);

    unmount();
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
  });

  it("defers status polling while the tab is hidden and resumes when visible", async () => {
    const visibilityStateSpy = vi.spyOn(document, "visibilityState", "get");
    try {
      visibilityStateSpy.mockReturnValue("hidden");
      fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
        asFalNanoBananaStatusResponse({
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
        result.current.startPollingTask("task-hidden-tab", "out-1", 0, "fal-nano-banana-2");
      });

      await vi.advanceTimersByTimeAsync(14_500);
      expect(fetchFalNanoBananaStatusMock).not.toHaveBeenCalled();

      visibilityStateSpy.mockReturnValue("visible");
      await vi.advanceTimersByTimeAsync(4_000);
      await flushQueuedOutputUpdates();

      expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
      expect(onGenerationSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          outputId: "out-1",
          taskId: "task-hidden-tab",
          provider: "fal-nano-banana-2",
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
    fetchFalNanoBananaStatusMock.mockImplementationOnce(async () =>
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-1", "out-1", 0, "fal-nano-banana-2");
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
        provider: "fal-nano-banana-2",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toContain("Failed to download the file.");
  });

  it("fails immediately on terminal provider error payloads and does not continue polling", async () => {
    fetchFalNanoBananaStatusMock.mockImplementationOnce(async () =>
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-terminal-error", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
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
        provider: "fal-nano-banana-2",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Downstream service error");

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await flushQueuedOutputUpdates();
    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
  });

  it("fails immediately on raw terminal provider errors without a lifecycle envelope", async () => {
    fetchFalNanoBananaStatusMock.mockImplementationOnce(async () =>
      asFalNanoBananaStatusResponse({
        status: "error",
        detail: [{ type: "downstream_service_error", msg: "Downstream service error" }],
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
      result.current.startPollingTask("task-raw-terminal-error", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
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
        provider: "fal-nano-banana-2",
        message: "Downstream service error",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Downstream service error");

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await flushQueuedOutputUpdates();
    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
  });

  it("does not surface non-failure status text on terminal failures", async () => {
    fetchFalNanoBananaStatusMock.mockImplementationOnce(async () =>
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-failed-success-text", "out-1", 0, "fal-nano-banana-2");
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
        provider: "fal-nano-banana-2",
        message: "Generation failed",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Generation failed");
    expect(output.errorMessageShort).toBe("Generation failed");
  });

  it("does not surface neutral raw message text on terminal failures", async () => {
    fetchFalNanoBananaStatusMock.mockImplementationOnce(async () =>
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask(
        "task-failed-neutral-message",
        "out-1",
        0,
        "fal-nano-banana-2"
      );
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
        provider: "fal-nano-banana-2",
        message: "Generation failed",
        reasonCode: "provider_error",
      })
    );
    expect(output.taskState).toBe("fail");
    expect(output.errorMessage).toBe("Generation failed");
  });

  it("uses raw message text when provider explicitly reports error status", async () => {
    fetchFalNanoBananaStatusMock.mockImplementationOnce(async () =>
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-error-message-field", "out-1", 0, "fal-nano-banana-2");
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
        provider: "fal-nano-banana-2",
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
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce({
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
      result.current.startPollingTask(
        "task-raw-media-without-status",
        "out-1",
        0,
        "fal-nano-banana-2"
      );
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
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("video-task-1", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledWith("video-task-1");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "video-task-1",
        provider: "fal-nano-banana-2",
        resultUrls: ["https://cdn.test/video-output.mp4"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/video-output.mp4");
  });

  it("polls Bria background-remove tasks via the Bria status endpoint", async () => {
    fetchFalBriaBackgroundRemoveStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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

  it("marks Kie Seedance 2 outputs successful from resultUrls payloads", async () => {
    fetchKieSeedanceVideoStatusMock.mockImplementationOnce(async () =>
      asKieSeedanceStatusResponse({
        status: "completed",
        data: {
          resultUrls: ["https://cdn.test/kie-seedance-2-result.mp4"],
        },
        shortpulseLifecycle: {
          taskState: "success",
          isTerminal: true,
          resultUrls: ["https://cdn.test/kie-seedance-2-result.mp4"],
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
      result.current.startPollingTask("kie-seedance-2-task-1", "out-1", 0, "kie-seedance-2");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(fetchKieSeedanceVideoStatusMock).toHaveBeenCalledWith("kie-seedance-2-task-1");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "kie-seedance-2-task-1",
        provider: "kie-seedance-2",
        resultUrls: ["https://cdn.test/kie-seedance-2-result.mp4"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/kie-seedance-2-result.mp4");
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

    expect(fetchFalSeedreamStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");

    await vi.advanceTimersByTimeAsync(1_000);
    await flushQueuedOutputUpdates();
    expect(fetchFalSeedreamStatusMock.mock.calls.length).toBeGreaterThanOrEqual(3);
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

    expect(fetchFalSeedreamStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();

    expect(fetchFalSeedreamStatusMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("normalizes provider nonterminal states to running task state", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce({ status: "processing" });

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
      result.current.startPollingTask("task-processing", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });

  it("prefers server lifecycle running hints for nonterminal polling state", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-lifecycle-running", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });

  it("prefers server lifecycle recovery-pending hints for nonterminal polling state", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-lifecycle-recovery", "out-1", 0, "fal-nano-banana-2");
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
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask(
        "task-transient-recovery-hint",
        "out-1",
        0,
        "fal-nano-banana-2"
      );
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });

  it("does not treat raw completed status as success when server lifecycle marks recovery pending", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask(
        "task-completed-recovery-hint",
        "out-1",
        0,
        "fal-nano-banana-2"
      );
    });

    await vi.advanceTimersByTimeAsync(2_300);
    await flushQueuedOutputUpdates();

    expect(onGenerationSuccess).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Processing...");
  });
  it("does not requeue identical running progress state across repeated pending polls", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValue({ status: "processing" });

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
      result.current.startPollingTask("task-processing-repeat", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_100);
    await flushQueuedOutputUpdates();
    await vi.advanceTimersByTimeAsync(3_500);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2);
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
      result.current.startPollingTask(
        "task-timeout",
        "out-1",
        4,
        "fal-nano-banana-2",
        startedAt,
        2
      );
    });

    await flushQueuedOutputUpdates();

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.errorMessage ?? null).toBeNull();
  });

  it("retries timeout-classified status transport errors and succeeds on a later poll", async () => {
    fetchFalNanoBananaStatusMock
      .mockRejectedValueOnce(new Error("[fal-status:flux] timed out after 75000ms"))
      .mockResolvedValueOnce(
        asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-timeout-retry", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_100);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Retrying status...");

    await vi.advanceTimersByTimeAsync(2_200);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-timeout-retry",
        provider: "fal-nano-banana-2",
        resultUrls: ["https://cdn.test/timeout-retry-success.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/timeout-retry-success.png");
  });

  it("does not requeue identical retry progress state across repeated status errors", async () => {
    fetchFalNanoBananaStatusMock
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
      result.current.startPollingTask("task-timeout-repeat", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_100);
    await flushQueuedOutputUpdates();
    await vi.advanceTimersByTimeAsync(2_500);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(updateOutputById).toHaveBeenCalledTimes(1);
    expect(output.taskState).toBe("running");
    expect(output.timestamp).toBe("Retrying status...");
  });

  it("keeps output live when status transport errors exhaust the retry budget", async () => {
    fetchFalNanoBananaStatusMock.mockRejectedValue(new Error("status transport unavailable"));

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
      result.current.startPollingTask("task-status-error", "out-1", 30, "fal-nano-banana-2");
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
      result.current.startPollingTask("task-gone", "out-gone", 0, "fal-nano-banana-2");
    });
    await vi.advanceTimersByTimeAsync(2_000);

    expect(fetchFalNanoBananaStatusMock).not.toHaveBeenCalled();
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
      result.current.startPollingTask("task-hard-stop", "out-gone", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 5_000);

    expect(fetchFalNanoBananaStatusMock).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onPollingOutputLookupHardStop).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-gone",
        taskId: "task-hard-stop",
        provider: "fal-nano-banana-2",
      })
    );
  });

  it("recovers from transient output lookup misses and resumes polling", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-transient", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(4_500);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-transient",
        provider: "fal-nano-banana-2",
        resultUrls: ["https://cdn.test/transient-recovery.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/transient-recovery.png");
  });

  it("keeps polling alive after extended output lookup misses and resumes when output returns", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValueOnce(
      asFalNanoBananaStatusResponse({
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
      result.current.startPollingTask("task-extended", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(13_000);
    await flushQueuedOutputUpdates();

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(onGenerationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-1",
        taskId: "task-extended",
        provider: "fal-nano-banana-2",
        resultUrls: ["https://cdn.test/extended-recovery.png"],
      })
    );
    expect(output.taskState).toBe("success");
    expect(output.previewUrl).toBe("https://cdn.test/extended-recovery.png");
  });

  it("resets an existing timer before restarting polling for the same output", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValue({
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
      result.current.startPollingTask("task-dup", "out-1", 0, "fal-nano-banana-2");
      result.current.startPollingTask("task-dup", "out-1", 0, "fal-nano-banana-2");
    });

    await vi.advanceTimersByTimeAsync(2_300);
    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);
  });

  it("allows four fresh status polls before deferring the fifth for concurrency backpressure", async () => {
    const deferreds = Array.from({ length: MAX_CONCURRENT_STATUS_REQUESTS + 1 }, () =>
      createDeferred<FalStatusResponse>()
    );
    let callIndex = 0;
    fetchFalNanoBananaStatusMock.mockImplementation(() => {
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
        result.current.startPollingTask(
          `task-${index + 1}`,
          `out-${index + 1}`,
          0,
          "fal-nano-banana-2"
        );
      });
    });

    await vi.advanceTimersByTimeAsync(2_300);

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(MAX_CONCURRENT_STATUS_REQUESTS);

    deferreds.slice(0, MAX_CONCURRENT_STATUS_REQUESTS).forEach((deferred, index) =>
      deferred.resolve(
        asFalNanoBananaStatusResponse({
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

    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(MAX_CONCURRENT_STATUS_REQUESTS + 1);

    deferreds[MAX_CONCURRENT_STATUS_REQUESTS]?.resolve(
      asFalNanoBananaStatusResponse({
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
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await flushQueuedOutputUpdates();

    expect(onGenerationSuccess).toHaveBeenCalledTimes(MAX_CONCURRENT_STATUS_REQUESTS + 1);
  });

  it("keeps direct polling alive across repeated no-media terminal responses", async () => {
    fetchFalNanoBananaStatusMock.mockResolvedValue({ status: "completed" });

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
      result.current.startPollingTask(
        "task-no-media-tail",
        "out-1",
        0,
        "fal-nano-banana-2",
        Date.now(),
        20
      );
    });

    await vi.advanceTimersByTimeAsync(1_250);
    await flushQueuedOutputUpdates();
    expect(fetchFalNanoBananaStatusMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();
    expect(fetchFalNanoBananaStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();
    expect(fetchFalNanoBananaStatusMock.mock.calls.length).toBeGreaterThanOrEqual(3);

    await vi.advanceTimersByTimeAsync(4_600);
    await flushQueuedOutputUpdates();
    expect(fetchFalNanoBananaStatusMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

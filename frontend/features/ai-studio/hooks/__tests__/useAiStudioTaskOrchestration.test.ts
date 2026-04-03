import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioTaskOrchestration } from "../useAiStudioTaskOrchestration";
import { useAiStudioTaskSubmission } from "../useAiStudioTaskSubmission";
import { useAiStudioTasks } from "../useAiStudioTasks";
import { fetchFalQueueStatus } from "../../../../lib/falClient";

vi.mock("../useAiStudioTaskSubmission", () => ({
  useAiStudioTaskSubmission: vi.fn(),
}));

vi.mock("../useAiStudioTasks", () => ({
  useAiStudioTasks: vi.fn(),
}));

vi.mock("../../../../lib/falClient", () => ({
  fetchFalQueueStatus: vi.fn(),
}));

const asDispatch = <T>(fn: (value: SetStateAction<T>) => void): Dispatch<SetStateAction<T>> =>
  fn as Dispatch<SetStateAction<T>>;

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Model",
  modelId: "model-id",
  status: "ready",
  timestamp: "Now",
  saveState: "idle",
  saveError: null,
  ...overrides,
});

type TasksCallbacks = Parameters<typeof useAiStudioTasks>[0];

describe("useAiStudioTaskOrchestration", () => {
  const useAiStudioTaskSubmissionMock = vi.mocked(useAiStudioTaskSubmission);
  const useAiStudioTasksMock = vi.mocked(useAiStudioTasks);
  const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);

  let capturedTaskCallbacks: TasksCallbacks | null;
  let startPollingTask: ReturnType<typeof vi.fn>;
  let clearPollTimer: ReturnType<typeof vi.fn>;
  let pollTimersRef: { current: Record<string, number> };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedTaskCallbacks = null;
    startPollingTask = vi.fn();
    clearPollTimer = vi.fn();
    pollTimersRef = { current: {} };

    useAiStudioTaskSubmissionMock.mockReturnValue(vi.fn());
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "queued",
      generationId: "gen-1",
      sourceRef: null,
      retryAfterMs: 2000,
    });
    useAiStudioTasksMock.mockImplementation(((callbacks: TasksCallbacks) => {
      capturedTaskCallbacks = callbacks;
      return {
        startPollingTask,
        clearPollTimer,
        pollTimersRef,
      };
    }) as typeof useAiStudioTasks);
  });

  it("applies Bria remove-background success to primary reference and clears hidden output", async () => {
    let outputs = [
      createOutput({
        id: "out-1",
        taskId: "task-1",
        modelId: "fal-ai/bria/background/remove",
        hiddenInReferenceGrid: true,
      }),
    ];
    const updateOutputById = vi.fn();
    const setUiNotice = vi.fn();
    const setPrimaryEditReferenceImageUrl = vi.fn();
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(setUiNotice),
          setOutputs: asDispatch<StudioOutput[]>(setOutputs),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        setPrimaryEditReferenceImageUrl,
      })
    );

    expect(capturedTaskCallbacks?.onGenerationSuccess).toBeDefined();
    expect(capturedTaskCallbacks?.onGenerationFailure).toBeDefined();

    await act(async () => {
      capturedTaskCallbacks?.onGenerationSuccess?.({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal-bria-background-remove",
        resultUrls: ["https://cdn.test/bria-result.png"],
      });
    });

    expect(setPrimaryEditReferenceImageUrl).toHaveBeenCalledWith(
      "https://cdn.test/bria-result.png"
    );
    expect(outputs).toEqual([]);
    expect(updateOutputById).not.toHaveBeenCalled();
  });

  it("does not treat hidden non-Bria image success as primary-reference replacement", async () => {
    let outputs = [
      createOutput({
        id: "out-1",
        taskId: "task-1",
        modelId: "fal-ai/nano-banana-pro/edit",
        hiddenInReferenceGrid: true,
      }),
    ];
    const updateOutputById = vi.fn();
    const setPrimaryEditReferenceImageUrl = vi.fn();
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "edit",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(setOutputs),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        setPrimaryEditReferenceImageUrl,
      })
    );

    await act(async () => {
      capturedTaskCallbacks?.onGenerationSuccess?.({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal-nano-banana-pro-edit",
        resultUrls: ["https://cdn.test/edit-result.png"],
      });
    });

    expect(setPrimaryEditReferenceImageUrl).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
    expect(updateOutputById).not.toHaveBeenCalled();
  });

  it("does not clear hidden non-Bria outputs on generation failure", async () => {
    let outputs = [
      createOutput({
        id: "out-1",
        taskId: "task-1",
        modelId: "fal-ai/nano-banana-pro/edit",
        hiddenInReferenceGrid: true,
      }),
    ];
    const setPrimaryEditReferenceImageUrl = vi.fn();
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "edit",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(setOutputs),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById: vi.fn(),
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        setPrimaryEditReferenceImageUrl,
      })
    );

    await act(async () => {
      capturedTaskCallbacks?.onGenerationFailure?.({
        outputId: "out-1",
        provider: "fal",
        message: "Generation failed",
      });
    });

    expect(setPrimaryEditReferenceImageUrl).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
  });

  it("ignores success callbacks for outputs that are not hidden replacement runs", async () => {
    let outputs = [createOutput({ id: "out-1", taskId: "task-1", modelId: "fal-ai/nano-banana" })];
    const setPrimaryEditReferenceImageUrl = vi.fn();
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(setOutputs),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById: vi.fn(),
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        setPrimaryEditReferenceImageUrl,
      })
    );

    await act(async () => {
      capturedTaskCallbacks?.onGenerationSuccess?.({
        outputId: "out-1",
        taskId: "task-1",
        provider: "fal-nano-banana",
        resultUrls: ["https://cdn.test/not-used.png"],
      });
    });

    expect(setPrimaryEditReferenceImageUrl).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
  });

  it("no-ops client persistence when polling hard-stop callback fires", async () => {
    const outputs = [
      createOutput({ id: "out-1", taskId: "task-123", provider: "fal", generationId: "gen-1" }),
    ];
    const updateOutputById = vi.fn();

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await capturedTaskCallbacks?.onPollingOutputLookupHardStop?.({
        outputId: "out-1",
        taskId: "task-123",
        provider: "fal",
        lookupMisses: 42,
        missingDurationMs: 301_000,
      });
    });

    expect(updateOutputById).not.toHaveBeenCalled();
  });

  it("shows a notice and skips poll restart when task id is missing", () => {
    const outputs = [createOutput({ id: "out-1", taskId: "" })];
    const updateOutputById = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(setUiNotice),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    act(() => {
      result.current.retryOutputStatus("out-1");
    });

    expect(setUiNotice).toHaveBeenCalledWith(
      "Unable to retry status because this generation has no task id."
    );
    expect(startPollingTask).not.toHaveBeenCalled();
    expect(updateOutputById).not.toHaveBeenCalled();
  });

  it("restarts polling and clears error fields for retry", () => {
    let outputs = [createOutput({ id: "out-1", taskId: " task-123 ", provider: "fal" })];

    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });

    const { result } = renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    act(() => {
      result.current.retryOutputStatus("out-1");
    });

    expect(clearPollTimer).toHaveBeenCalledWith("out-1");
    expect(startPollingTask).toHaveBeenCalledWith("task-123", "out-1", 0, "fal");
    expect(outputs[0]?.taskState).toBe("running");
    expect(outputs[0]?.timestamp).toBe("Retrying status...");
    expect(outputs[0]?.errorMessage).toBeNull();
  });

  it("auto-retries stuck spinner outputs when task exists but no poll timer is active", () => {
    vi.useFakeTimers();
    try {
      let outputs = [
        createOutput({ id: "out-1", taskId: "task-123", provider: "fal", taskState: "running" }),
      ];
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );

      renderHook(() =>
        useAiStudioTaskOrchestration({
          taskSubmissionConfig: {
            aspect: "9:16",
            mode: "image",
            model: "model-id",
            prompt: "Prompt",
            selectedTool: "create",
            imageResolution: "model_default",
            videoDurationSeconds: 6,
            videoResolution: "1080p",
            videoGenerateAudio: false,
            videoReferenceMode: "standard",
            videoReferenceImageUrl: null,
            motionReferenceVideoUrl: null,
            videoCameraFixed: false,
            videoAutoFix: false,
            klingNegativePrompt: "blur",
            klingCfgScale: 0.5,
            klingShotType: "customize",
            klingVoiceIds: ["", ""],
            klingMultiPrompts: [],
            klingElements: [],
            setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
            setUiError: asDispatch<string | null>(vi.fn()),
            setUiNotice: asDispatch<string | null>(vi.fn()),
            setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
            setSaved: asDispatch<boolean>(vi.fn()),
            getDefaultDurationSeconds: vi.fn(() => 6),
            notifyGenerationFailure: vi.fn(),
            updateOutputById,
            ensureGenerationRecord: vi.fn(async () => null),
          },
          outputs,
          findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        })
      );

      act(() => {
        vi.advanceTimersByTime(90_000);
      });

      expect(clearPollTimer).toHaveBeenCalledWith("out-1");
      expect(startPollingTask).toHaveBeenCalledWith("task-123", "out-1", 0, "fal");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not auto-retry while poll timer is already active", () => {
    vi.useFakeTimers();
    try {
      const outputs = [
        createOutput({ id: "out-1", taskId: "task-123", provider: "fal", taskState: "running" }),
      ];
      pollTimersRef.current["out-1"] = 123;

      renderHook(() =>
        useAiStudioTaskOrchestration({
          taskSubmissionConfig: {
            aspect: "9:16",
            mode: "image",
            model: "model-id",
            prompt: "Prompt",
            selectedTool: "create",
            imageResolution: "model_default",
            videoDurationSeconds: 6,
            videoResolution: "1080p",
            videoGenerateAudio: false,
            videoReferenceMode: "standard",
            videoReferenceImageUrl: null,
            motionReferenceVideoUrl: null,
            videoCameraFixed: false,
            videoAutoFix: false,
            klingNegativePrompt: "blur",
            klingCfgScale: 0.5,
            klingShotType: "customize",
            klingVoiceIds: ["", ""],
            klingMultiPrompts: [],
            klingElements: [],
            setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
            setUiError: asDispatch<string | null>(vi.fn()),
            setUiNotice: asDispatch<string | null>(vi.fn()),
            setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
            setSaved: asDispatch<boolean>(vi.fn()),
            getDefaultDurationSeconds: vi.fn(() => 6),
            notifyGenerationFailure: vi.fn(),
            updateOutputById: vi.fn(),
            ensureGenerationRecord: vi.fn(async () => null),
          },
          outputs,
          findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        })
      );

      act(() => {
        vi.advanceTimersByTime(4 * 60 * 1000);
      });

      expect(clearPollTimer).not.toHaveBeenCalled();
      expect(startPollingTask).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not auto-retry outputs that already failed with terminal no-media state", () => {
    vi.useFakeTimers();
    try {
      const outputs = [
        createOutput({
          id: "out-no-media",
          taskId: "task-456",
          provider: "fal",
          taskState: "fail",
          errorMessageShort: "No media returned.",
          previewUrl: undefined,
          previewText: undefined,
        }),
      ];

      renderHook(() =>
        useAiStudioTaskOrchestration({
          taskSubmissionConfig: {
            aspect: "9:16",
            mode: "image",
            model: "model-id",
            prompt: "Prompt",
            selectedTool: "create",
            imageResolution: "model_default",
            videoDurationSeconds: 6,
            videoResolution: "1080p",
            videoGenerateAudio: false,
            videoReferenceMode: "standard",
            videoReferenceImageUrl: null,
            motionReferenceVideoUrl: null,
            videoCameraFixed: false,
            videoAutoFix: false,
            klingNegativePrompt: "blur",
            klingCfgScale: 0.5,
            klingShotType: "customize",
            klingVoiceIds: ["", ""],
            klingMultiPrompts: [],
            klingElements: [],
            setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
            setUiError: asDispatch<string | null>(vi.fn()),
            setUiNotice: asDispatch<string | null>(vi.fn()),
            setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
            setSaved: asDispatch<boolean>(vi.fn()),
            getDefaultDurationSeconds: vi.fn(() => 6),
            notifyGenerationFailure: vi.fn(),
            updateOutputById: vi.fn(),
            ensureGenerationRecord: vi.fn(async () => null),
          },
          outputs,
          findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        })
      );

      act(() => {
        vi.advanceTimersByTime(4 * 60 * 1000);
      });

      expect(clearPollTimer).not.toHaveBeenCalled();
      expect(startPollingTask).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes queued output polling when queue-status reports dispatched", async () => {
    let outputs = [
      createOutput({
        id: "out-queued",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        generationId: "gen-1",
        queueState: "queued",
        taskState: "pending",
        provider: "fal",
      }),
    ];
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "dispatched",
      generationId: "gen-1",
      sourceRef: "source-1",
      requestId: "req-queued-1",
      provider: "fal",
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure,
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
      generationId: "gen-1",
    });
    expect(clearPollTimer).toHaveBeenCalledWith("out-queued");
    expect(startPollingTask).toHaveBeenCalledWith("req-queued-1", "out-queued", 0, "fal-seedream");
    expect(outputs[0]?.taskId).toBe("req-queued-1");
    expect(outputs[0]?.queueState).toBe("dispatched");
    expect(outputs[0]?.taskState).toBe("running");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });

  it("backfills generation id during queue resume dispatch when output lost it", async () => {
    let outputs = [
      createOutput({
        id: "out-queued-missing-gen",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        generationId: "gen-resume-1",
        queueState: "queued",
        taskState: "pending",
        provider: "fal",
      }),
    ];
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) =>
        item.id === id ? updater({ ...item, generationId: undefined }) : item
      );
    });
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "dispatched",
      generationId: "gen-resume-1",
      sourceRef: "source-1",
      requestId: "req-queued-2",
      provider: "fal",
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure: vi.fn(),
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(outputs[0]?.generationId).toBe("gen-resume-1");
    expect(outputs[0]?.taskId).toBe("req-queued-2");
  });

  it("checks freshly queued outputs immediately so queued work can resume without waiting", async () => {
    vi.useFakeTimers();
    try {
      const nowMs = Date.now();
      let outputs = [
        createOutput({
          id: "out-queued-fresh",
          modelId: "fal-ai/bytedance/seedream/v4.5/edit",
          generationId: "gen-fresh",
          queueState: "queued",
          queueEnqueuedAtMs: nowMs,
          taskState: "pending",
          provider: "fal",
        }),
      ];
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );
      const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
      fetchFalQueueStatusMock.mockResolvedValue({
        status: "queued",
        generationId: "gen-fresh",
        sourceRef: "source-fresh",
        retryAfterMs: 2_000,
        shortpulseLifecycle: {
          taskState: "pending",
          queueState: "queued",
          isTerminal: false,
        },
      });

      renderHook(() =>
        useAiStudioTaskOrchestration({
          taskSubmissionConfig: {
            aspect: "9:16",
            mode: "image",
            model: "model-id",
            prompt: "Prompt",
            selectedTool: "create",
            imageResolution: "model_default",
            videoDurationSeconds: 6,
            videoResolution: "1080p",
            videoGenerateAudio: false,
            videoReferenceMode: "standard",
            videoReferenceImageUrl: null,
            motionReferenceVideoUrl: null,
            videoCameraFixed: false,
            videoAutoFix: false,
            klingNegativePrompt: "blur",
            klingCfgScale: 0.5,
            klingShotType: "customize",
            klingVoiceIds: ["", ""],
            klingMultiPrompts: [],
            klingElements: [],
            setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
            setUiError: asDispatch<string | null>(vi.fn()),
            setUiNotice: asDispatch<string | null>(vi.fn()),
            setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
            setSaved: asDispatch<boolean>(vi.fn()),
            getDefaultDurationSeconds: vi.fn(() => 6),
            notifyGenerationFailure: vi.fn(),
            updateOutputById,
            ensureGenerationRecord: vi.fn(async () => null),
          },
          outputs,
          findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        })
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
        generationId: "gen-fresh",
      });
      expect(fetchFalQueueStatusMock).toHaveBeenCalledTimes(1);
      expect(outputs[0]?.queueState).toBe("queued");
      expect(outputs[0]?.taskState).toBe("pending");
      expect(outputs[0]?.timestamp).toBe("Waiting in queue...");
    } finally {
      vi.useRealTimers();
    }
  });

  it("checks newly restored queue candidates immediately when outputs hydrate after mount", async () => {
    let outputs: StudioOutput[] = [];
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "queued",
      generationId: "gen-restored-after-mount",
      sourceRef: "source-restored-after-mount",
      retryAfterMs: 2_000,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
      },
    });

    const props = {
      taskSubmissionConfig: {
        aspect: "9:16",
        mode: "image" as const,
        model: "model-id",
        prompt: "Prompt",
        selectedTool: "create" as const,
        imageResolution: "model_default",
        videoDurationSeconds: 6,
        videoResolution: "1080p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard" as const,
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur",
        klingCfgScale: 0.5,
        klingShotType: "customize" as const,
        klingVoiceIds: ["", ""] as [string, string],
        klingMultiPrompts: [],
        klingElements: [],
        setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
        setUiError: asDispatch<string | null>(vi.fn()),
        setUiNotice: asDispatch<string | null>(vi.fn()),
        setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
        setSaved: asDispatch<boolean>(vi.fn()),
        getDefaultDurationSeconds: vi.fn(() => 6),
        notifyGenerationFailure: vi.fn(),
        updateOutputById,
        ensureGenerationRecord: vi.fn(async () => null),
      },
      outputs,
      findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
    };

    const { rerender } = renderHook(
      (hookProps: typeof props) => useAiStudioTaskOrchestration(hookProps),
      {
        initialProps: props,
      }
    );

    expect(fetchFalQueueStatusMock).not.toHaveBeenCalled();

    outputs = [
      createOutput({
        id: "out-restored-after-mount",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        generationId: "gen-restored-after-mount",
        queueState: "queued",
        taskState: "pending",
        provider: "fal",
      }),
    ];

    await act(async () => {
      rerender({
        ...props,
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
      generationId: "gen-restored-after-mount",
    });
    expect(outputs[0]?.queueState).toBe("queued");
    expect(outputs[0]?.taskState).toBe("pending");
    expect(outputs[0]?.timestamp).toBe("Waiting in queue...");
  });

  it("resumes queued output polling when generation id exists but queueState is missing", async () => {
    let outputs = [
      createOutput({
        id: "out-queued-metadata-missing",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        generationId: "gen-missing-queue-state",
        taskState: "pending",
        provider: "fal",
      }),
    ];
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "dispatched",
      generationId: "gen-missing-queue-state",
      sourceRef: "source-missing-queue-state",
      requestId: "req-missing-queue-state",
      provider: "fal",
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure,
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
      generationId: "gen-missing-queue-state",
    });
    expect(clearPollTimer).toHaveBeenCalledWith("out-queued-metadata-missing");
    expect(startPollingTask).toHaveBeenCalledWith(
      "req-missing-queue-state",
      "out-queued-metadata-missing",
      0,
      "fal-seedream"
    );
    expect(outputs[0]?.taskId).toBe("req-missing-queue-state");
    expect(outputs[0]?.queueState).toBe("dispatched");
    expect(outputs[0]?.taskState).toBe("running");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });

  it("treats restored dispatching outputs without task ids as queue-resume candidates", async () => {
    let outputs = [
      createOutput({
        id: "out-dispatching-restore",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        generationId: "gen-dispatching-restore",
        queueState: "dispatching",
        taskState: "running",
        provider: "fal",
      }),
    ];
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "dispatched",
      generationId: "gen-dispatching-restore",
      sourceRef: "source-dispatching-restore",
      requestId: "req-dispatching-restore",
      provider: "fal",
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure,
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
      generationId: "gen-dispatching-restore",
      sourceRef: undefined,
    });
    expect(startPollingTask).toHaveBeenCalledWith(
      "req-dispatching-restore",
      "out-dispatching-restore",
      0,
      "fal-seedream"
    );
    expect(outputs[0]?.taskId).toBe("req-dispatching-restore");
    expect(outputs[0]?.queueState).toBe("dispatched");
    expect(outputs[0]?.taskState).toBe("running");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });

  it("resumes queued output polling from sourceRef when generation id is missing", async () => {
    let outputs = [
      createOutput({
        id: "out-queued-source-ref-only",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        sourceRef: "source-ref-only",
        queueState: "queued",
        taskState: "pending",
        provider: "fal",
      }),
    ];
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "dispatched",
      generationId: "gen-source-ref-only",
      sourceRef: "source-ref-only",
      requestId: "req-source-ref-only",
      provider: "fal",
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure,
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
      generationId: undefined,
      sourceRef: "source-ref-only",
    });
    expect(clearPollTimer).toHaveBeenCalledWith("out-queued-source-ref-only");
    expect(startPollingTask).toHaveBeenCalledWith(
      "req-source-ref-only",
      "out-queued-source-ref-only",
      0,
      "fal-seedream"
    );
    expect(outputs[0]?.generationId).toBe("gen-source-ref-only");
    expect(outputs[0]?.taskId).toBe("req-source-ref-only");
    expect(outputs[0]?.sourceRef).toBe("source-ref-only");
    expect(outputs[0]?.queueState).toBe("dispatched");
    expect(outputs[0]?.taskState).toBe("running");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });
  it("resumes queued output polling when queueState is dispatched but task id is missing", async () => {
    let outputs = [
      createOutput({
        id: "out-dispatched-metadata-missing-task-id",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        generationId: "gen-dispatched-missing-task-id",
        queueState: "dispatched",
        taskState: "running",
        provider: "fal",
      }),
    ];
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "dispatched",
      generationId: "gen-dispatched-missing-task-id",
      sourceRef: "source-dispatched-missing-task-id",
      requestId: "req-dispatched-missing-task-id",
      provider: "fal",
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure,
          updateOutputById,
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchFalQueueStatusMock).toHaveBeenCalledWith({
      generationId: "gen-dispatched-missing-task-id",
    });
    expect(clearPollTimer).toHaveBeenCalledWith("out-dispatched-metadata-missing-task-id");
    expect(startPollingTask).toHaveBeenCalledWith(
      "req-dispatched-missing-task-id",
      "out-dispatched-metadata-missing-task-id",
      0,
      "fal-seedream"
    );
    expect(outputs[0]?.taskId).toBe("req-dispatched-missing-task-id");
    expect(outputs[0]?.queueState).toBe("dispatched");
    expect(outputs[0]?.taskState).toBe("running");
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });

  it("hands queued output failure off to server recovery when queue-status reports failure", async () => {
    const notifyGenerationFailure = vi.fn();
    let outputs = [
      createOutput({
        id: "out-queued",
        generationId: "gen-1",
        queueState: "queued",
        taskState: "fail",
        errorMessage: "Old browser failure",
        provider: "fal",
      }),
    ];
    const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
    fetchFalQueueStatusMock.mockResolvedValue({
      status: "failed",
      generationId: "gen-1",
      sourceRef: "source-1",
      message: "Queue exhausted",
    });

    renderHook(() =>
      useAiStudioTaskOrchestration({
        taskSubmissionConfig: {
          aspect: "9:16",
          mode: "image",
          model: "model-id",
          prompt: "Prompt",
          selectedTool: "create",
          imageResolution: "model_default",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
          setUiError: asDispatch<string | null>(vi.fn()),
          setUiNotice: asDispatch<string | null>(vi.fn()),
          setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
          setSaved: asDispatch<boolean>(vi.fn()),
          getDefaultDurationSeconds: vi.fn(() => 6),
          notifyGenerationFailure,
          updateOutputById: vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
            outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
          }),
          ensureGenerationRecord: vi.fn(async () => null),
        },
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startPollingTask).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(outputs[0]?.taskState).toBe("pending");
    expect(outputs[0]?.timestamp).toBe("Waiting for server recovery...");
    expect(outputs[0]?.errorMessage).toBeNull();
  });

  it("does not queue-resume restored outputs that already have settled media", async () => {
    vi.useFakeTimers();
    try {
      const notifyGenerationFailure = vi.fn();
      const updateOutputById = vi.fn();
      const outputs = [
        createOutput({
          id: "out-settled-restore",
          generationId: "gen-settled-restore",
          queueState: "dispatched",
          taskState: "success",
          resultUrls: ["https://cdn.test/result.png"],
          provider: "fal",
        }),
      ];
      const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);

      renderHook(() =>
        useAiStudioTaskOrchestration({
          taskSubmissionConfig: {
            aspect: "9:16",
            mode: "image",
            model: "model-id",
            prompt: "Prompt",
            selectedTool: "create",
            imageResolution: "model_default",
            videoDurationSeconds: 6,
            videoResolution: "1080p",
            videoGenerateAudio: false,
            videoReferenceMode: "standard",
            videoReferenceImageUrl: null,
            motionReferenceVideoUrl: null,
            videoCameraFixed: false,
            videoAutoFix: false,
            klingNegativePrompt: "blur",
            klingCfgScale: 0.5,
            klingShotType: "customize",
            klingVoiceIds: ["", ""],
            klingMultiPrompts: [],
            klingElements: [],
            setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
            setUiError: asDispatch<string | null>(vi.fn()),
            setUiNotice: asDispatch<string | null>(vi.fn()),
            setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
            setSaved: asDispatch<boolean>(vi.fn()),
            getDefaultDurationSeconds: vi.fn(() => 6),
            notifyGenerationFailure,
            updateOutputById,
            ensureGenerationRecord: vi.fn(async () => null),
          },
          outputs,
          findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        })
      );

      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(25_000);
      });

      expect(fetchFalQueueStatusMock).not.toHaveBeenCalled();
      expect(startPollingTask).not.toHaveBeenCalled();
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
      expect(updateOutputById).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps queued resume best-effort when queue-status remains not_found before the age gate", async () => {
    vi.useFakeTimers();
    try {
      const notifyGenerationFailure = vi.fn();
      const updateOutputById = vi.fn();
      const nowMs = Date.now();
      const outputs = [
        createOutput({
          id: "out-queued",
          generationId: "gen-1",
          queueState: "queued",
          queueEnqueuedAtMs: nowMs,
          taskState: "pending",
          provider: "fal",
        }),
      ];
      const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
      fetchFalQueueStatusMock.mockResolvedValue({
        status: "not_found",
      });

      renderHook(() =>
        useAiStudioTaskOrchestration({
          taskSubmissionConfig: {
            aspect: "9:16",
            mode: "image",
            model: "model-id",
            prompt: "Prompt",
            selectedTool: "create",
            imageResolution: "model_default",
            videoDurationSeconds: 6,
            videoResolution: "1080p",
            videoGenerateAudio: false,
            videoReferenceMode: "standard",
            videoReferenceImageUrl: null,
            motionReferenceVideoUrl: null,
            videoCameraFixed: false,
            videoAutoFix: false,
            klingNegativePrompt: "blur",
            klingCfgScale: 0.5,
            klingShotType: "customize",
            klingVoiceIds: ["", ""],
            klingMultiPrompts: [],
            klingElements: [],
            setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
            setUiError: asDispatch<string | null>(vi.fn()),
            setUiNotice: asDispatch<string | null>(vi.fn()),
            setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
            setSaved: asDispatch<boolean>(vi.fn()),
            getDefaultDurationSeconds: vi.fn(() => 6),
            notifyGenerationFailure,
            updateOutputById,
            ensureGenerationRecord: vi.fn(async () => null),
          },
          outputs,
          findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
        })
      );

      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(90_000);
      });

      expect(fetchFalQueueStatusMock).toHaveBeenCalled();
      expect(notifyGenerationFailure).toHaveBeenCalledWith(
        "out-queued",
        "Queued generation could not be resumed. Please retry.",
        "Generation queue status remained unresolved while waiting for dispatch."
      );
      expect(updateOutputById).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks queued resume recovery pending after bounded not_found age and retries", async () => {
    vi.useFakeTimers();
    try {
      const notifyGenerationFailure = vi.fn();
      let output = createOutput({
        id: "out-queued",
        generationId: "gen-1",
        queueState: "queued",
        queueEnqueuedAtMs: Date.now(),
        taskState: "pending",
        provider: "fal",
      });
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          if (id === output.id) {
            output = updater(output);
          }
        }
      );
      const outputs = [output];
      const fetchFalQueueStatusMock = vi.mocked(fetchFalQueueStatus);
      fetchFalQueueStatusMock.mockResolvedValue({
        status: "not_found",
      });

      renderHook(() =>
        useAiStudioTaskOrchestration({
          taskSubmissionConfig: {
            aspect: "9:16",
            mode: "image",
            model: "model-id",
            prompt: "Prompt",
            selectedTool: "create",
            imageResolution: "model_default",
            videoDurationSeconds: 6,
            videoResolution: "1080p",
            videoGenerateAudio: false,
            videoReferenceMode: "standard",
            videoReferenceImageUrl: null,
            motionReferenceVideoUrl: null,
            videoCameraFixed: false,
            videoAutoFix: false,
            klingNegativePrompt: "blur",
            klingCfgScale: 0.5,
            klingShotType: "customize",
            klingVoiceIds: ["", ""],
            klingMultiPrompts: [],
            klingElements: [],
            setIsPromptGenerating: asDispatch<boolean>(vi.fn()),
            setUiError: asDispatch<string | null>(vi.fn()),
            setUiNotice: asDispatch<string | null>(vi.fn()),
            setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
            setSaved: asDispatch<boolean>(vi.fn()),
            getDefaultDurationSeconds: vi.fn(() => 6),
            notifyGenerationFailure,
            updateOutputById,
            ensureGenerationRecord: vi.fn(async () => null),
          },
          outputs,
          findOutputById: (id: string) => (id === output.id ? output : null),
        })
      );

      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150_000);
      });

      expect(fetchFalQueueStatusMock).toHaveBeenCalled();
      expect(notifyGenerationFailure).not.toHaveBeenCalled();
      expect(updateOutputById).toHaveBeenCalled();
      expect(output.taskState).toBe("pending");
      expect(output.timestamp).toBe("Waiting for server recovery...");
    } finally {
      vi.useRealTimers();
    }
  });
});

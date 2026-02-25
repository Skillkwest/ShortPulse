import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioTaskOrchestration } from "../useAiStudioTaskOrchestration";
import { useAiStudioTaskSubmission } from "../useAiStudioTaskSubmission";
import { useAiStudioTasks } from "../useAiStudioTasks";

vi.mock("../useAiStudioTaskSubmission", () => ({
  useAiStudioTaskSubmission: vi.fn(),
}));

vi.mock("../useAiStudioTasks", () => ({
  useAiStudioTasks: vi.fn(),
}));

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

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
    useAiStudioTasksMock.mockImplementation(((callbacks: TasksCallbacks) => {
      capturedTaskCallbacks = callbacks;
      return {
        startPollingTask,
        clearPollTimer,
        pollTimersRef,
      };
    }) as typeof useAiStudioTasks);
  });

  it("does not wire generation success into auto-persistence", async () => {
    const outputs = [createOutput({ id: "out-1", taskId: "task-1" })];
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
        outputs,
        findOutputById: (id: string) => outputs.find((item) => item.id === id) ?? null,
      })
    );

    expect(capturedTaskCallbacks?.onGenerationSuccess).toBeUndefined();
    expect(capturedTaskCallbacks?.onGenerationFailure).toBeUndefined();

    await act(async () => {
      await result.current.onReferenceOutputMediaLoaded("out-1");
    });
    expect(updateOutputById).not.toHaveBeenCalled();
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
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioTaskOrchestration } from "../useAiStudioTaskOrchestration";
import { useAiStudioTaskSubmission } from "../useAiStudioTaskSubmission";
import { useAiStudioTasks } from "../useAiStudioTasks";
import {
  resolveGenerationProjectionLifecycle,
  resolveVisibleGenerationReconcile,
} from "../../logic/generatedMediaAuthority";

vi.mock("../useAiStudioTaskSubmission", () => ({
  useAiStudioTaskSubmission: vi.fn(),
}));

vi.mock("../useAiStudioTasks", () => ({
  useAiStudioTasks: vi.fn(),
}));

vi.mock("../../logic/generatedMediaAuthority", () => ({
  resolveGenerationProjectionLifecycle: vi.fn(),
  resolveVisibleGenerationReconcile: vi.fn(),
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
  const resolveGenerationProjectionLifecycleMock = vi.mocked(resolveGenerationProjectionLifecycle);
  const resolveVisibleGenerationReconcileMock = vi.mocked(resolveVisibleGenerationReconcile);

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
    resolveGenerationProjectionLifecycleMock.mockResolvedValue(null);
    resolveVisibleGenerationReconcileMock.mockResolvedValue(null);
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
    let outputs = [
      createOutput({ id: "out-1", taskId: "task-1", modelId: "fal-ai/nano-banana-2" }),
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
        provider: "fal-nano-banana-2",
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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

  it("restarts polling through the model-specific route and clears error fields for retry", () => {
    let outputs = [
      createOutput({
        id: "out-1",
        taskId: " task-123 ",
        provider: "fal",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      }),
    ];

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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
    expect(startPollingTask).toHaveBeenCalledWith("task-123", "out-1", 0, "fal-seedream-edit");
    expect(outputs[0]?.taskState).toBe("running");
    expect(outputs[0]?.timestamp).toBe("Retrying status...");
    expect(outputs[0]?.errorMessage).toBeNull();
  });

  it("does not retry status through retired generic Fal polling", () => {
    const outputs = [createOutput({ id: "out-1", taskId: " task-123 ", provider: "fal" })];
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
      "Unable to retry status because this generation has no active polling route."
    );
    expect(clearPollTimer).not.toHaveBeenCalled();
    expect(startPollingTask).not.toHaveBeenCalled();
    expect(updateOutputById).not.toHaveBeenCalled();
  });

  it("resumes task-backed outputs from the browser watchdog when no poll timer exists", async () => {
    const outputs = [
      createOutput({
        id: "out-task-resume",
        taskId: "req-task-resume",
        provider: "fal",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        taskState: "running",
        timestamp: "Waiting for server recovery...",
        mediaSource: "generated",
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearPollTimer).not.toHaveBeenCalledWith("out-task-resume");
    expect(startPollingTask).toHaveBeenCalledWith(
      "req-task-resume",
      "out-task-resume",
      0,
      expect.anything()
    );
  });

  it("still does not restart task-backed polling when an active poll timer already exists", async () => {
    pollTimersRef.current["out-task-active"] = 123;
    const outputs = [
      createOutput({
        id: "out-task-active",
        taskId: "req-task-active",
        provider: "fal",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        taskState: "running",
        mediaSource: "generated",
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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearPollTimer).not.toHaveBeenCalledWith("out-task-active");
    expect(startPollingTask).not.toHaveBeenCalledWith(
      "req-task-active",
      "out-task-active",
      0,
      expect.anything()
    );
  });

  it("does not restart watchdog polling after an output is abandoned", async () => {
    const outputs = [
      createOutput({
        id: "out-abandoned",
        taskId: "req-abandoned",
        provider: "fal",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        taskState: "running",
        mediaSource: "generated",
      }),
    ];

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
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
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
      result.current.abandonTaskOutput("out-abandoned");
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearPollTimer).toHaveBeenCalledWith("out-abandoned");
    expect(startPollingTask).not.toHaveBeenCalledWith(
      "req-abandoned",
      "out-abandoned",
      0,
      expect.anything()
    );
  });

  it("hides in-flight generated outputs when projection marks them hidden terminal failures", async () => {
    vi.useFakeTimers();
    try {
      let outputs = [
        createOutput({
          id: "out-hidden-fail",
          generationId: "gen-hidden-fail",
          taskId: "req-hidden-fail",
          provider: "fal",
          modelId: "fal-ai/nano-banana-pro/edit",
          taskState: "running",
          timestamp: "Processing...",
          mediaSource: "generated",
        }),
      ];
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );
      resolveGenerationProjectionLifecycleMock.mockResolvedValue({
        generationId: "gen-hidden-fail",
        taskState: "fail",
        queueState: undefined,
        hiddenInReferenceGrid: true,
        referenceGridVisible: false,
        errorMessageShort: "Generation abandoned by user.",
        errorDetail: "Generation abandoned by user.",
      });

      renderHook(() =>
        useAiStudioTaskOrchestration({
          projectId: "project-1",
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
            beginPanelGeneration: vi.fn(),
            endPanelGeneration: vi.fn(),
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

      expect(resolveGenerationProjectionLifecycleMock).toHaveBeenCalledWith({
        generationId: "gen-hidden-fail",
        requestId: "req-hidden-fail",
        projectId: "project-1",
      });
      expect(resolveVisibleGenerationReconcileMock).not.toHaveBeenCalled();
      expect(outputs[0]?.taskState).toBe("fail");
      expect(outputs[0]?.hiddenInReferenceGrid).toBe(true);
      expect(outputs[0]?.errorMessage).toBe("Generation abandoned by user.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("settles unresolved generated outputs from projection-backed delivery even without a task handoff", async () => {
    vi.useFakeTimers();
    try {
      let outputs = [
        createOutput({
          id: "out-projection-ready",
          generationId: "gen-projection-ready",
          provider: "fal",
          modelId: "fal-ai/nano-banana-2/edit",
          taskState: "running",
          timestamp: "Processing...",
          mediaSource: "generated",
          saveState: "blocked_storage",
          saveError:
            "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
        }),
      ];
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );
      resolveVisibleGenerationReconcileMock.mockResolvedValue({
        generationId: "gen-projection-ready",
        previewUrl: "https://cdn.test/projection-ready-preview.png",
        previewStoragePath: null,
        fullStoragePath: null,
        resultUrls: ["https://cdn.test/projection-ready-full.png"],
      });

      renderHook(() =>
        useAiStudioTaskOrchestration({
          projectId: "project-1",
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
            beginPanelGeneration: vi.fn(),
            endPanelGeneration: vi.fn(),
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

      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
        generationId: "gen-projection-ready",
        requestId: undefined,
        projectId: "project-1",
      });
      expect(outputs[0]?.taskState).toBe("success");
      expect(outputs[0]?.previewUrl).toBe("https://cdn.test/projection-ready-preview.png");
      expect(outputs[0]?.resultUrls).toEqual(["https://cdn.test/projection-ready-full.png"]);
      expect(outputs[0]?.saveState).toBe("saved");
      expect(outputs[0]?.saveError).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps in-flight generated outputs eligible for projection reconcile even when a preview URL already exists", async () => {
    vi.useFakeTimers();
    try {
      let outputs = [
        createOutput({
          id: "out-preview-running",
          generationId: "gen-preview-running",
          taskId: "req-preview-running",
          provider: "fal-flux-kontext-inpaint",
          modelId: "fal-ai/flux-kontext-lora/inpaint",
          taskState: "running",
          timestamp: "Processing...",
          mediaSource: "generated",
          previewUrl: "https://cdn.test/stale-preview.png",
        }),
      ];
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );
      resolveVisibleGenerationReconcileMock.mockResolvedValue({
        generationId: "gen-preview-running",
        previewUrl: "https://cdn.test/reconciled-preview.png",
        previewStoragePath: null,
        fullStoragePath: null,
        resultUrls: ["https://cdn.test/reconciled-full.png"],
      });

      renderHook(() =>
        useAiStudioTaskOrchestration({
          projectId: "project-1",
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
            beginPanelGeneration: vi.fn(),
            endPanelGeneration: vi.fn(),
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

      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
        generationId: "gen-preview-running",
        requestId: "req-preview-running",
        projectId: "project-1",
      });
      expect(outputs[0]?.taskState).toBe("success");
      expect(outputs[0]?.previewUrl).toBe("https://cdn.test/reconciled-preview.png");
      expect(outputs[0]?.resultUrls).toEqual(["https://cdn.test/reconciled-full.png"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

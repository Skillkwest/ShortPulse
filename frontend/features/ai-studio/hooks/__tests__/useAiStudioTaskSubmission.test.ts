import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { resolveModelLabel } from "../../logic/stateParsers";
import { useAiStudioTaskSubmission } from "../useAiStudioTaskSubmission";
import { resolvePrepareReferenceTimeoutBudget } from "../taskSubmission/preflightTimeout";
import { DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS } from "../useAiStudioTasks";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
import { AUTH_SESSION_TIMEOUT_CODE } from "../../../../lib/authenticatedFetch";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { REFERENCE_GRID_MAX_VISIBLE_ITEMS } from "../../reference-grid/logic/referenceGridLimits";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../../lib/model-runtime/falModelIds";
import { createReadyLipSyncAudioState } from "../../logic/lipSyncAudioState";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import {
  handleDefaultModelSubmission,
  handleImageModelSubmission,
  handleVideoModelSubmission,
  resolveSubmissionHandlerRoute,
} from "../taskSubmissionHandlers";

const reportAppErrorMock = vi.fn();

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: (...args: unknown[]) => reportAppErrorMock(...args),
}));

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../taskSubmissionHandlers", () => ({
  handleDefaultModelSubmission: vi.fn(),
  handleImageModelSubmission: vi.fn(),
  handleVideoModelSubmission: vi.fn(),
  resolveSubmissionHandlerRoute: vi.fn(() => "video"),
}));

vi.mock("../../utils/imageUpload", () => ({
  prepareImageUrlForSubmission: vi.fn(async (url: string) => url),
}));

const asDispatch = <T>(fn: (value: SetStateAction<T>) => void): Dispatch<SetStateAction<T>> =>
  fn as Dispatch<SetStateAction<T>>;

const createVisibleOutput = (id: string): StudioOutput =>
  ({
    id,
    prompt: id,
    mode: "image",
    aspect: "1:1",
    model: "Seedream",
    status: "ready",
    taskState: "success",
    timestamp: "Ready",
  }) as StudioOutput;

const createStatefulUpdateOutputById = (accessor: {
  get: () => StudioOutput[];
  set: (next: StudioOutput[]) => void;
}) =>
  vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
    accessor.set(accessor.get().map((item) => (item.id === id ? updater(item) : item)));
  });

describe("useAiStudioTaskSubmission", () => {
  const STRICT_EDIT_MODELS = [
    "fal-ai/nano-banana-2/edit",
    "fal-ai/nano-banana-2/edit",
    "fal-ai/nano-banana-pro/edit",
    "fal-ai/bytedance/seedream/v5/lite/edit",
    "fal-ai/bytedance/seedream/v4.5/edit",
    "custom/legacy-image",
  ] as const;

  const prepareImageUrlForSubmissionMock = vi.mocked(prepareImageUrlForSubmission);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("video");
    prepareImageUrlForSubmissionMock.mockImplementation(async (url: string | null) => url);
    vi.mocked(handleVideoModelSubmission).mockImplementation(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("video-req-1", "kie-veo");
        return true;
      }
    );
    vi.mocked(handleImageModelSubmission).mockImplementation(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("image-req-1", "fal-seedream");
        return true;
      }
    );
    vi.mocked(handleDefaultModelSubmission).mockImplementation(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("default-req-1", "fal-seedream");
      }
    );
  });

  it("blocks new visible submissions when the Reference Grid is full", async () => {
    const setOutputs = vi.fn();
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
        currentCostCredits: 11,
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
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        outputs: Array.from({ length: REFERENCE_GRID_MAX_VISIBLE_ITEMS }, (_, index) =>
          createVisibleOutput(`out-${index}`)
        ),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById: vi.fn(),
        startPollingTask,
        ensureGenerationRecord,
        projectId: "project-1",
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", []);
    });

    expect(setUiError).toHaveBeenCalledWith(
      expect.stringContaining(`${REFERENCE_GRID_MAX_VISIBLE_ITEMS} items`)
    );
    expect(setOutputs).not.toHaveBeenCalled();
    expect(handleImageModelSubmission).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });

  it("applies submit-proxy generation id for non-queued submissions", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("image");
    vi.mocked(handleImageModelSubmission).mockImplementationOnce(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("image-req-1", "fal-seedream", undefined, {
          request_id: "image-req-1",
          generationId: "gen-immediate-1",
        });
        return true;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
        currentCostCredits: 11,
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
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
        projectId: "project-1",
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(startPollingTask).toHaveBeenCalledTimes(1);
    const firstStartPollingCall = startPollingTask.mock.calls[0];
    expect(firstStartPollingCall?.[0]).toBe("image-req-1");
    expect(firstStartPollingCall?.[3]).toBe("fal-seedream");
    expect(firstStartPollingCall?.[7]).toEqual({
      initialDelayMs: DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS,
    });
    expect(outputs[0]?.taskId).toBe("image-req-1");
    expect(outputs[0]?.generationId).toBe("gen-immediate-1");
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        shortpulseContext: expect.objectContaining({
          project_id: "project-1",
          project_id_present: true,
          displayed_billed_credits: 11,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        }),
        workflowReload: expect.objectContaining({
          version: 1,
          originTool: "create",
          panelKind: "create",
          outputMode: "image",
          projectId: "project-1",
          payload: expect.objectContaining({
            kind: "image",
            submitTool: "create",
            aspect: "9:16",
          }),
        }),
      })
    );
    expect(outputs[0]?.workflowReload).toEqual(
      expect.objectContaining({
        originTool: "create",
        panelKind: "create",
      })
    );
  });

  it("backfills generation id from ensureGenerationRecord after non-queued dispatch", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => "gen-from-record-1");

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("image");
    vi.mocked(handleImageModelSubmission).mockImplementationOnce(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("image-req-2", "fal-seedream");
        return true;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
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
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(outputs[0]?.taskId).toBe("image-req-2");
    expect(outputs[0]?.generationId).toBe("gen-from-record-1");
  });

  it("records a breadcrumb when background generation record sync fails", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => {
      throw new Error("record insert failed");
    });

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("image");
    vi.mocked(handleImageModelSubmission).mockImplementationOnce(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("image-req-record-fail", "fal-seedream");
        return true;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
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
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(outputs[0]?.taskId).toBe("image-req-record-fail");
    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ui",
        level: "warn",
        message: "generation_record_sync_failed",
        data: expect.objectContaining({
          output_id: outputs[0]?.id,
          provider: "fal-seedream",
          task_id: "image-req-record-fail",
          completion_mode: "queued",
          error: "record insert failed",
        }),
      })
    );
  });

  it("submits promptless motion control when both motion references are present", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const motionReferenceVideoUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/motion-ref.mp4?token=stub.invalid.token";

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "video",
        model: KIE_KLING_30_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 6,
        videoResolution: "1080p",
        videoGenerateAudio: false,
        videoReferenceMode: "motion",
        videoReferenceImageUrl:
          "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/reference/character.png?token=stub.invalid.token",
        motionReferenceVideoUrl,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
        projectId: "project-1",
      })
    );

    await act(async () => {
      await result.current("", [
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/reference/character.png?token=stub.invalid.token",
      ]);
    });

    expect(setUiError).not.toHaveBeenCalledWith("Add a prompt to start a generation.");
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanedPrompt: "",
        shortpulseContext: expect.objectContaining({
          motion_reference_asset: {
            bucket: "media_library",
            storage_path: "user-1/videos/motion-control/motion-ref.mp4",
            source: "motion_control_upload",
          },
        }),
        workflowReload: expect.objectContaining({
          version: 1,
          originTool: "video",
          panelKind: "video",
          outputMode: "video",
          payload: expect.objectContaining({
            kind: "video",
            motionReferenceVideoUrl:
              "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/motion-ref.mp4?token=stub.invalid.token",
          }),
        }),
      })
    );
  });

  it("does not leak dormant motion metadata into Lip Sync submissions", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);
    const dormantMotionReferenceVideoUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/dormant-motion.mp4?token=stub.invalid.token";

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "video",
        model: FAL_OMNIHUMAN_V15_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 6,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "lip-sync",
        videoReferenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: dormantMotionReferenceVideoUrl,
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 12_000,
          sourceKind: "library",
        }),
        lipSyncTurboMode: true,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
        projectId: "project-1",
      })
    );

    await act(async () => {
      await result.current("", ["https://example.com/character.png"]);
    });

    const submitArgs = vi.mocked(handleVideoModelSubmission).mock.calls[0]?.[0];
    expect(submitArgs).toEqual(
      expect.objectContaining({
        finalModel: FAL_OMNIHUMAN_V15_MODEL_ID,
        motionReferenceVideoUrl: null,
        shortpulseContext: expect.not.objectContaining({
          motion_reference_asset: expect.anything(),
        }),
        workflowReload: expect.objectContaining({
          payload: expect.objectContaining({
            videoReferenceMode: "lip-sync",
            motionReferenceVideoUrl: null,
            lipSyncAudioUrl: "https://example.com/voice.mp3",
          }),
        }),
      })
    );
  });

  it("routes video-mode Lip Sync through OmniHuman when selected tool and model are stale", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const beginPanelGeneration = vi.fn();
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "video",
        model: KIE_KLING_30_MODEL_ID,
        prompt: "Subtle body motion matching the vocals",
        currentCostCredits: 47,
        selectedTool: "create",
        imageResolution: "model_default",
        videoDurationSeconds: 6,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "lip-sync",
        videoReferenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl:
          "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/stale-motion.mp4?token=stub.invalid.token",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 30_000,
          sourceKind: "library",
        }),
        lipSyncTurboMode: true,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration,
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
        projectId: "project-1",
      })
    );

    await act(async () => {
      await result.current("Subtle body motion matching the vocals", [
        "https://example.com/character.png",
      ]);
    });

    expect(beginPanelGeneration).toHaveBeenCalledWith("video");
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: FAL_OMNIHUMAN_V15_MODEL_ID,
        motionReferenceVideoUrl: null,
        lipSyncAudio: expect.objectContaining({
          url: "https://example.com/voice.mp3",
          durationMs: 30_000,
        }),
        lipSyncTurboMode: true,
        shortpulseContext: expect.objectContaining({
          selected_tool: "video",
          mode: "video",
          displayed_billed_credits: 47,
          pricing_display_source: "pricing_grid",
          lip_sync_audio_duration_ms: 30_000,
        }),
        workflowReload: expect.objectContaining({
          originTool: "video",
          panelKind: "video",
          outputMode: "video",
          payload: expect.objectContaining({
            videoReferenceMode: "lip-sync",
            motionReferenceVideoUrl: null,
            lipSyncAudioUrl: "https://example.com/voice.mp3",
            lipSyncTurboMode: true,
          }),
        }),
      })
    );
  });

  it("fails closed before dispatching retired direct OpenAI GPT Image 2", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("unsupported");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "removed-openai-image-model",
        prompt: "",
        selectedTool: "create",
        imageResolution: "2K",
        videoDurationSeconds: 6,
        videoResolution: "1080p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(handleDefaultModelSubmission).not.toHaveBeenCalled();
    expect(handleImageModelSubmission).not.toHaveBeenCalled();
    expect(handleVideoModelSubmission).not.toHaveBeenCalled();
    expect(startPollingTask).not.toHaveBeenCalled();
    expect(ensureGenerationRecord).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      outputs[0]?.id,
      "Generation failed to start. Please retry.",
      "Model 'removed-openai-image-model' is not registered for AI Studio generation submission.",
      expect.objectContaining({
        reasonCode: "SUBMIT_NOT_STARTED",
        telemetryMode: "state_only",
      })
    );
  });

  it("recovers queued polling after a post-handoff client exception without failing the output", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("status timer unavailable");
      })
      .mockImplementation(() => undefined);
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
    vi.mocked(handleImageModelSubmission).mockImplementationOnce(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("image-req-recover", "fal-seedream");
        return true;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
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
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(startPollingTask).toHaveBeenCalledTimes(2);
    expect(outputs[0]?.taskId).toBe("image-req-recover");
    expect(outputs[0]?.provider).toBe("fal-seedream");
    expect(outputs[0]?.taskState).toBe("running");
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "generation_submit_post_handoff_error",
        metadata: expect.objectContaining({
          started_task_id: "image-req-recover",
          started_provider: "fal-seedream",
          lifecycle_mode: "queued",
        }),
      })
    );
  });

  it("keeps the first queued handoff when a handler attempts to start polling twice", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("image");
    vi.mocked(handleImageModelSubmission).mockImplementationOnce(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("image-req-primary", "fal-seedream");
        startPollingWithGeneration("image-req-duplicate", "fal-seedream");
        return true;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
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
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startPollingTask).toHaveBeenCalledTimes(1);
    expect(startPollingTask).toHaveBeenCalledWith(
      "image-req-primary",
      outputs[0]?.id,
      0,
      "fal-seedream",
      expect.any(Number),
      0,
      undefined,
      { initialDelayMs: DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS }
    );
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "generation_submit_lifecycle_contract",
        metadata: expect.objectContaining({
          output_id: outputs[0]?.id,
          started_task_id: "image-req-primary",
          started_provider: "fal-seedream",
        }),
      })
    );
    expect(outputs[0]?.taskId).toBe("image-req-primary");
    expect(outputs[0]?.taskState).toBe("running");
  });

  it("prefers the caller-provided displayed billed credits in shortpulse context", async () => {
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => "gen-direct-complete-override");
    const setOutputs = vi.fn();
    const updateOutputById = vi.fn();

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("default");
    vi.mocked(handleDefaultModelSubmission).mockImplementationOnce(async () => undefined);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "removed-openai-image-model",
        prompt: "",
        currentCostCredits: 11,
        promptReferenceGenerateCostCredits: 7,
        selectedTool: "create",
        imageResolution: "2K",
        videoDurationSeconds: 6,
        videoResolution: "1080p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A polished studio portrait", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
        displayedBilledCredits: 2,
      });
    });

    expect(handleDefaultModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        shortpulseContext: expect.objectContaining({
          displayed_billed_credits: 2,
          workspace_runtime_key: null,
          workspace_runtime_key_present: false,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        }),
      })
    );
  });

  it("marks edit-image submissions as pricing-grid priced in shortpulse context", async () => {
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => "gen-direct-complete-edit");
    const setOutputs = vi.fn();
    const updateOutputById = vi.fn();

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("default");
    vi.mocked(handleDefaultModelSubmission).mockImplementationOnce(async () => undefined);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "1:1",
        mode: "image",
        model: "fal-ai/nano-banana-2/edit",
        prompt: "",
        currentCostCredits: 9,
        promptReferenceGenerateCostCredits: 9,
        selectedTool: "edit",
        imageResolution: "2K",
        videoDurationSeconds: 6,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: "https://cdn.test/reference.png",
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        projectId: "project-edit-1",
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 6,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Clean up edges", ["https://cdn.test/reference.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        displayedBilledCredits: 9,
      });
    });

    expect(handleDefaultModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        shortpulseContext: expect.objectContaining({
          selected_tool: "edit",
          displayed_billed_credits: 9,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        }),
      })
    );
  });

  it("marks video submissions as pricing-grid priced in shortpulse context", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("video");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        prompt: "",
        currentCostCredits: 14,
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "1080p",
        videoGenerateAudio: true,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        projectId: "project-video-1",
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Bridge shot morphing between keyframes", [], {
        modeOverride: "video",
        selectedToolOverride: "video",
        displayedBilledCredits: 14,
      });
    });

    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        shortpulseContext: expect.objectContaining({
          selected_tool: "video",
          mode: "video",
          displayed_billed_credits: 14,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        }),
      })
    );
  });

  it("forwards Seedance multi-shot mode into video submission", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValue("video");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_SEEDANCE_2_MODEL_ID,
        prompt: "",
        currentCostCredits: 14,
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 10,
        videoResolution: "720p",
        videoGenerateAudio: true,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        seedance2InputMode: "text",
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingWorkflowMode: "multi",
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 10,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Open on the beach, cut to the product, then end on the skyline", [], {
        modeOverride: "video",
        selectedToolOverride: "video",
      });
    });

    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: KIE_SEEDANCE_2_MODEL_ID,
        klingWorkflowMode: "multi",
      })
    );
  });

  it("routes Kie Veo to text-video when no frame images are present", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: true,
        videoReferenceMode: "keyframes",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Bridge shot morphing between keyframes", [], {
        modeOverride: "video",
        selectedToolOverride: "video",
      });
    });

    expect(outputs[0]?.modelId).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(outputs[0]?.taskState).toBe("running");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        preparedImageInputs: [],
      })
    );
  });

  it("routes Kie Veo to single-image video when only one frame image is present", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: true,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: "https://example.com/first.png",
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current(
        "Bridge shot morphing between keyframes",
        ["https://example.com/first.png"],
        {
          modeOverride: "video",
          selectedToolOverride: "video",
        }
      );
    });

    expect(outputs[0]?.modelId).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(outputs[0]?.taskState).toBe("running");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        preparedImageInputs: ["https://example.com/first.png"],
      })
    );
  });

  it("routes Kie Veo to text-video when no frame images are present", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: true,
        videoReferenceMode: "keyframes",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Bridge shot morphing between keyframes", [], {
        modeOverride: "video",
        selectedToolOverride: "video",
      });
    });

    expect(outputs[0]?.modelId).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(outputs[0]?.taskState).toBe("running");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        preparedImageInputs: [],
      })
    );
  });

  it("captures video workflow reload metadata for style, frames, and element slots", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_SEEDANCE_2_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: true,
        videoReferenceMode: "keyframes",
        videoReferenceImageUrl: "https://example.com/first.png",
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        seedance2InputMode: "multimodal",
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [
          {
            id: "direct-image-slot",
            slotIndex: 0,
            sourceKind: "reference-image",
            name: "Image reference",
            profileImageUrl: "https://example.com/element-profile.png",
            frontalImageUrl: "https://example.com/element-profile.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
          {
            id: "direct-video-slot",
            slotIndex: 1,
            sourceKind: "reference-video",
            name: "Video reference",
            profileImageUrl: null,
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "https://example.com/element-motion.mp4",
          },
        ],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current(
        "A styled Seedance shot",
        ["https://example.com/first.png", "https://example.com/last.png"],
        {
          modeOverride: "video",
          selectedToolOverride: "video",
          styleContextOverride: {
            applied: true,
            styleId: "video-style",
            styleName: "Video Style",
            stylePrompt: "stormy handheld realism",
          },
        }
      );
    });

    const workflowReload = outputs[0]?.workflowReload;
    expect(workflowReload?.payload).toEqual(
      expect.objectContaining({
        kind: "video",
        styleContext: {
          applied: true,
          styleId: "video-style",
          styleName: "Video Style",
          stylePrompt: "stormy handheld realism",
        },
        videoReferences: expect.objectContaining({
          firstFrame: expect.objectContaining({
            sourceUrl: "https://example.com/first.png",
          }),
          lastFrame: expect.objectContaining({
            sourceUrl: "https://example.com/last.png",
          }),
          klingElementSlots: [
            expect.objectContaining({
              slotIndex: 0,
              element: expect.objectContaining({
                id: "direct-image-slot",
                profileImageUrl: "https://example.com/element-profile.png",
                frontalImageUrl: "https://example.com/element-profile.png",
              }),
            }),
            expect.objectContaining({
              slotIndex: 1,
              element: expect.objectContaining({
                id: "direct-video-slot",
                sourceKind: "reference-video",
                videoUrl: "https://example.com/element-motion.mp4",
              }),
            }),
          ],
        }),
      })
    );
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowReload,
      })
    );
    expect(vi.mocked(handleVideoModelSubmission).mock.calls[0]?.[0]?.klingElements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "direct-video-slot",
          sourceKind: "reference-video",
          videoUrl: "https://example.com/element-motion.mp4",
        }),
      ])
    );
  });

  it("routes standard video to text-video when no frame images are present", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: true,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A cinematic pan across mountain ridges", [], {
        modeOverride: "video",
        selectedToolOverride: "video",
      });
    });

    expect(outputs[0]?.modelId).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(outputs[0]?.taskState).toBe("running");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        preparedImageInputs: [],
      })
    );
  });

  it("allows standard text-to-video submissions without reference images", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "1080p",
        videoGenerateAudio: true,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A cinematic storm over the desert", [], {
        modeOverride: "video",
        selectedToolOverride: "video",
      });
    });

    expect(outputs[0]?.modelId).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        preparedImageInputs: [],
      })
    );
    expect(resolveSubmissionHandlerRoute).toHaveBeenCalledWith(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(setUiError).not.toHaveBeenCalledWith("Add a reference image before generating.");
  });

  it("keeps Kling 3 motion strict when references are missing", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: KIE_KLING_30_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: true,
        videoReferenceMode: "motion",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("A dancer copying a reference motion clip", [], {
        modeOverride: "video",
        selectedToolOverride: "video",
      });
    });

    expect(outputs[0]?.modelId).toBe(KIE_KLING_30_MODEL_ID);
    expect(outputs[0]?.taskState).toBe("fail");
    expect(outputs[0]?.errorMessageShort).toBe("Image URL required.");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).not.toHaveBeenCalled();
    expect(resolveSubmissionHandlerRoute).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalledWith(
      expect.stringContaining("No reference media were detected")
    );
  });

  it("labels create submissions with the selected model when character mode is enabled", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "create",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Character prompt", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(outputs[0]?.model).toBe(resolveModelLabel("fal-ai/bytedance/seedream/v4.5/edit"));
    expect(outputs[0]?.modelId).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("blocks create submissions that target image-to-image models without references", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/nano-banana-pro/edit",
        prompt: "",
        selectedTool: "create",
        imageResolution: "1K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Character prompt", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(outputs).toHaveLength(0);
    expect(setUiError).toHaveBeenCalledWith("Add a reference image before generating.");
    expect(handleImageModelSubmission).not.toHaveBeenCalled();
    expect(resolveSubmissionHandlerRoute).not.toHaveBeenCalled();
  });

  it("passes selected aspect and auto_4K resolution through create character-mode Seedream submissions", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "create",
        imageResolution: "auto_4K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Character prompt", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
        aspect: "16:9",
        requestedResolution: "auto_4K",
      })
    );
  });

  it("converts reference upload prep failures into failed outputs instead of hanging spinners", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    prepareImageUrlForSubmissionMock.mockRejectedValueOnce(new Error("Upload failed"));

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("edit prompt", ["blob:broken-ref"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
      });
    });

    expect(outputs[0]?.taskState).toBe("fail");
    expect(outputs[0]?.errorMessageShort).toBe("Reference upload failed.");
    expect(outputs[0]?.generationReplay).toBeUndefined();
    expect(setUiError).toHaveBeenCalledWith("Reference upload failed: Upload failed");
    expect(startPollingTask).not.toHaveBeenCalled();
  });

  it("uses per-output mutation for preflight failure after the initial placeholder insert", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });

    prepareImageUrlForSubmissionMock.mockRejectedValueOnce(new Error("Upload failed"));

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(vi.fn()),
        setUiNotice: asDispatch(vi.fn()),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(vi.fn()),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure: vi.fn(),
        updateOutputById,
        startPollingTask: vi.fn(),
        ensureGenerationRecord: vi.fn(async () => null),
      })
    );

    await act(async () => {
      await result.current("edit prompt", ["blob:broken-ref"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
      });
    });

    expect(setOutputs).toHaveBeenCalledTimes(1);
    expect(updateOutputById).toHaveBeenCalledTimes(1);
    expect(outputs[0]?.taskState).toBe("fail");
  });

  it("uses per-output mutation when attaching generation replay after placeholder insert", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
        selectedTool: "create",
        imageResolution: "2K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(vi.fn()),
        setUiNotice: asDispatch(vi.fn()),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(vi.fn()),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure: vi.fn(),
        updateOutputById,
        startPollingTask: vi.fn(),
        ensureGenerationRecord: vi.fn(async () => null),
      })
    );

    await act(async () => {
      await result.current("portrait prompt", ["https://cdn.test/ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(setOutputs).toHaveBeenCalledTimes(1);
    expect(updateOutputById).toHaveBeenCalled();
    expect(outputs[0]?.generationReplay).toEqual(
      expect.objectContaining({
        displayPrompt: "portrait prompt",
        imageResolution: "auto_2K",
      })
    );
  });

  it("fails fast when pre-submit reference preparation exceeds deadline", async () => {
    vi.useFakeTimers();
    try {
      let outputs: StudioOutput[] = [];
      const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
        outputs = typeof value === "function" ? value(outputs) : value;
      });
      const setUiError = vi.fn();
      const setUiNotice = vi.fn();
      const setSaved = vi.fn();
      const notifyGenerationFailure = vi.fn();
      const updateOutputById = createStatefulUpdateOutputById({
        get: () => outputs,
        set: (next) => {
          outputs = next;
        },
      });
      const startPollingTask = vi.fn();
      const ensureGenerationRecord = vi.fn(async () => null);

      prepareImageUrlForSubmissionMock.mockImplementationOnce(
        async () =>
          await new Promise<string>(() => {
            // intentionally unresolved to simulate stalled prep
          })
      );

      const { result } = renderHook(() =>
        useAiStudioTaskSubmission({
          aspect: "9:16",
          mode: "image",
          model: "fal-ai/bytedance/seedream/v4.5/edit",
          prompt: "",
          selectedTool: "edit",
          imageResolution: "model_default",
          videoDurationSeconds: 8,
          videoResolution: "720p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur, distort, and low quality",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
          setUiError: asDispatch(setUiError),
          setUiNotice: asDispatch(setUiNotice),
          setOutputs: asDispatch(setOutputs),
          setSaved: asDispatch(setSaved),
          getDefaultDurationSeconds: () => 8,
          notifyGenerationFailure,
          updateOutputById,
          startPollingTask,
          ensureGenerationRecord,
        })
      );

      await act(async () => {
        const pending = result.current("edit prompt", ["blob:slow-ref"], {
          modeOverride: "image",
          selectedToolOverride: "edit",
        });
        await vi.advanceTimersByTimeAsync(
          resolvePrepareReferenceTimeoutBudget({
            imageInputs: ["blob:slow-ref"],
          }).timeoutMs + 1_000
        );
        await pending;
      });

      expect(outputs[0]?.taskState).toBe("fail");
      expect(outputs[0]?.errorMessageShort).toBe("Preparation timed out.");
      expect(outputs[0]?.generationReplay).toBeUndefined();
      expect(setUiError).toHaveBeenCalledWith(
        "Preparation timed out before generation started. Please retry."
      );
      expect(startPollingTask).not.toHaveBeenCalled();
      expect(handleImageModelSubmission).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(STRICT_EDIT_MODELS)(
    "blocks %s in edit workflow when no reference images are provided (no text-image fallback)",
    async (modelId) => {
      let outputs: StudioOutput[] = [];
      const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
        outputs = typeof value === "function" ? value(outputs) : value;
      });
      const setUiError = vi.fn();
      const setUiNotice = vi.fn();
      const setSaved = vi.fn();
      const notifyGenerationFailure = vi.fn();
      const updateOutputById = vi.fn();
      const startPollingTask = vi.fn();
      const ensureGenerationRecord = vi.fn(async () => null);

      const { result } = renderHook(() =>
        useAiStudioTaskSubmission({
          aspect: "9:16",
          mode: "image",
          model: modelId,
          prompt: "",
          selectedTool: "edit",
          imageResolution: "model_default",
          videoDurationSeconds: 8,
          videoResolution: "720p",
          videoGenerateAudio: false,
          videoReferenceMode: "standard",
          videoReferenceImageUrl: null,
          motionReferenceVideoUrl: null,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur, distort, and low quality",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          beginPanelGeneration: vi.fn(),
          endPanelGeneration: vi.fn(),
          setUiError: asDispatch(setUiError),
          setUiNotice: asDispatch(setUiNotice),
          setOutputs: asDispatch(setOutputs),
          setSaved: asDispatch(setSaved),
          getDefaultDurationSeconds: () => 8,
          notifyGenerationFailure,
          updateOutputById,
          startPollingTask,
          ensureGenerationRecord,
        })
      );

      await act(async () => {
        await result.current("Enhance the source image with cinematic light", [], {
          modeOverride: "image",
          selectedToolOverride: "edit",
        });
      });

      expect(outputs).toHaveLength(0);
      expect(setUiError).toHaveBeenCalledWith("Add a reference image before generating.");
      expect(handleImageModelSubmission).not.toHaveBeenCalled();
      expect(handleVideoModelSubmission).not.toHaveBeenCalled();
      expect(resolveSubmissionHandlerRoute).not.toHaveBeenCalled();
      expect(setUiNotice).not.toHaveBeenCalledWith(
        expect.stringContaining("Running text-to-image")
      );
    }
  );

  it("keeps edit model strict when prepared references resolve to zero URLs", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    prepareImageUrlForSubmissionMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Enhance the source image with cinematic light", ["blob:bad-ref"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(outputs[0]?.taskState).toBe("fail");
    expect(outputs[0]?.errorMessageShort).toBe("Reference image required.");
    expect(handleImageModelSubmission).not.toHaveBeenCalled();
    expect(handleVideoModelSubmission).not.toHaveBeenCalled();
    expect(resolveSubmissionHandlerRoute).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalledWith(expect.stringContaining("Running text-to-image"));
  });

  it("keeps display prompt in UI while submitting hidden prompt to the provider handler", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "auto_4K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current(
        "Hidden character description context.\n\nVisible user prompt.",
        ["https://cdn.test/ref.png"],
        {
          modeOverride: "image",
          selectedToolOverride: "edit",
          displayPromptOverride: "Visible user prompt.",
        }
      );
    });

    expect(outputs[0]?.prompt).toBe("Visible user prompt.");
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanedPrompt: "Hidden character description context.\n\nVisible user prompt.",
      })
    );
  });

  it("captures a replay snapshot on image output creation", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "auto_4K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    prepareImageUrlForSubmissionMock.mockResolvedValueOnce("https://cdn.test/prepared-ref.png");

    await act(async () => {
      await result.current("Hidden character context + Visible user prompt.", ["blob:raw-ref"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        displayPromptOverride: "Visible user prompt.",
        characterContextOverride: {
          applied: true,
          characterId: "char-1",
          characterName: "Nova",
        },
        styleContextOverride: {
          applied: true,
          styleId: "cinematic",
          styleName: "Cinematic",
          stylePrompt: "cinematic contrast and rich shadows",
        },
      });
    });

    expect(outputs[0]?.generationReplay).toEqual(
      expect.objectContaining({
        version: 1,
        mode: "image",
        submitTool: "edit",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        displayPrompt: "Visible user prompt.",
        submissionPrompt: "Hidden character context + Visible user prompt.",
        aspect: "9:16",
        imageResolution: "auto_4K",
        referenceInputs: ["https://cdn.test/prepared-ref.png"],
        characterContext: {
          applied: true,
          characterId: "char-1",
          characterName: "Nova",
        },
        styleContext: {
          applied: true,
          styleId: "cinematic",
          styleName: "Cinematic",
          stylePrompt: "cinematic contrast and rich shadows",
        },
      })
    );
    expect(typeof outputs[0]?.generationReplay?.capturedAt).toBe("string");
  });

  it("does not capture replay snapshots for inpaint override submissions", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "1:1",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Inpaint submit prompt", ["https://cdn.test/ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        modelIdOverride: "fal-ai/flux-pro/v1/fill",
        inpaintOverride: {
          modelId: "fal-ai/flux-pro/v1/fill",
          baseImageInput: "https://cdn.test/inpaint-base.png",
          maskInput: "https://cdn.test/inpaint-mask.png",
          outputFormat: "png",
        },
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/flux-pro/v1/fill");
    expect(outputs[0]?.generationReplay).toBeUndefined();
  });

  it("captures canonical internal refs in replay when submit receives durable overrides without URL refs", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Hidden character context + Visible user prompt.", [], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        displayPromptOverride: "Visible user prompt.",
        internalMediaRefsOverride: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/chars/ref-a.png",
          },
        ],
        characterContextOverride: {
          applied: true,
          characterId: "char-1",
          characterName: "Nova",
        },
      });
    });

    expect(outputs[0]?.generationReplay).toEqual(
      expect.objectContaining({
        version: 2,
        mode: "image",
        submitTool: "edit",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        displayPrompt: "Visible user prompt.",
        submissionPrompt: "Hidden character context + Visible user prompt.",
        aspect: "9:16",
        imageResolution: "auto_2K",
        referenceInputs: [],
        internalMediaRefs: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/chars/ref-a.png",
          },
        ],
        characterContext: {
          applied: true,
          characterId: "char-1",
          characterName: "Nova",
        },
      })
    );
  });

  it("applies aspect and image resolution overrides during image submission", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Replay submit prompt", ["https://cdn.test/ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        modelIdOverride: "fal-ai/nano-banana-pro/edit",
        aspectOverride: "1:1",
        imageResolutionOverride: "2K",
        displayPromptOverride: "Replay display prompt",
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/nano-banana-pro/edit");
    expect(outputs[0]?.aspect).toBe("1:1");
    expect(outputs[0]?.generationReplay?.imageResolution).toBe("2K");
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/nano-banana-pro/edit",
        aspect: "1:1",
        requestedResolution: "2K",
      })
    );
  });

  it("prepares only inpaint override media when an inpaint override is present", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "1:1",
        mode: "image",
        model: "fal-ai/flux-kontext-lora/inpaint",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Reference inpaint prompt", ["https://cdn.test/unused-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        modelIdOverride: "fal-ai/flux-kontext-lora/inpaint",
        inpaintOverride: {
          modelId: "fal-ai/flux-kontext-lora/inpaint",
          baseImageInput: "https://cdn.test/inpaint-base.png",
          maskInput: "https://cdn.test/inpaint-mask.png",
          referenceImageInput: "https://cdn.test/inpaint-reference.png",
          outputFormat: "png",
        },
      });
    });

    expect(prepareImageUrlForSubmissionMock.mock.calls.map((call) => call[0])).toEqual([
      "https://cdn.test/inpaint-base.png",
      "https://cdn.test/inpaint-mask.png",
      "https://cdn.test/inpaint-reference.png",
    ]);
    expect(vi.mocked(handleImageModelSubmission)).toHaveBeenCalledWith(
      expect.objectContaining({
        inpaintOverride: expect.objectContaining({
          modelId: "fal-ai/flux-kontext-lora/inpaint",
          baseImageInput: "https://cdn.test/inpaint-base.png",
          maskInput: "https://cdn.test/inpaint-mask.png",
          referenceImageInput: "https://cdn.test/inpaint-reference.png",
        }),
        preparedImageInputs: [],
      })
    );
    expect(outputs[0]?.generationReplay).toBeUndefined();
  });

  it("prepares Expert Edit restore-only secondary refs for workflow reload metadata", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = createStatefulUpdateOutputById({
      get: () => outputs,
      set: (next) => {
        outputs = next;
      },
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
    prepareImageUrlForSubmissionMock
      .mockResolvedValueOnce("https://cdn.test/prepared-primary.png")
      .mockResolvedValueOnce("https://cdn.test/prepared-secondary.png");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "1:1",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Refine the scene", ["blob:primary"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/edit",
        expertEditReferences: {
          version: 1,
          maxSecondarySlotCount: 10,
          primaryReferenceInputIndex: 0,
          secondarySlots: [],
          restoreSecondarySlots: [{ slotIndex: 1, sourceUrl: "blob:secondary" }],
        },
        expertEditRestoreImageInputs: ["blob:secondary"],
      });
    });

    expect(prepareImageUrlForSubmissionMock.mock.calls.map((call) => call[0])).toEqual([
      "blob:primary",
      "blob:secondary",
    ]);
    expect(outputs[0]?.workflowReload?.payload).toEqual(
      expect.objectContaining({
        kind: "image",
        referenceInputs: ["https://cdn.test/prepared-primary.png"],
        expertEditReferences: {
          version: 1,
          maxSecondarySlotCount: 10,
          primaryReferenceInputIndex: 0,
          secondarySlots: [],
          restoreSecondarySlots: [
            { slotIndex: 1, sourceUrl: "https://cdn.test/prepared-secondary.png" },
          ],
        },
      })
    );
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        preparedImageInputs: ["https://cdn.test/prepared-primary.png"],
        workflowReload: expect.objectContaining({
          payload: expect.objectContaining({
            referenceInputs: ["https://cdn.test/prepared-primary.png"],
          }),
        }),
      })
    );
  });

  it("never leaks hidden submission-only prompt text into output prompt", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "auto_4K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current(
        "Hidden character description context only.",
        ["https://cdn.test/ref.png"],
        {
          modeOverride: "image",
          selectedToolOverride: "edit",
          displayPromptOverride: "",
        }
      );
    });

    expect(outputs[0]?.prompt).toBe("");
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanedPrompt: "Hidden character description context only.",
      })
    );
  });

  it("reuses optimistic placeholder output ids instead of creating duplicate cards", async () => {
    let outputs: StudioOutput[] = [
      {
        id: "out-optimistic",
        prompt: "Pending prompt",
        mode: "image",
        aspect: "9:16",
        model: "Model pending selection",
        status: "ready",
        taskState: "pending",
        timestamp: "Submitting...",
      },
    ];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "auto_4K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Updated prompt", ["https://cdn.test/ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        displayPromptOverride: "Updated prompt",
        outputIdOverride: "out-optimistic",
      });
    });

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.id).toBe("out-optimistic");
    expect(outputs[0]?.prompt).toBe("Updated prompt");
    expect(outputs[0]?.taskState).toBe("pending");
  });

  it("clamps unsupported model aspects before writing output metadata and dispatching submissions", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("video");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "1:1",
        mode: "video",
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        prompt: "",
        selectedTool: "video",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "1080p",
        videoGenerateAudio: true,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Veo prompt", ["https://cdn.test/ref.png"], {
        modeOverride: "video",
        selectedToolOverride: "video",
      });
    });

    expect(outputs[0]?.aspect).toBe("16:9");
    expect(handleVideoModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        aspect: "16:9",
      })
    );
  });

  it("removes optimistic placeholder cards when submission is blocked before start", async () => {
    let outputs: StudioOutput[] = [
      {
        id: "out-optimistic",
        prompt: "Pending prompt",
        mode: "image",
        aspect: "9:16",
        model: "Model pending selection",
        status: "ready",
        taskState: "pending",
        timestamp: "Submitting...",
      },
    ];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: null,
        prompt: "",
        selectedTool: "create",
        imageResolution: "auto_4K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Prompt text", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
        outputIdOverride: "out-optimistic",
      });
    });

    expect(setUiError).toHaveBeenCalledWith("Pick a model to generate.");
    expect(outputs).toHaveLength(0);
  });

  it("shows explicit error instead of silently no-oping create/text submissions in text mode", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "text",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
        selectedTool: "create",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Prompt text", [], {
        modeOverride: "text",
        selectedToolOverride: "create",
      });
    });

    expect(setUiError).toHaveBeenCalledWith(
      "Switch to image generation before running this action."
    );
    expect(startPollingTask).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(0);
  });

  it("submits create image generations with Seedream text-to-image when selected", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("default");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        prompt: "",
        selectedTool: "create",
        imageResolution: "auto_4K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Create a dramatic skyline at dusk", [], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(handleDefaultModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      })
    );
    expect(setUiError).not.toHaveBeenCalledWith("Pick a model to generate.");
  });

  it("preserves prepared reference payload for Nano Banana Pro text submissions in create workflow", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("default");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/nano-banana-pro",
        prompt: "",
        selectedTool: "create",
        imageResolution: "1K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Character prompt", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/nano-banana-pro");
    expect(handleDefaultModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/nano-banana-pro",
        falReferencePayload: {
          image_url: "https://cdn.test/char-ref.png",
          image_urls: ["https://cdn.test/char-ref.png"],
        },
      })
    );
  });

  it("prioritizes modelIdOverride for create submissions and routes Nano Banana Pro to edit handler", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/nano-banana-pro",
        prompt: "",
        selectedTool: "create",
        imageResolution: "1K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Character prompt", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
        modelIdOverride: "fal-ai/nano-banana-pro/edit",
        characterContextOverride: {
          applied: true,
          characterId: "char-1",
          characterName: "Hero",
          lookId: "2",
          lookName: "2",
          characterProfileImageUrl: "https://cdn.test/profile.png",
        },
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/nano-banana-pro/edit");
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/nano-banana-pro/edit",
        preparedImageInputs: ["https://cdn.test/char-ref.png"],
        characterContext: {
          applied: true,
          characterId: "char-1",
          characterName: "Hero",
          lookId: "2",
          lookName: "2",
          characterProfileImageUrl: "https://cdn.test/profile.png",
        },
      })
    );
    expect(handleDefaultModelSubmission).not.toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/nano-banana-pro",
      })
    );
  });

  it("marks Bria background-remove submissions as hidden from reference grid", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/nano-banana-pro",
        prompt: "",
        selectedTool: "create",
        imageResolution: "1K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Remove background", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
        modelIdOverride: "fal-ai/bria/background/remove",
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/bria/background/remove");
    expect(outputs[0]?.hiddenInReferenceGrid).toBe(true);
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/bria/background/remove",
      })
    );
  });

  it("marks explicitly hidden submissions as hidden from reference grid", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/nano-banana-pro/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "1K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Edit prompt", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
        hideOutputFromReferenceGrid: true,
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/nano-banana-pro/edit");
    expect(outputs[0]?.hiddenInReferenceGrid).toBe(true);
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/nano-banana-pro/edit",
      })
    );
  });

  it("fails immediately when image routing does not start a provider task", async () => {
    const setOutputs = vi.fn();
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
    vi.mocked(handleImageModelSubmission).mockResolvedValueOnce(false);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/nano-banana-pro/edit",
        prompt: "",
        selectedTool: "create",
        imageResolution: "1K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Character prompt", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(startPollingTask).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      expect.any(String),
      "Generation failed to start. Please retry.",
      expect.stringContaining("did not handle model"),
      expect.objectContaining({
        reasonCode: "SUBMIT_NOT_STARTED",
        telemetryMode: "state_only",
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "fal_submit_not_started",
      })
    );
  });

  it("preserves handler-specific submit failures instead of overriding with submit-not-started", async () => {
    const setOutputs = vi.fn();
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
    vi.mocked(handleImageModelSubmission).mockImplementationOnce(
      async ({ id, notifyGenerationFailure: notifyFromHandler }) => {
        notifyFromHandler(id, "FLUX Fill requires both a base image and mask.");
        return true;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/flux-pro/v1/fill",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("put a dog here", ["https://cdn.test/base.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
      });
    });

    expect(startPollingTask).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).toHaveBeenCalledTimes(1);
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      expect.any(String),
      "FLUX Fill requires both a base image and mask.",
      undefined,
      undefined
    );
    expect(reportAppErrorMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        source: "fal_submit_not_started",
      })
    );
  });

  it("maps auth-session timeout during submit to an immediate start failure with telemetry", async () => {
    const setOutputs = vi.fn();
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
    const timeoutError = Object.assign(new Error("Session resolution timed out"), {
      code: AUTH_SESSION_TIMEOUT_CODE,
      timeoutMs: 4_000,
    });
    vi.mocked(handleImageModelSubmission).mockRejectedValueOnce(timeoutError);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/nano-banana-pro/edit",
        prompt: "",
        selectedTool: "create",
        imageResolution: "1K",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Character prompt", ["https://cdn.test/char-ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(startPollingTask).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      expect.any(String),
      "Generation failed to start. Please retry.",
      "Session check timed out before provider submit.",
      expect.objectContaining({
        reasonCode: "AUTH_SESSION_TIMEOUT",
        telemetryMode: "state_only",
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "fal_auth_session_timeout",
        metadata: expect.objectContaining({
          reason_code: "AUTH_SESSION_TIMEOUT",
          timeout_ms: 4_000,
        }),
      })
    );
  });

  it("fails fast when a provider handler does not return a request id", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const setUiError = vi.fn();
    const setUiNotice = vi.fn();
    const setSaved = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
    vi.mocked(handleImageModelSubmission).mockImplementationOnce(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration(undefined, "fal-seedream");
        return true;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "9:16",
        mode: "image",
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "",
        selectedTool: "edit",
        imageResolution: "model_default",
        videoDurationSeconds: 8,
        videoResolution: "720p",
        videoGenerateAudio: false,
        videoReferenceMode: "standard",
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "blur, distort, and low quality",
        klingCfgScale: 0.5,
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        beginPanelGeneration: vi.fn(),
        endPanelGeneration: vi.fn(),
        setUiError: asDispatch(setUiError),
        setUiNotice: asDispatch(setUiNotice),
        setOutputs: asDispatch(setOutputs),
        setSaved: asDispatch(setSaved),
        getDefaultDurationSeconds: () => 8,
        notifyGenerationFailure,
        updateOutputById,
        startPollingTask,
        ensureGenerationRecord,
      })
    );

    await act(async () => {
      await result.current("Queued prompt", ["https://cdn.test/ref.png"], {
        modeOverride: "image",
        selectedToolOverride: "edit",
      });
    });

    expect(startPollingTask).not.toHaveBeenCalled();
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      outputs[0]?.id,
      "Provider returned an empty request id.",
      "Provider returned an empty request id."
    );
  });
});

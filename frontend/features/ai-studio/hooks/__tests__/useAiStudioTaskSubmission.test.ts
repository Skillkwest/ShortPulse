import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { resolveModelLabel } from "../../logic/stateParsers";
import { useAiStudioTaskSubmission } from "../useAiStudioTaskSubmission";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
import { AUTH_SESSION_TIMEOUT_CODE } from "../../../../lib/authenticatedFetch";
import * as falClient from "../../../../lib/falClient";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
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

const createStatefulUpdateOutputById = (accessor: {
  get: () => StudioOutput[];
  set: (next: StudioOutput[]) => void;
}) =>
  vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
    accessor.set(accessor.get().map((item) => (item.id === id ? updater(item) : item)));
  });

describe("useAiStudioTaskSubmission", () => {
  const STRICT_EDIT_MODELS = [
    "fal/flux-2/edit",
    "fal/flux-2-pro/edit",
    "fal-ai/nano-banana/edit",
    "fal-ai/nano-banana-2/edit",
    "fal-ai/nano-banana-pro/edit",
    "fal-ai/bytedance/seedream/v5/lite/edit",
    "fal-ai/bytedance/seedream/v4.5/edit",
    "custom/legacy-image",
  ] as const;

  const prepareImageUrlForSubmissionMock = vi.mocked(prepareImageUrlForSubmission);

  beforeEach(() => {
    vi.clearAllMocks();
    prepareImageUrlForSubmissionMock.mockImplementation(async (url: string | null) => url);
    vi.mocked(handleVideoModelSubmission).mockImplementation(
      async ({ startPollingWithGeneration }) => {
        startPollingWithGeneration("video-req-1", "fal-veo");
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

  it("applies submit-proxy generation id for non-queued submissions", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    expect(startPollingTask).toHaveBeenCalledTimes(1);
    const firstStartPollingCall = startPollingTask.mock.calls[0];
    expect(firstStartPollingCall?.[0]).toBe("image-req-1");
    expect(firstStartPollingCall?.[3]).toBe("fal-seedream");
    expect(outputs[0]?.taskId).toBe("image-req-1");
    expect(outputs[0]?.generationId).toBe("gen-immediate-1");
  });

  it("backfills generation id from ensureGenerationRecord after non-queued dispatch", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

  it("keeps Veo First/Last strict when references are missing (no text-video fallback)", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    const setIsPromptGenerating = vi.fn();
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
        model: "fal-ai/veo3.1/first-last-frame-to-video",
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    expect(outputs[0]?.modelId).toBe("fal-ai/veo3.1/first-last-frame-to-video");
    expect(outputs[0]?.taskState).toBe("fail");
    expect(outputs[0]?.errorMessageShort).toBe("First/Last needs two images.");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).not.toHaveBeenCalled();
    expect(resolveSubmissionHandlerRoute).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalledWith(
      expect.stringContaining("No reference media were detected")
    );
  });

  it("keeps Kie Veo keyframes strict when last frame is missing", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
    expect(outputs[0]?.taskState).toBe("fail");
    expect(outputs[0]?.errorMessageShort).toBe("First/Last needs two images.");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).not.toHaveBeenCalled();
    expect(resolveSubmissionHandlerRoute).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalledWith(
      expect.stringContaining("No reference media were detected")
    );
  });

  it("keeps standard video strict when references are missing (no text-video fallback)", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    const setIsPromptGenerating = vi.fn();
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
        model: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    expect(outputs[0]?.modelId).toBe("fal-ai/bytedance/seedance/v1.5/pro/image-to-video");
    expect(outputs[0]?.taskState).toBe("fail");
    expect(outputs[0]?.errorMessageShort).toBe("Reference image required.");
    expect(setSaved).toHaveBeenCalledWith(false);
    expect(handleVideoModelSubmission).not.toHaveBeenCalled();
    expect(resolveSubmissionHandlerRoute).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalledWith(
      expect.stringContaining("No reference media were detected")
    );
  });

  it("keeps Kling 3 motion strict when references are missing", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
        setIsPromptGenerating: asDispatch(vi.fn()),
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
        setIsPromptGenerating: asDispatch(vi.fn()),
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

      const setIsPromptGenerating = vi.fn();
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
          setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
        await vi.advanceTimersByTimeAsync(30_000);
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

      const setIsPromptGenerating = vi.fn();
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
          setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        model: "fal/flux-2/edit",
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    expect(outputs[0]?.modelId).toBe("fal/flux-2/edit");
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

  it("applies aspect and image resolution overrides during image submission", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

  it("never leaks hidden submission-only prompt text into output prompt", async () => {
    let outputs: StudioOutput[] = [];
    const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        model: "fal-ai/veo3.1",
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
      });
    });

    expect(outputs[0]?.modelId).toBe("fal-ai/nano-banana-pro/edit");
    expect(handleImageModelSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        finalModel: "fal-ai/nano-banana-pro/edit",
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
      expect.stringContaining("did not handle model")
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "fal_submit_not_started",
      })
    );
  });

  it("preserves handler-specific submit failures instead of overriding with submit-not-started", async () => {
    const setOutputs = vi.fn();
    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
    const setIsPromptGenerating = vi.fn();
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
        setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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
      "Session check timed out before provider submit."
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

  it("keeps queued submissions pending, then dispatches into normal task polling", async () => {
    vi.useFakeTimers();
    try {
      let outputs: StudioOutput[] = [];
      const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
        outputs = typeof value === "function" ? value(outputs) : value;
      });

      const setIsPromptGenerating = vi.fn();
      const setUiError = vi.fn();
      const setUiNotice = vi.fn();
      const setSaved = vi.fn();
      const notifyGenerationFailure = vi.fn();
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );
      const startPollingTask = vi.fn();
      const ensureGenerationRecord = vi.fn(async () => null);

      vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
      vi.mocked(handleImageModelSubmission).mockImplementationOnce(
        async ({ startPollingWithGeneration }) => {
          startPollingWithGeneration(undefined, "fal-seedream", undefined, {
            status: "queued",
            code: "GENERATION_QUEUED",
            sourceRef: "src-queued-1",
            generationId: "gen-queued-1",
            pollAfterMs: 500,
          });
          return true;
        }
      );

      const fetchQueueStatusSpy = vi
        .spyOn(falClient, "fetchFalQueueStatus")
        .mockResolvedValueOnce({
          status: "queued",
          generationId: "gen-queued-1",
          sourceRef: "src-queued-1",
          retryAfterMs: 500,
        })
        .mockResolvedValueOnce({
          status: "dispatched",
          generationId: "gen-queued-1",
          sourceRef: "src-queued-1",
          requestId: "req-queued-1",
          provider: "fal",
        });

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
          setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

      expect(outputs[0]?.queueState).toBe("queued");
      expect(outputs[0]?.taskState).toBe("pending");
      expect(outputs[0]?.generationId).toBe("gen-queued-1");
      expect(startPollingTask).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_100);
      });

      expect(fetchQueueStatusSpy).toHaveBeenCalled();
      expect(startPollingTask).toHaveBeenCalledWith(
        "req-queued-1",
        outputs[0]?.id,
        0,
        "fal-seedream"
      );
      expect(outputs[0]?.taskId).toBe("req-queued-1");
      expect(outputs[0]?.taskState).toBe("running");
      expect(outputs[0]?.queueState).toBe("dispatched");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails queued submissions when queue-status reports failure", async () => {
    vi.useFakeTimers();
    try {
      let outputs: StudioOutput[] = [];
      const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
        outputs = typeof value === "function" ? value(outputs) : value;
      });

      const setIsPromptGenerating = vi.fn();
      const setUiError = vi.fn();
      const setUiNotice = vi.fn();
      const setSaved = vi.fn();
      const notifyGenerationFailure = vi.fn();
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );
      const startPollingTask = vi.fn();
      const ensureGenerationRecord = vi.fn(async () => null);

      vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
      vi.mocked(handleImageModelSubmission).mockImplementationOnce(
        async ({ startPollingWithGeneration }) => {
          startPollingWithGeneration(undefined, "fal-seedream", undefined, {
            status: "queued",
            code: "GENERATION_QUEUED",
            sourceRef: "src-queued-fail-1",
            generationId: "gen-queued-fail-1",
            pollAfterMs: 500,
          });
          return true;
        }
      );

      vi.spyOn(falClient, "fetchFalQueueStatus").mockResolvedValueOnce({
        status: "failed",
        generationId: "gen-queued-fail-1",
        sourceRef: "src-queued-fail-1",
        message: "Generation failed while queued.",
      });

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
          setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

      await act(async () => {
        await vi.advanceTimersByTimeAsync(550);
      });

      expect(startPollingTask).not.toHaveBeenCalled();
      expect(notifyGenerationFailure).toHaveBeenCalledWith(
        outputs[0]?.id,
        "Generation failed while queued.",
        "Generation failed while queued."
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fail queued submissions at legacy poll-attempt cap when still within queue wait budget", async () => {
    vi.useFakeTimers();
    try {
      let outputs: StudioOutput[] = [];
      const setOutputs = vi.fn((value: SetStateAction<StudioOutput[]>) => {
        outputs = typeof value === "function" ? value(outputs) : value;
      });

      const setIsPromptGenerating = vi.fn();
      const setUiError = vi.fn();
      const setUiNotice = vi.fn();
      const setSaved = vi.fn();
      const notifyGenerationFailure = vi.fn();
      const updateOutputById = vi.fn(
        (id: string, updater: (item: StudioOutput) => StudioOutput) => {
          outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
        }
      );
      const startPollingTask = vi.fn();
      const ensureGenerationRecord = vi.fn(async () => null);

      vi.mocked(resolveSubmissionHandlerRoute).mockReturnValueOnce("image");
      vi.mocked(handleImageModelSubmission).mockImplementationOnce(
        async ({ startPollingWithGeneration }) => {
          startPollingWithGeneration(undefined, "fal-seedream", undefined, {
            status: "queued",
            code: "GENERATION_QUEUED",
            sourceRef: "src-queued-long-1",
            generationId: "gen-queued-long-1",
            pollAfterMs: 500,
          });
          return true;
        }
      );

      let queueStatusCalls = 0;
      vi.spyOn(falClient, "fetchFalQueueStatus").mockImplementation(async () => {
        queueStatusCalls += 1;
        if (queueStatusCalls <= 181) {
          return {
            status: "queued",
            generationId: "gen-queued-long-1",
            sourceRef: "src-queued-long-1",
            retryAfterMs: 500,
          };
        }
        return {
          status: "dispatched",
          generationId: "gen-queued-long-1",
          sourceRef: "src-queued-long-1",
          requestId: "req-queued-long-1",
          provider: "fal",
        };
      });

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
          setIsPromptGenerating: asDispatch(setIsPromptGenerating),
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

      await act(async () => {
        await vi.advanceTimersByTimeAsync(95_000);
      });

      expect(notifyGenerationFailure).not.toHaveBeenCalled();
      expect(startPollingTask).toHaveBeenCalledWith(
        "req-queued-long-1",
        outputs[0]?.id,
        0,
        "fal-seedream"
      );
      expect(queueStatusCalls).toBeGreaterThan(180);
    } finally {
      vi.useRealTimers();
    }
  });
});

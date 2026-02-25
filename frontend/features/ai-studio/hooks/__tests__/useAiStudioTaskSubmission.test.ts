import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { resolveModelLabel } from "../../logic/stateParsers";
import { useAiStudioTaskSubmission } from "../useAiStudioTaskSubmission";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
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

describe("useAiStudioTaskSubmission", () => {
  const STRICT_EDIT_MODELS = [
    "fal/flux-2/edit",
    "fal/flux-2-pro/edit",
    "fal-ai/nano-banana/edit",
    "fal-ai/nano-banana-pro/edit",
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
    const updateOutputById = vi.fn();
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
    const updateOutputById = vi.fn();
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
    const updateOutputById = vi.fn();
    const startPollingTask = vi.fn();
    const ensureGenerationRecord = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioTaskSubmission({
        aspect: "16:9",
        mode: "video",
        model: "fal-ai/kling-video/v3/pro/image-to-video",
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

    expect(outputs[0]?.modelId).toBe("fal-ai/kling-video/v3/pro/image-to-video");
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
    const updateOutputById = vi.fn();
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
    const updateOutputById = vi.fn();
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
    const updateOutputById = vi.fn();
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
    const updateOutputById = vi.fn();
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
    expect(setUiError).toHaveBeenCalledWith("Reference upload failed: Upload failed");
    expect(startPollingTask).not.toHaveBeenCalled();
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
      const updateOutputById = vi.fn();
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
        await vi.advanceTimersByTimeAsync(10_000);
        await pending;
      });

      expect(outputs[0]?.taskState).toBe("fail");
      expect(outputs[0]?.errorMessageShort).toBe("Preparation timed out.");
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
    const updateOutputById = vi.fn();
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
});

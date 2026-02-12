import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioTaskSubmission } from "../useAiStudioTaskSubmission";
import {
  handleVideoModelSubmission,
  resolveSubmissionHandlerRoute,
} from "../taskSubmissionHandlers";

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
  beforeEach(() => {
    vi.clearAllMocks();
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
});

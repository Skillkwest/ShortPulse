import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PricingParams } from "../../logic/pricingTypes";
import { useAiStudioViewModel } from "../useAiStudioViewModel";

const makeCostParamsForModel =
  (modelId: string) =>
  (overrides?: Omit<PricingParams, "modelId">): PricingParams => ({
    modelId,
    aspect: "16:9",
    durationSeconds: 6,
    resolution: "1080p",
    audio: false,
    ...overrides,
  });

const baseInput = {
  mode: "video" as const,
  model: "fal-ai/kling-video/v3/pro/image-to-video",
  aspect: "16:9",
  prompt: "Animate this character",
  activeOutput: null,
  selectedTool: "video" as const,
  useReferenceImageIndicator: false,
  getDefaultDurationSeconds: () => 6,
  videoDurationSeconds: 6,
  videoResolution: "1080p",
  videoReferenceMode: "motion" as const,
  extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
  imageResolution: "model_default",
  videoGenerateAudio: false,
  balanceCredits: null,
  costParamsForModel: makeCostParamsForModel("fal-ai/kling-video/v3/pro/image-to-video"),
};

describe("useAiStudioViewModel motion guardrails", () => {
  it("blocks generation when both motion inputs are missing", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Add a character image and motion reference video before generating."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("blocks generation when motion video is missing", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Add a motion reference video before generating in Motion Control."
    );
    expect(result.current.referenceImageWarning).toBe(
      "Motion Control requires a motion reference video."
    );
  });

  it("allows generation when both motion inputs are present", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("requires an image in standard video mode", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBe("Add a reference image before generating.");
    expect(result.current.isGenerateDisabled).toBe(true);
    expect(result.current.referenceImageWarning).toBeNull();
  });
});

describe("useAiStudioViewModel edit guardrails", () => {
  const editInput = {
    ...baseInput,
    mode: "image" as const,
    model: "fal-ai/nano-banana/edit",
    selectedTool: "edit" as const,
    videoReferenceMode: "standard" as const,
    motionReferenceVideoUrl: null,
    costParamsForModel: makeCostParamsForModel("fal-ai/nano-banana/edit"),
  };

  it("requires a primary reference image in edit workflow", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        prompt: "Improve color grading",
        referenceImageUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBe("Add a reference image before generating.");
    expect(result.current.isGenerateDisabled).toBe(true);
    expect(result.current.referenceImageWarning).toBe(
      "No reference image detected. Edit workflow requires a reference image and will not fallback to text-to-image."
    );
  });

  it("requires a prompt in edit workflow", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        prompt: "   ",
        referenceImageUrl: "https://example.com/reference.png",
      })
    );

    expect(result.current.generationGuardrail).toBe(
      'Add a prompt in "Write Your Prompt" before generating.'
    );
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("enables generate when model, prompt, and primary image are all present", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        prompt: "Apply cinematic warm tones and increase contrast.",
        referenceImageUrl: "https://example.com/reference.png",
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { computeCostForModel } from "../../logic/pricing";
import type { PricingParams } from "../../logic/pricingTypes";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
} from "../../logic/inpaintSubmission";
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
  it("uses active video settings for prompt-reference generate cost", () => {
    const modelId = "fal-ai/kling-video/v3/pro/image-to-video";
    const costParamsForModel = (overrides?: Omit<PricingParams, "modelId">): PricingParams => ({
      modelId,
      aspect: "16:9",
      durationSeconds: 10,
      resolution: "1080p",
      audio: true,
      ...overrides,
    });
    const activeDurationSeconds = 5;
    const activeAudio = false;
    const expectedCost = computeCostForModel(
      modelId,
      costParamsForModel({
        durationSeconds: activeDurationSeconds,
        resolution: "1080p",
        audio: activeAudio,
      })
    )?.credits;
    const defaultCost = computeCostForModel(modelId, costParamsForModel())?.credits;

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: modelId,
        mode: "video",
        selectedTool: "video",
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
        videoReferenceMode: "standard",
        costParamsForModel,
        videoDurationSeconds: activeDurationSeconds,
        videoResolution: "1080p",
        videoGenerateAudio: activeAudio,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedCost);
    expect(result.current.promptReferenceGenerateCostCredits).not.toBe(defaultCost);
  });

  it("uses image resolution-aware generate cost for create text output generation", () => {
    const modelId = "fal-ai/nano-banana-2";
    const costParamsForModel = (overrides?: Omit<PricingParams, "modelId">): PricingParams => ({
      modelId,
      aspect: "1:1",
      durationSeconds: 8,
      resolution: "1K",
      audio: false,
      ...overrides,
    });
    const expectedCost = computeCostForModel(
      modelId,
      costParamsForModel({ aspect: "1:1", resolution: "4K" })
    )?.credits;

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        prompt: "Turn this into a cinematic portrait",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "4K",
        costParamsForModel,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedCost);
  });

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

  it("does not gate edit workflow on prompt text", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        prompt: "   ",
        referenceImageUrl: "https://example.com/reference.png",
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
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

  it("switches edit cost and credit guardrail to FLUX Fill when inpaint intent is active", () => {
    const selectedModelId = "fal-ai/flux-2/klein/9b";
    const editCostParamsForModel = makeCostParamsForModel(selectedModelId);
    const standardCostCredits = computeCostForModel(
      selectedModelId,
      editCostParamsForModel({ aspect: "1:1", resolution: "model_default" })
    )?.credits;
    const inpaintCostCredits = computeCostForModel(
      INPAINT_FLUX_FILL_MODEL_ID,
      editCostParamsForModel({ aspect: "1:1", resolution: "model_default" })
    )?.credits;
    expect(standardCostCredits).not.toBeNull();
    expect(inpaintCostCredits).not.toBeNull();
    expect(inpaintCostCredits).toBeGreaterThan(standardCostCredits ?? 0);
    const balanceCredits = standardCostCredits ?? 0;

    const markupCostCredits = computeCostForModel(
      MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
      editCostParamsForModel({ aspect: "1:1", resolution: "model_default" })
    )?.credits;
    expect(markupCostCredits).not.toBeNull();
    expect(markupCostCredits).toBeGreaterThan(standardCostCredits ?? 0);

    const { result, rerender } = renderHook(
      ({ intent }: { intent: "standard" | "inpaint" | "markup" }) =>
        useAiStudioViewModel({
          ...editInput,
          model: selectedModelId,
          aspect: "1:1",
          prompt: "Clean up edges and relight subtly",
          referenceImageUrl: "https://example.com/reference.png",
          costParamsForModel: editCostParamsForModel,
          balanceCredits,
          editSubmitIntent: intent,
        }),
      {
        initialProps: { intent: "standard" },
      }
    );

    expect(result.current.currentCostCredits).toBe(standardCostCredits);
    expect(result.current.isCreditGuardrail).toBe(false);
    expect(result.current.generationGuardrail).toBeNull();

    rerender({ intent: "inpaint" });

    expect(result.current.currentCostCredits).toBe(inpaintCostCredits);
    expect(result.current.isCreditGuardrail).toBe(true);
    expect(result.current.generationGuardrail).toBe("You do not have enough credits for this run.");

    rerender({ intent: "markup" });

    expect(result.current.currentCostCredits).toBe(markupCostCredits);
    expect(result.current.isCreditGuardrail).toBe(true);
    expect(result.current.generationGuardrail).toBe("You do not have enough credits for this run.");
  });
});

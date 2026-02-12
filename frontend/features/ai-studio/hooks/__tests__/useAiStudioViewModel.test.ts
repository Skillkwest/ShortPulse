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
});

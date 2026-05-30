import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { computeCostForModel } from "../../logic/pricing";
import type { PricingParams } from "../../logic/pricingTypes";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  INPAINT_REFERENCE_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
} from "../../logic/inpaintSubmission";
import { useAiStudioViewModel } from "../useAiStudioViewModel";

const makeCostParamsForModel =
  (modelId: string) =>
  (
    targetModelIdOrOverrides?: string | Omit<PricingParams, "modelId">,
    maybeOverrides?: Omit<PricingParams, "modelId">
  ): PricingParams => {
    const resolvedModelId =
      typeof targetModelIdOrOverrides === "string" ? targetModelIdOrOverrides : modelId;
    const overrides =
      typeof targetModelIdOrOverrides === "string" ? maybeOverrides : targetModelIdOrOverrides;
    return {
      modelId: resolvedModelId,
      aspect: "16:9",
      durationSeconds: 6,
      resolution: "1080p",
      audio: false,
      ...overrides,
    };
  };

const baseInput = {
  mode: "video" as const,
  model: KIE_KLING_30_MODEL_ID,
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
  klingWorkflowMode: "single" as const,
  klingMultiPrompts: [] as { id: string; prompt: string; duration: number }[],
  seedance2InputMode: "text" as const,
  seedance2ReferenceImageUrls: [] as string[],
  seedance2ReferenceVideoUrls: [] as string[],
  seedance2ReferenceAudioUrls: [] as string[],
  balanceCredits: 999,
  costParamsForModel: makeCostParamsForModel(KIE_KLING_30_MODEL_ID),
};

const editInput = {
  ...baseInput,
  mode: "image" as const,
  model: "fal-ai/nano-banana-2/edit",
  selectedTool: "edit" as const,
  videoReferenceMode: "standard" as const,
  motionReferenceVideoUrl: null,
  costParamsForModel: makeCostParamsForModel("fal-ai/nano-banana-2/edit"),
};

describe("useAiStudioViewModel motion guardrails", () => {
  it("uses active video settings for prompt-reference generate cost", () => {
    const modelId = KIE_KLING_30_MODEL_ID;
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
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
      costParamsForModel(modelId, {
        durationSeconds: activeDurationSeconds,
        resolution: "1080p",
        audio: activeAudio,
      })
    )?.credits;
    const defaultCost = computeCostForModel(modelId, costParamsForModel(modelId))?.credits;

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
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "1:1",
      durationSeconds: 8,
      resolution: "1K",
      audio: false,
      ...overrides,
    });
    const expectedCost = computeCostForModel(
      modelId,
      costParamsForModel(modelId, { aspect: "1:1", resolution: "4K" })
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

  it("keeps create text generation enabled when output-generate cost exceeds balance", () => {
    const modelId = "fal-ai/nano-banana-2";
    const costParamsForModel = makeCostParamsForModel(modelId);
    const requiredCredits =
      computeCostForModel(modelId, costParamsForModel({ aspect: "1:1", resolution: "4K" }))
        ?.credits ?? 0;

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "1:1",
        prompt: "Turn this into a cinematic portrait",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "4K",
        balanceCredits: Math.max(0, requiredCredits - 1),
        costParamsForModel,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(requiredCredits);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("blocks billed create-text generate while spendable credits are still loading", () => {
    const modelId = "fal-ai/nano-banana-2";

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
        costParamsForModel: makeCostParamsForModel(modelId),
        balanceCredits: null,
        balanceLoading: true,
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Loading spendable credits. Retry in a moment."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
    expect(result.current.isCreditGuardrail).toBe(false);
  });

  it("blocks billed edit generate when spendable credit refresh failed", () => {
    const modelId = "fal-ai/nano-banana-pro/edit";

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        model: modelId,
        aspect: "1:1",
        prompt: "Clean up edges and relight subtly",
        referenceImageUrl: "https://example.com/reference.png",
        costParamsForModel: makeCostParamsForModel(modelId),
        balanceCredits: 999,
        balanceError: "Unable to load spendable credit snapshot.",
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Unable to load spendable credits. Retry in a moment."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
    expect(result.current.isCreditGuardrail).toBe(false);
  });

  it("does not block helper-only describe flows when spendable credits are unresolved", () => {
    const modelId = "fal-ai/nano-banana-2";

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        prompt: "Describe this look",
        useReferenceImageIndicator: true,
        referenceImageUrl: "https://example.com/reference.png",
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        costParamsForModel: makeCostParamsForModel(modelId),
        balanceCredits: null,
        balanceLoading: true,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("keeps generation enabled when model pricing policy is unavailable", () => {
    const modelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "image",
        selectedTool: "create",
        model: modelId,
        aspect: "1:1",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "high",
        costParamsForModel: makeCostParamsForModel(modelId),
        pricingPolicyReady: false,
        pricingPolicyLoading: false,
        pricingPolicyError: "Failed to load model pricing policy.",
      })
    );

    expect(result.current.currentCostCredits).toBeNull();
    expect(result.current.promptReferenceGenerateCostCredits).toBeNull();
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("computes model-picker credits from the candidate model defaults instead of the active model", () => {
    const activeModelId = "fal-ai/nano-banana-pro";
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "1:1",
      durationSeconds: 8,
      resolution: "1K",
      audio: false,
      ...overrides,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "image",
        selectedTool: "create",
        model: activeModelId,
        aspect: "1:1",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        imageResolution: "4K",
        costParamsForModel,
      })
    );

    const candidateModelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const expectedCredits = computeCostForModel(
      candidateModelId,
      costParamsForModel(candidateModelId, {
        resolution: "4K",
      })
    )?.credits;

    expect(result.current.resolveModelPickerCredits(candidateModelId)).toBe(expectedCredits);
  });

  it("uses the selected gpt-image-2 quality tier for create image costs", () => {
    const modelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "1:1",
      durationSeconds: 8,
      resolution: "medium",
      audio: false,
      ...overrides,
    });
    const expectedCurrentCost = computeCostForModel(
      modelId,
      costParamsForModel(modelId, { resolution: "high" })
    )?.credits;
    const expectedPromptCost = computeCostForModel(
      modelId,
      costParamsForModel(modelId, { aspect: "9:16", resolution: "high" })
    )?.credits;

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "image",
        selectedTool: "create",
        model: modelId,
        aspect: "9:16",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "high",
        costParamsForModel,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCurrentCost);
    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedPromptCost);
    expect(result.current.promptReferenceGenerateCostCredits).not.toBe(
      result.current.currentCostCredits
    );
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

  it("blocks generation while the motion clip is still uploading", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoPending: true,
        motionReferenceVideoUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Motion clip is still uploading. Retry in a moment."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("blocks generation when the motion clip has a staging error", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoError: "Local motion reference video is no longer available.",
        motionReferenceVideoUrl:
          "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/current.mp4?token=stub",
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Local motion reference video is no longer available."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("blocks generation when a local motion video leaks into Motion Control state", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: "blob:motion-video-123",
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Motion clip is not ready yet. Re-add it and wait for upload before generating."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
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

  it("allows standard video generation without a frame image so the lane can resolve to text", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        costParamsForModel: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID),
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
    expect(result.current.referenceImageWarning).toBeNull();
  });

  it("requires a first frame image when Kling 3.0 is selected in standard video mode", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: "kie-ai/kling-3.0",
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Add a first frame image before generating with Kling 3.0."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
    expect(result.current.referenceImageWarning).toBe(
      "Kling 3.0 requires a first frame image in Standard mode."
    );
  });

  it("shows the billed cost for Kling motion mode when both motion inputs are present", () => {
    const expectedCost = computeCostForModel(
      KIE_KLING_30_MODEL_ID,
      makeCostParamsForModel(KIE_KLING_30_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
      })
    )?.credits;
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_KLING_30_MODEL_ID,
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
        costParamsForModel: makeCostParamsForModel(KIE_KLING_30_MODEL_ID),
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
    expect(result.current.modelPickerCostCredits).toBe(expectedCost);
  });

  it("allows Kling 3.0 standard generation when only the optional last-frame slot is populated", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: "kie-ai/kling-3.0",
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        extraImageUrls: ["https://example.com/last.png", null, null],
        motionReferenceVideoUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
  });

  it("requires at least one custom Kling shot prompt in custom mode", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: "kie-ai/kling-3.0",
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first.png",
        motionReferenceVideoUrl: null,
        klingWorkflowMode: "custom",
        klingMultiPrompts: [{ id: "shot-1", prompt: "   ", duration: 5 }],
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Add at least one custom Kling shot prompt before generating."
    );
  });

  it("allows Kie Veo with a single frame because the lane resolves to single-image", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        videoReferenceMode: "keyframes",
        referenceImageUrl: "https://example.com/first.png",
        extraImageUrls: [null, null, null],
        motionReferenceVideoUrl: null,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("allows standard video generation without a reference for text-to-video models", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        costParamsForModel: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID),
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("uses active Seedance 2 settings when computing the generate-button estimate", () => {
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "16:9",
      durationSeconds: 5,
      resolution: "1080p",
      audio: true,
      ...overrides,
    });
    const expectedCost = computeCostForModel(
      KIE_SEEDANCE_2_MODEL_ID,
      costParamsForModel(KIE_SEEDANCE_2_MODEL_ID, {
        durationSeconds: 5,
        resolution: "1080p",
        inputVideoCount: 0,
      })
    )?.credits;

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first.png",
        extraImageUrls: ["https://example.com/last.png", null, null],
        motionReferenceVideoUrl: null,
        videoDurationSeconds: 5,
        videoResolution: "1080p",
        videoGenerateAudio: true,
        seedance2InputMode: "first-last",
        costParamsForModel,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
  });

  it("uses Seedance 2 Fast video-input pricing when multimodal video references are present", () => {
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "1:1",
      durationSeconds: 10,
      resolution: "720p",
      audio: false,
      ...overrides,
    });
    const expectedCost = computeCostForModel(
      KIE_SEEDANCE_2_FAST_MODEL_ID,
      costParamsForModel(KIE_SEEDANCE_2_FAST_MODEL_ID, {
        durationSeconds: 10,
        resolution: "720p",
        inputVideoCount: 1,
      })
    )?.credits;

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_FAST_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoDurationSeconds: 10,
        videoResolution: "720p",
        videoGenerateAudio: false,
        seedance2InputMode: "multimodal",
        seedance2ReferenceVideoUrls: ["https://example.com/reference.mp4"],
        costParamsForModel,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
  });

  it("blocks Seedance 2.0 multimodal mode when no multimodal references are present", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        seedance2InputMode: "multimodal",
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Add at least one image, video, or audio reference before generating with Seedance 2.0."
    );
    expect(result.current.referenceImageWarning).toBe(
      "Seedance 2.0 multimodal mode requires at least one image, video, or audio reference."
    );
  });

  it("does not require custom shot prompts for stale Seedance 2 custom mode", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        seedance2InputMode: "text",
        klingWorkflowMode: "custom",
        klingMultiPrompts: [],
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
  });

  it("blocks Seedance 2.0 Fast multimodal mode when frame images are mixed with multimodal references", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_FAST_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first.png",
        motionReferenceVideoUrl: null,
        seedance2InputMode: "multimodal",
        seedance2ReferenceVideoUrls: ["https://example.com/reference.mp4"],
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Remove first/last frame images before generating in Seedance 2.0 multimodal mode."
    );
    expect(result.current.referenceImageWarning).toBe(
      "Seedance 2.0 multimodal mode cannot be combined with first/last frame images."
    );
  });

  it("requires both first and last frame images for explicit Seedance 2.0 first-last mode", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first.png",
        motionReferenceVideoUrl: null,
        seedance2InputMode: "first-last",
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Add both first and last frame images before generating with Seedance 2.0."
    );
    expect(result.current.referenceImageWarning).toBe(
      "Seedance 2.0 requires both first and last frame images in first/last-frame mode."
    );
  });

  it("treats linked Seedance assets as valid multimodal references", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        seedance2InputMode: "multimodal",
        klingElements: [
          {
            id: "element-1",
            name: "Red Lantern",
            alias: "redlantern",
            frontalImageUrl: "https://example.com/red-lantern.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("blocks Seedance linked assets when frame images are also present", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_FAST_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first.png",
        motionReferenceVideoUrl: null,
        seedance2InputMode: "multimodal",
        klingElements: [
          {
            id: "element-1",
            name: "Steam Train",
            alias: "steamtrain",
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "https://example.com/steamtrain.mp4",
          },
        ],
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Remove first/last frame images before generating with Seedance 2.0 linked assets."
    );
    expect(result.current.referenceImageWarning).toBe(
      "Seedance 2.0 linked assets cannot be combined with first/last frame images."
    );
  });
});

describe("useAiStudioViewModel edit guardrails", () => {
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
      editCostParamsForModel(selectedModelId, { resolution: "model_default" })
    )?.credits;
    const inpaintCostCredits = computeCostForModel(
      INPAINT_FLUX_FILL_MODEL_ID,
      editCostParamsForModel(INPAINT_FLUX_FILL_MODEL_ID, { resolution: "model_default" })
    )?.credits;
    const markupCostCredits = computeCostForModel(
      MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
      editCostParamsForModel(MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID, {
        resolution: "model_default",
      })
    )?.credits;
    expect(standardCostCredits).not.toBeNull();
    expect(inpaintCostCredits).not.toBeNull();
    expect(markupCostCredits).not.toBeNull();
    const balanceCredits = standardCostCredits ?? 0;

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
    expect(result.current.isCreditGuardrail).toBe(
      (balanceCredits ?? 0) < (inpaintCostCredits ?? 0)
    );
    expect(result.current.generationGuardrail).toBeNull();

    rerender({ intent: "markup" });

    expect(result.current.currentCostCredits).toBe(markupCostCredits);
    expect(result.current.isCreditGuardrail).toBe(true);
    expect(result.current.generationGuardrail).toBeNull();
  });

  it("switches inpaint cost to the reference inpaint model when exactly one linked secondary reference is active", () => {
    const selectedModelId = "fal-ai/flux-2/klein/9b";
    const editCostParamsForModel = makeCostParamsForModel(selectedModelId);
    const fillCostCredits = computeCostForModel(
      INPAINT_FLUX_FILL_MODEL_ID,
      editCostParamsForModel(INPAINT_FLUX_FILL_MODEL_ID, {
        aspect: "1:1",
        resolution: "model_default",
      })
    )?.credits;
    const referenceInpaintCostCredits = computeCostForModel(
      INPAINT_REFERENCE_MODEL_ID,
      editCostParamsForModel(INPAINT_REFERENCE_MODEL_ID, {
        aspect: "1:1",
        resolution: "model_default",
      })
    )?.credits;

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        model: selectedModelId,
        aspect: "1:1",
        prompt: "Put the outfit from @img1 on @main",
        extraImageUrls: ["https://example.com/look.png", null, null],
        referenceImageUrl: "https://example.com/reference.png",
        costParamsForModel: editCostParamsForModel,
        balanceCredits: 10_000,
        editSubmitIntent: "inpaint",
      })
    );

    expect(fillCostCredits).not.toBeNull();
    expect(referenceInpaintCostCredits).not.toBeNull();
    expect(result.current.currentCostCredits).toBe(referenceInpaintCostCredits);
    expect(result.current.currentCostCredits).not.toBe(fillCostCredits);
  });

  it("switches edit cost and credit guardrail to Pulse Markup v1 for markup intent", () => {
    const selectedModelId = "fal-ai/flux-2/klein/9b";
    const editCostParamsForModel = makeCostParamsForModel(selectedModelId);
    const standardCostCredits = computeCostForModel(
      selectedModelId,
      editCostParamsForModel(selectedModelId, { resolution: "model_default" })
    )?.credits;
    const markupCostCredits = computeCostForModel(
      MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
      editCostParamsForModel(MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID, {
        resolution: "model_default",
      })
    )?.credits;
    expect(standardCostCredits).not.toBeNull();
    expect(markupCostCredits).not.toBeNull();
    const balanceCredits = standardCostCredits ?? 0;

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

    rerender({ intent: "markup" });

    expect(result.current.currentCostCredits).toBe(markupCostCredits);
    expect(result.current.isCreditGuardrail).toBe((balanceCredits ?? 0) < (markupCostCredits ?? 0));
    expect(result.current.generationGuardrail).toBeNull();
  });
});

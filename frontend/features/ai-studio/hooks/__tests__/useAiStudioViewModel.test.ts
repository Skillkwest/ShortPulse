import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { computeCostForModel } from "../../logic/pricing";
import type { PricingParams } from "../../logic/pricingTypes";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../../lib/model-runtime/falModelIds";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  INPAINT_REFERENCE_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
} from "../../logic/inpaintSubmission";
import { resolveCreateImageBilledCredits } from "../../../../lib/model-runtime/createImageBilledCredits";
import { resolveEditImageBilledCredits } from "../../../../lib/model-runtime/editImageBilledCredits";
import { resolveVideoBilledCredits } from "../../../../lib/model-runtime/videoBilledCredits";
import { useAiStudioViewModel } from "../useAiStudioViewModel";
import {
  resolvePricingGridBilledCredits,
  resolvePricingGridCostBreakdown,
} from "../../../../lib/model-runtime/pricingGridBilledCredits";
import {
  getDefaultModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../../../lib/model-runtime/pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../../../../lib/model-runtime/materializeImageBilledCreditPolicy";
import type { CharacterModeInjectionBundle } from "../useAiStudioCharacterModeController";
import {
  createEmptyLipSyncAudioState,
  createReadyLipSyncAudioState,
} from "../../logic/lipSyncAudioState";

const pricingGridPolicy = materializeImageBilledCreditPolicy({
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
});

const withVideoBilledCreditsOverride = ({
  modelId,
  params,
  credits,
  pricingPolicy = pricingGridPolicy,
}: {
  modelId: string;
  params: Omit<PricingParams, "modelId">;
  credits: number;
  pricingPolicy?: ModelPricingPolicyDocument;
}): ModelPricingPolicyDocument => {
  const variantId = resolvePricingGridCostBreakdown({
    modelId,
    params,
    pricingPolicy,
  })?.variantId;
  if (!variantId) return pricingPolicy;
  const currentModelPolicy = pricingPolicy.perModel[modelId] ?? {};
  return {
    ...pricingPolicy,
    perModel: {
      ...pricingPolicy.perModel,
      [modelId]: {
        ...currentModelPolicy,
        variants: {
          ...(currentModelPolicy.variants ?? {}),
          [variantId]: {
            ...(currentModelPolicy.variants?.[variantId] ?? {}),
            billedCreditsOverride: credits,
          },
        },
      },
    },
  };
};

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

const baseKlingVideoPricingPolicy = withVideoBilledCreditsOverride({
  modelId: KIE_KLING_30_MODEL_ID,
  params: makeCostParamsForModel(KIE_KLING_30_MODEL_ID)({
    durationSeconds: 6,
    resolution: "1080p",
    audio: false,
  }),
  credits: 42,
});

const baseInput = {
  mode: "video" as const,
  model: KIE_KLING_30_MODEL_ID,
  aspect: "16:9",
  prompt: "Animate this character",
  referenceImageUrl: null,
  activeOutput: null,
  selectedTool: "video" as const,
  useReferenceImageIndicator: false,
  getDefaultDurationSeconds: () => 6,
  videoDurationSeconds: 6,
  videoResolution: "1080p",
  videoReferenceMode: "motion" as const,
  motionReferenceVideoUrl: null,
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
  pricingPolicy: baseKlingVideoPricingPolicy,
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
  it("resolves Generate button pricing for every active video pricing model from the materialized policy", () => {
    [
      {
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        referenceMode: "standard" as const,
      },
      {
        modelId: KIE_KLING_30_MODEL_ID,
        referenceMode: "standard" as const,
      },
      {
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        referenceMode: "standard" as const,
      },
      {
        modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
        referenceMode: "standard" as const,
      },
      {
        modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
        referenceMode: "lip-sync" as const,
      },
    ].forEach(({ modelId, referenceMode }) => {
      const { result } = renderHook(() =>
        useAiStudioViewModel({
          ...baseInput,
          model: modelId,
          videoReferenceMode: referenceMode,
          costParamsForModel: makeCostParamsForModel(modelId),
          pricingPolicy: pricingGridPolicy,
        })
      );

      expect(result.current.currentCostCredits).toBeGreaterThan(0);
      expect(result.current.modelPickerCostCredits).toBeGreaterThan(0);
      expect(result.current.generationGuardrail).not.toBe(
        "Pricing is unavailable for this configuration. Retry in a moment."
      );
    });
  });

  it("uses pricing-grid billed credits for active video settings", () => {
    const modelId = KIE_KLING_30_MODEL_ID;
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "16:9",
      durationSeconds: 8,
      resolution: "1080p",
      audio: true,
      ...overrides,
    });
    const pricingParams = costParamsForModel(modelId, {
      durationSeconds: 5,
      resolution: "1080p",
      audio: false,
    });
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId,
      params: pricingParams,
      credits: 37,
    });
    const expectedCost = resolveVideoBilledCredits({
      modelId,
      params: pricingParams,
      pricingPolicy: videoPricingPolicy,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "video",
        selectedTool: "video",
        model: modelId,
        videoDurationSeconds: 5,
        videoResolution: "1080p",
        videoGenerateAudio: false,
        costParamsForModel,
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
  });

  it("shows the exact Seedance 2 pricing-grid row for the active duration and resolution", () => {
    const modelId = KIE_SEEDANCE_2_MODEL_ID;
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "16:9",
      durationSeconds: 12,
      resolution: "720p",
      audio: true,
      ...overrides,
    });
    const pricingParams = costParamsForModel(modelId, {
      durationSeconds: 12,
      resolution: "720p",
      inputVideoCount: 0,
    });

    expect(
      resolveVideoBilledCredits({
        modelId,
        params: pricingParams,
        pricingPolicy: pricingGridPolicy,
      })
    ).toBe(119);

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "video",
        selectedTool: "video",
        model: modelId,
        videoReferenceMode: "standard",
        videoDurationSeconds: 12,
        videoResolution: "720p",
        videoGenerateAudio: true,
        seedance2InputMode: "multimodal",
        seedance2ReferenceImageUrls: ["https://example.com/seedance-image.png"],
        seedance2ReferenceVideoUrls: [],
        costParamsForModel,
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBe(119);
    expect(result.current.modelPickerCostCredits).toBe(119);
    expect(result.current.generationGuardrail).toBeNull();
  });

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
    const activePricingParams = costParamsForModel(modelId, {
      durationSeconds: activeDurationSeconds,
      resolution: "1080p",
      audio: activeAudio,
    });
    const defaultPricingParams = costParamsForModel(modelId);
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId,
      params: activePricingParams,
      credits: 37,
    });
    const expectedCost = resolveVideoBilledCredits({
      modelId,
      params: activePricingParams,
      pricingPolicy: videoPricingPolicy,
    });
    const defaultCost = resolveVideoBilledCredits({
      modelId,
      params: defaultPricingParams,
      pricingPolicy: videoPricingPolicy,
    });

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
        pricingPolicy: videoPricingPolicy,
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
    const expectedCost = resolvePricingGridBilledCredits({
      modelId,
      params: costParamsForModel(modelId, { aspect: "1:1", resolution: "4K" }),
      pricingPolicy: pricingGridPolicy,
    });

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
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedCost);
  });

  it("preserves Seedream auto resolution ids for create pricing-grid costs", () => {
    const modelId = "fal-ai/bytedance/seedream/v4.5/text-to-image";
    const costParamsForModel = (
      targetModelId: string,
      overrides?: Omit<PricingParams, "modelId">
    ): PricingParams => ({
      modelId: targetModelId,
      aspect: "9:16",
      durationSeconds: 8,
      resolution: "auto_2K",
      audio: false,
      ...overrides,
    });
    const expectedCost = resolvePricingGridBilledCredits({
      modelId,
      params: costParamsForModel(modelId, { aspect: "9:16", resolution: "auto_4K" }),
      pricingPolicy: pricingGridPolicy,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "9:16",
        prompt: "Turn this into a cinematic portrait",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "auto_4K",
        costParamsForModel,
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedCost);
  });

  it("prices GPT Image 2 Create Character Mode from runtime quantity authority when the explicit row is missing", () => {
    const modelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const createCharacterModeInjectionBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Silver-haired warrior",
      sheetReferenceStoragePaths: ["user/chars/look-1.png", "user/chars/look-2.png"],
      sheetReferenceUrls: [
        "https://cdn.shortpulse.test/look-1.png",
        "https://cdn.shortpulse.test/look-2.png",
      ],
      loadedAtMs: Date.now(),
    };
    const expectedCost = resolveCreateImageBilledCredits({
      modelId,
      params: {
        aspect: "16:9",
        resolution: "medium",
        inputImageCount: 3,
        inputFidelity: "high",
        maskPresent: false,
      },
      pricingPolicy: pricingGridPolicy,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "16:9",
        prompt: "Turn this into a cinematic portrait",
        referenceImageUrl: "https://example.com/user-reference.png",
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "medium",
        isCreateCharacterModeEnabled: true,
        createCharacterModeInjectionBundle,
        costParamsForModel: makeCostParamsForModel(modelId),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedCost);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("prices GPT Image 2 Create Character Mode when the effective submit variant has a canonical row", () => {
    const modelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const createCharacterModeInjectionBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Silver-haired warrior",
      sheetReferenceStoragePaths: ["user/chars/look-1.png"],
      sheetReferenceUrls: ["https://cdn.shortpulse.test/look-1.png"],
      loadedAtMs: Date.now(),
    };
    const expectedCost = resolvePricingGridBilledCredits({
      modelId,
      params: {
        aspect: "16:9",
        resolution: "medium",
        inputImageCount: 1,
        inputFidelity: "high",
        maskPresent: false,
      },
      pricingPolicy: pricingGridPolicy,
      requireExplicitBilledCreditsOverride: true,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "16:9",
        prompt: "Turn this into a cinematic portrait",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "medium",
        isCreateCharacterModeEnabled: true,
        createCharacterModeInjectionBundle,
        costParamsForModel: makeCostParamsForModel(modelId),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedCost);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("prices Nano Banana 2 Create Character Mode from the canonical edit row even with multi-look refs", () => {
    const modelId = "fal-ai/nano-banana-2";
    const createCharacterModeInjectionBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Silver-haired warrior",
      sheetReferenceStoragePaths: [
        "user/chars/look-1.png",
        "user/chars/look-2.png",
        "user/chars/look-3.png",
      ],
      sheetReferenceUrls: [
        "https://cdn.shortpulse.test/look-1.png",
        "https://cdn.shortpulse.test/look-2.png",
        "https://cdn.shortpulse.test/look-3.png",
      ],
      loadedAtMs: Date.now(),
    };
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "16:9",
        prompt: "Turn this into a cinematic portrait",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "2K",
        isCreateCharacterModeEnabled: true,
        createCharacterModeInjectionBundle,
        costParamsForModel: makeCostParamsForModel(modelId),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(7);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("keeps ref-driven Nano Banana 2 standard Create on the canonical text row", () => {
    const modelId = "fal-ai/nano-banana-2";

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "16:9",
        prompt: "Create an image of a witch.",
        referenceImageUrl: "https://example.com/user-reference.png",
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "1K",
        isCreateCharacterModeEnabled: false,
        createCharacterModeInjectionBundle: null,
        costParamsForModel: makeCostParamsForModel(modelId),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(5);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("maps GPT Image 2 Create UI resolution labels onto canonical quality rows", () => {
    const modelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const expectedCost = resolvePricingGridBilledCredits({
      modelId,
      params: {
        aspect: "16:9",
        resolution: "medium",
      },
      pricingPolicy: pricingGridPolicy,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "16:9",
        prompt: "Turn this into a cinematic portrait",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "2K",
        costParamsForModel: makeCostParamsForModel(modelId),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedCost);
  });

  it("keeps create text generation enabled when output-generate cost exceeds balance", () => {
    const modelId = "fal-ai/nano-banana-2";
    const costParamsForModel = makeCostParamsForModel(modelId);
    const requiredCredits =
      resolvePricingGridBilledCredits({
        modelId,
        params: costParamsForModel({ aspect: "1:1", resolution: "4K" }),
        pricingPolicy: pricingGridPolicy,
      }) ?? 0;

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
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.promptReferenceGenerateCostCredits).toBe(requiredCredits);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("blocks billed create-text generate while spendable credits are still loading without helper text", () => {
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
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(true);
    expect(result.current.isCreditGuardrail).toBe(false);
  });

  it("blocks billed edit generate when spendable credit refresh failed without helper text", () => {
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
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
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

  it("fails closed when Create text-to-image pricing authority is unavailable", () => {
    const modelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        mode: "text",
        selectedTool: "create",
        model: modelId,
        aspect: "1:1",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        videoReferenceMode: "standard",
        imageResolution: "4K",
        costParamsForModel: makeCostParamsForModel(modelId),
        pricingPolicyReady: false,
        pricingPolicyLoading: false,
        pricingPolicyError: "Failed to load model pricing policy.",
      })
    );

    expect(result.current.currentCostCredits).toBeNull();
    expect(result.current.promptReferenceGenerateCostCredits).toBeNull();
    expect(result.current.generationGuardrail).toBe("Unable to load pricing. Retry in a moment.");
    expect(result.current.isGenerateDisabled).toBe(true);
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
        pricingPolicy: pricingGridPolicy,
      })
    );

    const candidateModelId = OPENAI_GPT_IMAGE_2_MODEL_ID;
    const expectedCredits = resolvePricingGridBilledCredits({
      modelId: candidateModelId,
      params: costParamsForModel(candidateModelId, {
        resolution: "4K",
      }),
      pricingPolicy: pricingGridPolicy,
    });

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
      resolution: "2K",
      audio: false,
      ...overrides,
    });
    const expectedCurrentCost = resolvePricingGridBilledCredits({
      modelId,
      params: costParamsForModel(modelId, { aspect: "9:16", resolution: "4K" }),
      pricingPolicy: pricingGridPolicy,
    });
    const expectedPromptCost = resolvePricingGridBilledCredits({
      modelId,
      params: costParamsForModel(modelId, { aspect: "9:16", resolution: "4K" }),
      pricingPolicy: pricingGridPolicy,
    });

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
        imageResolution: "4K",
        costParamsForModel,
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCurrentCost);
    expect(result.current.promptReferenceGenerateCostCredits).toBe(expectedPromptCost);
    expect(result.current.promptReferenceGenerateCostCredits).toBe(
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

  it("allows promptless generation when both motion inputs are present", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        prompt: "",
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("allows standard video generation without a frame image so the lane can resolve to text", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      params: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
      }),
      credits: 46,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        costParamsForModel: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
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

  it("blocks Kling 3.0 standard generation when a visible linked element has only one image", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_KLING_30_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first-frame.png",
        motionReferenceVideoUrl: null,
        klingElements: [
          {
            id: "element-1",
            slotIndex: 0,
            sourceKind: "element",
            sourceElementId: "element-1",
            sourceCharacterId: null,
            name: "Red Lantern",
            alias: "redlantern",
            description: "",
            profileImageUrl: "https://example.com/red-lantern-profile.png",
            frontalImageUrl: "https://example.com/red-lantern-front.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Kling element Red Lantern needs at least 2 image references before generating."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("does not block Kling 3.0 for hidden Seedance direct images or slots beyond Kling's first three", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_KLING_30_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first-frame.png",
        motionReferenceVideoUrl: null,
        klingElements: [
          {
            id: "image-ref-1",
            slotIndex: 0,
            sourceKind: "reference-image",
            sourceElementId: null,
            sourceCharacterId: null,
            name: "Image reference",
            alias: "",
            description: "",
            profileImageUrl: "https://example.com/direct-image.png",
            frontalImageUrl: "https://example.com/direct-image.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
          {
            id: "seedance-slot-four",
            slotIndex: 3,
            sourceKind: "element",
            sourceElementId: "element-4",
            sourceCharacterId: null,
            name: "Seedance Only",
            alias: "seedanceonly",
            description: "",
            profileImageUrl: "https://example.com/seedance-only-profile.png",
            frontalImageUrl: "https://example.com/seedance-only-front.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("shows the billed cost for Kling motion mode when both motion inputs are present", () => {
    const pricingParams = makeCostParamsForModel(KIE_KLING_30_MODEL_ID)({
      durationSeconds: 6,
      resolution: "1080p",
      audio: false,
    });
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_KLING_30_MODEL_ID,
      params: pricingParams,
      credits: 42,
    });
    const expectedCost = resolveVideoBilledCredits({
      modelId: KIE_KLING_30_MODEL_ID,
      params: pricingParams,
      pricingPolicy: videoPricingPolicy,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_KLING_30_MODEL_ID,
        referenceImageUrl: "https://example.com/character.png",
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
        costParamsForModel: makeCostParamsForModel(KIE_KLING_30_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
    expect(result.current.modelPickerCostCredits).toBe(expectedCost);
  });

  it("requires a first frame for Kling 3.0 standard generation even when the last-frame slot is populated", () => {
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

    expect(result.current.generationGuardrail).toBe(
      "Add a first frame image before generating with Kling 3.0."
    );
    expect(result.current.referenceImageWarning).toBe(
      "Kling 3.0 requires a first frame image in Standard mode."
    );
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
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      params: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
      }),
      credits: 46,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        videoReferenceMode: "keyframes",
        referenceImageUrl: "https://example.com/first.png",
        extraImageUrls: [null, null, null],
        motionReferenceVideoUrl: null,
        costParamsForModel: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("allows standard video generation without a reference for text-to-video models", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      params: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
      }),
      credits: 46,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_VEO_31_FAST_I2V_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        motionReferenceVideoUrl: null,
        costParamsForModel: makeCostParamsForModel(KIE_VEO_31_FAST_I2V_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
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
    const pricingParams = costParamsForModel(KIE_SEEDANCE_2_MODEL_ID, {
      durationSeconds: 5,
      resolution: "1080p",
      inputVideoCount: 0,
    });
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      params: pricingParams,
      credits: 43,
    });
    const expectedCost = resolveVideoBilledCredits({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      params: pricingParams,
      pricingPolicy: videoPricingPolicy,
    });

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
        pricingPolicy: videoPricingPolicy,
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
    const pricingParams = costParamsForModel(KIE_SEEDANCE_2_FAST_MODEL_ID, {
      durationSeconds: 10,
      resolution: "720p",
      inputVideoCount: 1,
    });
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params: pricingParams,
      credits: 44,
    });
    const expectedCost = resolveVideoBilledCredits({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params: pricingParams,
      pricingPolicy: videoPricingPolicy,
    });

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
        pricingPolicy: videoPricingPolicy,
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
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      params: makeCostParamsForModel(KIE_SEEDANCE_2_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
        inputVideoCount: 0,
      }),
      credits: 43,
    });
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
        costParamsForModel: makeCostParamsForModel(KIE_SEEDANCE_2_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
  });

  it("allows Seedance 2.0 Fast multimodal mode to override stale frame images", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params: makeCostParamsForModel(KIE_SEEDANCE_2_FAST_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
        inputVideoCount: 1,
      }),
      credits: 44,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_SEEDANCE_2_FAST_MODEL_ID,
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first.png",
        motionReferenceVideoUrl: null,
        seedance2InputMode: "multimodal",
        seedance2ReferenceVideoUrls: ["https://example.com/reference.mp4"],
        costParamsForModel: makeCostParamsForModel(KIE_SEEDANCE_2_FAST_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
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
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      params: makeCostParamsForModel(KIE_SEEDANCE_2_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
        inputVideoCount: 0,
      }),
      credits: 43,
    });
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
        costParamsForModel: makeCostParamsForModel(KIE_SEEDANCE_2_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("treats direct Seedance image-reference slots as valid multimodal references", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      params: makeCostParamsForModel(KIE_SEEDANCE_2_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
        inputVideoCount: 0,
      }),
      credits: 43,
    });
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
            id: "image-ref-1",
            slotIndex: 0,
            sourceKind: "reference-image",
            sourceElementId: null,
            sourceCharacterId: null,
            name: "Image reference",
            alias: "",
            description: "",
            profileImageUrl: "https://example.com/direct-image.png",
            profileImageTransform: null,
            frontalImageUrl: "https://example.com/direct-image.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
        costParamsForModel: makeCostParamsForModel(KIE_SEEDANCE_2_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("allows Seedance linked assets to override stale frame images", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params: makeCostParamsForModel(KIE_SEEDANCE_2_FAST_MODEL_ID)({
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
        inputVideoCount: 1,
      }),
      credits: 44,
    });
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
        costParamsForModel: makeCostParamsForModel(KIE_SEEDANCE_2_FAST_MODEL_ID),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.referenceImageWarning).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });
});

describe("useAiStudioViewModel lip sync guardrails", () => {
  it("prices Lip Sync against OmniHuman audio duration when the selected model is stale", () => {
    const pricingParams = makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID)({
      durationSeconds: 12,
      resolution: "720p",
      audio: true,
    });
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: pricingParams,
      credits: 45,
    });
    const expectedCost = resolveVideoBilledCredits({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: pricingParams,
      pricingPolicy: videoPricingPolicy,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_KLING_30_MODEL_ID,
        costParamsForModel: makeCostParamsForModel(KIE_KLING_30_MODEL_ID),
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        videoResolution: "720p",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 12_400,
          sourceKind: "library",
        }),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("passes selected Lip Sync resolution into hidden OmniHuman pricing params", () => {
    const costParamsForModel = vi.fn(makeCostParamsForModel(KIE_KLING_30_MODEL_ID));

    renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: KIE_KLING_30_MODEL_ID,
        costParamsForModel,
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        videoResolution: "720p",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 4_000,
          sourceKind: "library",
        }),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(costParamsForModel).toHaveBeenCalledWith(
      FAL_OMNIHUMAN_V15_MODEL_ID,
      expect.objectContaining({
        durationSeconds: 4,
        resolution: "720p",
        audio: true,
      })
    );
  });

  it("blocks generation until voice audio is present", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: FAL_OMNIHUMAN_V15_MODEL_ID,
        costParamsForModel: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID),
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        lipSyncAudio: createEmptyLipSyncAudioState(),
      })
    );

    expect(result.current.generationGuardrail).toBe("Add voice audio before generating Lip Sync.");
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("allows generation when character reference and voice audio are present", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID)({
        durationSeconds: 12.4,
        resolution: "1080p",
        audio: true,
      }),
      credits: 45,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: FAL_OMNIHUMAN_V15_MODEL_ID,
        costParamsForModel: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID),
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 12_400,
          sourceKind: "library",
        }),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("allows Lip Sync when voice audio has storage authority without a playback URL", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID)({
        durationSeconds: 12.4,
        resolution: "1080p",
        audio: true,
      }),
      credits: 45,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: FAL_OMNIHUMAN_V15_MODEL_ID,
        costParamsForModel: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID),
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: null,
          storagePath: "user-1/audio/reference-grid/voice.mp3",
          durationMs: 12_400,
          sourceKind: "library",
        }),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("blocks 1080p Lip Sync when voice audio is 30 seconds or longer", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: FAL_OMNIHUMAN_V15_MODEL_ID,
        costParamsForModel: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID),
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        videoResolution: "1080p",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 30_000,
          sourceKind: "library",
        }),
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Use voice audio under 30 seconds for 1080p Lip Sync, or switch to 720p for audio up to 60 seconds."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("allows 720p Lip Sync for voice audio under 60 seconds", () => {
    const videoPricingPolicy = withVideoBilledCreditsOverride({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID)({
        durationSeconds: 45,
        resolution: "720p",
        audio: true,
      }),
      credits: 45,
    });
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: FAL_OMNIHUMAN_V15_MODEL_ID,
        costParamsForModel: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID),
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        videoResolution: "720p",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 45_000,
          sourceKind: "library",
        }),
        pricingPolicy: videoPricingPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("blocks 720p Lip Sync when voice audio is 60 seconds or longer", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...baseInput,
        model: FAL_OMNIHUMAN_V15_MODEL_ID,
        costParamsForModel: makeCostParamsForModel(FAL_OMNIHUMAN_V15_MODEL_ID),
        referenceImageUrl: "https://example.com/character.jpg",
        videoReferenceMode: "lip-sync",
        videoResolution: "720p",
        lipSyncAudio: createReadyLipSyncAudioState({
          url: "https://example.com/voice.mp3",
          durationMs: 60_000,
          sourceKind: "library",
        }),
      })
    );

    expect(result.current.generationGuardrail).toBe(
      "Use voice audio under 60 seconds for 720p Lip Sync."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
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
        pricingPolicy: pricingGridPolicy,
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
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("prices GPT Image 2 Edit from the canonical billed row", () => {
    const expectedCost = resolveEditImageBilledCredits({
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      params: {
        aspect: "16:9",
        resolution: "medium",
        inputImageCount: 1,
      },
      pricingPolicy: pricingGridPolicy,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        model: OPENAI_GPT_IMAGE_2_MODEL_ID,
        aspect: "16:9",
        prompt: "Restyle the portrait subtly.",
        referenceImageUrl: "https://example.com/reference.png",
        imageResolution: "2K",
        costParamsForModel: makeCostParamsForModel(OPENAI_GPT_IMAGE_2_MODEL_ID),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
    expect(result.current.modelPickerCostCredits).toBe(expectedCost);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("keeps GPT Image 2 Edit blocked when the effective edit variant lacks a billed-credit row", () => {
    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        model: OPENAI_GPT_IMAGE_2_MODEL_ID,
        aspect: "16:9",
        prompt: "Restyle the portrait subtly.",
        referenceImageUrl: "https://example.com/reference.png",
        extraImageUrls: ["https://example.com/look.png", null, null],
        imageResolution: "2K",
        costParamsForModel: makeCostParamsForModel(OPENAI_GPT_IMAGE_2_MODEL_ID),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBeNull();
    expect(result.current.generationGuardrail).toBe(
      "Pricing is unavailable for this configuration. Retry in a moment."
    );
    expect(result.current.isGenerateDisabled).toBe(true);
  });

  it("prices Nano Banana 2 Edit from the canonical billed row even with extra refs", () => {
    const expectedCost = resolveEditImageBilledCredits({
      modelId: "fal-ai/nano-banana-2/edit",
      params: {
        aspect: "16:9",
        resolution: "2K",
        inputImageCount: 2,
      },
      pricingPolicy: pricingGridPolicy,
    });

    const { result } = renderHook(() =>
      useAiStudioViewModel({
        ...editInput,
        model: "fal-ai/nano-banana-2/edit",
        aspect: "16:9",
        prompt: "Restyle the portrait subtly.",
        referenceImageUrl: "https://example.com/reference.png",
        extraImageUrls: ["https://example.com/look.png", null, null],
        imageResolution: "2K",
        costParamsForModel: makeCostParamsForModel("fal-ai/nano-banana-2/edit"),
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(result.current.currentCostCredits).toBe(expectedCost);
    expect(result.current.generationGuardrail).toBeNull();
    expect(result.current.isGenerateDisabled).toBe(false);
  });

  it("keeps standard edit pricing when inpaint intent is requested while inpaint is disabled", () => {
    const selectedModelId = "fal-ai/nano-banana-2/edit";
    const editCostParamsForModel = makeCostParamsForModel(selectedModelId);
    const standardCostCredits = resolveEditImageBilledCredits({
      modelId: selectedModelId,
      params: {
        aspect: "1:1",
        inputImageCount: 1,
      },
      pricingPolicy: pricingGridPolicy,
    });
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
          pricingPolicy: pricingGridPolicy,
        }),
      {
        initialProps: { intent: "standard" },
      }
    );

    expect(result.current.currentCostCredits).toBe(standardCostCredits);
    expect(result.current.isCreditGuardrail).toBe(false);
    expect(result.current.generationGuardrail).toBeNull();

    rerender({ intent: "inpaint" });

    expect(result.current.currentCostCredits).toBe(standardCostCredits);
    expect(result.current.isCreditGuardrail).toBe(false);
    expect(result.current.generationGuardrail).toBeNull();

    rerender({ intent: "markup" });

    expect(result.current.currentCostCredits).toBe(standardCostCredits);
    expect(result.current.isCreditGuardrail).toBe(false);
    expect(result.current.generationGuardrail).toBeNull();
  });

  it("ignores reference-inpaint pricing when inpaint is disabled", () => {
    const selectedModelId = "fal-ai/nano-banana-2/edit";
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
    const standardCostCredits = resolveEditImageBilledCredits({
      modelId: selectedModelId,
      params: {
        aspect: "1:1",
        inputImageCount: 2,
      },
      pricingPolicy: pricingGridPolicy,
    });

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
        pricingPolicy: pricingGridPolicy,
      })
    );

    expect(fillCostCredits).not.toBeNull();
    expect(referenceInpaintCostCredits).not.toBeNull();
    expect(result.current.currentCostCredits).toBe(standardCostCredits);
    expect(result.current.currentCostCredits).not.toBe(referenceInpaintCostCredits);
  });

  it("keeps standard edit cost and guardrails when hidden markup intent is requested", () => {
    const selectedModelId = "fal-ai/nano-banana-2/edit";
    const editCostParamsForModel = makeCostParamsForModel(selectedModelId);
    const standardCostCredits = resolveEditImageBilledCredits({
      modelId: selectedModelId,
      params: {
        aspect: "1:1",
        inputImageCount: 1,
      },
      pricingPolicy: pricingGridPolicy,
    });
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
          pricingPolicy: pricingGridPolicy,
        }),
      {
        initialProps: { intent: "standard" },
      }
    );

    expect(result.current.currentCostCredits).toBe(standardCostCredits);
    expect(result.current.isCreditGuardrail).toBe(false);
    expect(result.current.generationGuardrail).toBeNull();

    rerender({ intent: "markup" });

    expect(result.current.currentCostCredits).toBe(standardCostCredits);
    expect(result.current.isCreditGuardrail).toBe(false);
    expect(result.current.generationGuardrail).toBeNull();
  });
});

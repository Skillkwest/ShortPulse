/**
 * Protects admin pricing-grid invariants where unit rates must stay stable
 * while totals scale linearly with the current usage input.
 */
import { describe, expect, it } from "vitest";
import { buildModelEconomicsRows } from "../pricingAnalysis";
import { buildDraftPricingPreviewVariants } from "../pricingCostDocs";
import { getModelRateSourceInputMode, getRateSourceCostUsd } from "../pricingWorkbookMath";
import { getModelUsageRateMultiplier } from "../pricingDrafts";
import type { AdminPricingModelRow } from "../types";
import { getDefaultModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import {
  KIE_KLING_30_MOTION_CONTROL_LABEL,
  KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
} from "../../../lib/model-runtime/klingMotionControlPricing";
import {
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_LABEL,
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_LABEL,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
} from "../../../lib/model-runtime/elevenLabsModels";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";

const buildModelRow = (overrides: Partial<AdminPricingModelRow>): AdminPricingModelRow =>
  ({
    id: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/api",
    workflowType: "Text to image",
    pricingStrategy: "nano-banana-2-per-image",
    pricingStrategyLabel: "Per image",
    defaultAspect: "auto",
    allowedAspects: ["auto"],
    defaultResolution: "1K",
    allowedResolutions: ["1K"],
    defaultDurationSeconds: null,
    defaultSourceDurationSeconds: null,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    allowedDurations: [],
    defaultAudio: null,
    roundingIncrement: 1,
    pricingAuthority: "shared_policy",
    pricingPreview: {
      usdRaw: 0.08,
      rawCredits: 8,
      billedCredits: 13,
      billedUsd: 0.13,
    },
    pricingPreviewVariants: [
      {
        id: "default",
        label: "Default",
        breakdown: {
          usdRaw: 0.08,
          rawCredits: 8,
          billedCredits: 13,
          billedUsd: 0.13,
        },
      },
    ],
    ...overrides,
  }) as AdminPricingModelRow;

describe("pricing grid invariants", () => {
  it("adds Kling 3.0 Motion Control as a dedicated resolution and audio row family", () => {
    const pricingPolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      global: {
        ...getDefaultModelPricingPolicyDocument().global,
        creditUsdScale: 30,
      },
    };
    const model = buildModelRow({
      id: KIE_KLING_30_MODEL_ID,
      label: "Kling 3.0",
      provider: "kie",
      sourceUrl: "https://docs.kie.ai/market/kling/kling-3-0",
      workflowType: "Image to video",
      pricingStrategy: "kling-3-per-second",
      pricingStrategyLabel: "Per output second",
      defaultAspect: "16:9",
      allowedAspects: ["16:9", "9:16", "1:1"],
      defaultResolution: "1080p",
      allowedResolutions: ["720p", "1080p"],
      defaultDurationSeconds: 10,
      minDurationSeconds: 3,
      maxDurationSeconds: 15,
      defaultAudio: true,
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Standard",
          breakdown: {
            usdRaw: 1.35,
            rawCredits: 41,
            billedCredits: 41,
            billedUsd: 1.3666666666666667,
          },
        },
        {
          id: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
          label: KIE_KLING_30_MOTION_CONTROL_LABEL,
          breakdown: {
            usdRaw: 1.35,
            rawCredits: 41,
            billedCredits: 41,
            billedUsd: 1.3666666666666667,
          },
        },
      ],
    });

    const rows = buildDraftPricingPreviewVariants(model, pricingPolicy);
    const motionRows = rows.filter((row) =>
      row.id.startsWith(`${KIE_KLING_30_MOTION_CONTROL_VARIANT_ID}|`)
    );

    expect(motionRows.map((row) => row.id)).toEqual([
      "motion_control|res:1080p|audio:on",
      "motion_control|res:1080p|audio:off",
      "motion_control|res:720p|audio:on",
      "motion_control|res:720p|audio:off",
    ]);
    expect(motionRows.every((row) => row.label === KIE_KLING_30_MOTION_CONTROL_LABEL)).toBe(true);
    expect(motionRows.every((row) => row.aspect == null)).toBe(true);
  });

  it("keeps Seedance duration as a usage input instead of expanding duration variants", () => {
    const pricingPolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      global: {
        ...getDefaultModelPricingPolicyDocument().global,
        creditUsdScale: 30,
      },
    };
    const model = buildModelRow({
      id: KIE_SEEDANCE_2_MODEL_ID,
      label: "Seedance 2.0",
      provider: "kie",
      sourceUrl: "https://docs.kie.ai/market/bytedance/seedance-2",
      workflowType: "Image to video",
      pricingStrategy: "seedance-2-per-second",
      pricingStrategyLabel: "Per output second",
      defaultAspect: "16:9",
      allowedAspects: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
      defaultResolution: "1080p",
      allowedResolutions: ["1080p", "720p", "480p"],
      defaultDurationSeconds: 5,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      defaultAudio: true,
    });
    const rows = buildDraftPricingPreviewVariants(model, pricingPolicy, { usageAmount: 12 });
    const row = rows.find(
      (candidate) => candidate.id === "default|res:720p|aspect:16:9|audio:on|video_input:none"
    );
    const rowAtFifteenSeconds = buildDraftPricingPreviewVariants(model, pricingPolicy, {
      usageAmount: 15,
    }).find((candidate) => candidate.id === row?.id);

    expect(rows).toHaveLength(6);
    expect(row).toMatchObject({
      resolution: "720p",
      breakdown: {
        billedCredits: 119,
      },
    });
    expect(rowAtFifteenSeconds?.id).toBe(row?.id);

    const economicsRows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
      durationDrafts: {
        [model.id]: "12",
      },
    });

    expect(economicsRows.find((candidate) => candidate.variantId === row?.id)).toMatchObject({
      durationSeconds: 12,
      billedCredits: 119,
    });

    const economicsRowsAtFifteenSeconds = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
      durationDrafts: {
        [model.id]: "15",
      },
    });

    expect(
      economicsRowsAtFifteenSeconds.find((candidate) => candidate.variantId === row?.id)
    ).toMatchObject({
      durationSeconds: 15,
      billedCredits: 149,
    });

    const neutralPolicy = {
      ...pricingPolicy,
      perModel: {
        [model.id]: {
          billingVariantProfile: "seedance_composition_neutral_v1" as const,
        },
      },
    };
    const neutralRows = buildDraftPricingPreviewVariants(model, neutralPolicy, {
      usageAmount: 12,
    });

    expect(neutralRows).toHaveLength(3);
    expect(neutralRows.every((candidate) => !candidate.id.includes("video_input:"))).toBe(true);
    expect(neutralRows.every((candidate) => candidate.videoInput == null)).toBe(true);
  });

  it("keeps per-image rate fixed while amount scales total provider cost", () => {
    const model = buildModelRow({});
    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy: getDefaultModelPricingPolicyDocument(),
      durationDrafts: {
        [model.id]: "15",
      },
    });
    const row = rows[0];

    expect(row).toMatchObject({
      usageValueLabel: "15",
      providerCostUsd: 1.2,
    });
    expect(
      getRateSourceCostUsd({
        rateSourceInputMode: getModelRateSourceInputMode(model),
        providerCostUsd: row?.providerCostUsd,
        providerCostUsdPerSecond: row?.costPerSecondUsd,
        durationSeconds: row?.durationSeconds,
        usageRateMultiplier: getModelUsageRateMultiplier(model, 15),
      })
    ).toBe(0.08);
  });

  it("keeps per-second rate fixed while duration scales total provider cost", () => {
    const model = buildModelRow({
      id: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
      label: "ElevenLabs Sound Effects",
      provider: "elevenlabs",
      sourceUrl: "https://elevenlabs.io/docs/overview/capabilities/sound-effects",
      workflowType: "Text to sound",
      pricingStrategy: "elevenlabs-sound-effect",
      pricingStrategyLabel: "Per second",
      defaultResolution: null,
      allowedResolutions: [],
      defaultDurationSeconds: null,
      minDurationSeconds: 0.5,
      maxDurationSeconds: 30,
      pricingPreview: {
        usdRaw: 0.12,
        rawCredits: 20,
        billedCredits: 20,
        billedUsd: 0.2,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_LABEL,
          breakdown: {
            usdRaw: 0.12,
            rawCredits: 20,
            billedCredits: 20,
            billedUsd: 0.2,
          },
        },
        {
          id: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
          label: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_LABEL,
          breakdown: {
            usdRaw: 0.066,
            rawCredits: 11,
            billedCredits: 11,
            billedUsd: 0.11,
          },
        },
      ],
    });
    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy: getDefaultModelPricingPolicyDocument(),
      durationDrafts: {
        [model.id]: "10",
      },
    });
    const row = rows.find((candidate) =>
      candidate.variantId.startsWith(ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID)
    );

    expect(row).toMatchObject({
      durationSeconds: 10,
      providerCostUsd: 0.132,
      costPerSecondUsd: 0.0132,
    });
    expect(
      rows.find((candidate) =>
        candidate.variantId.startsWith(ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID)
      )
    ).toMatchObject({
      durationSeconds: null,
      providerCostUsd: 0.12,
    });
    expect(
      getRateSourceCostUsd({
        rateSourceInputMode: getModelRateSourceInputMode(model),
        providerCostUsd: row?.providerCostUsd,
        providerCostUsdPerSecond: row?.costPerSecondUsd,
        durationSeconds: row?.durationSeconds,
      })
    ).toBe(0.0132);
  });

  it("keeps the OpenAI per-50,000-character rate fixed while character usage scales total provider cost", () => {
    const model = buildModelRow({
      id: "gpt-5.4-pro",
      label: "GPT-5.4 Pro",
      provider: "openai",
      sourceUrl: "https://openai.com/api/pricing/",
      workflowType: "Text to text",
      pricingStrategy: "openai-text-token",
      pricingStrategyLabel: "Per 50,000 characters",
      defaultResolution: null,
      allowedResolutions: [],
      pricingPreview: {
        usdRaw: 2.8,
        rawCredits: 84,
        billedCredits: 84,
        billedUsd: 2.8,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 2.8,
            rawCredits: 84,
            billedCredits: 84,
            billedUsd: 2.8,
          },
        },
      ],
    });
    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy: getDefaultModelPricingPolicyDocument(),
      durationDrafts: {
        [model.id]: "100000",
      },
    });
    const row = rows.find((candidate) => candidate.specLabel === "Blended characters");

    expect(row?.usageValueLabel).toBe("100,000");
    expect(row?.providerCostUsd).toBeCloseTo(3.38, 4);
    expect(
      getRateSourceCostUsd({
        rateSourceInputMode: getModelRateSourceInputMode(model),
        providerCostUsd: row?.providerCostUsd,
        providerCostUsdPerSecond: row?.costPerSecondUsd,
        durationSeconds: row?.durationSeconds,
        usageRateMultiplier: getModelUsageRateMultiplier(model, 100000),
      })
    ).toBeCloseTo(1.69, 4);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildModelEconomicsRows,
  buildUsageMixAnalysisRows,
  computePlanEconomicsSummary,
  type UsageMixDraftRow,
} from "../pricingAnalysis";
import type { AdminPricingModelRow } from "../types";
import { getDefaultModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { buildModelPricingVariantId } from "../../../lib/model-runtime/modelPricingVariants";

const buildModelRow = (overrides: Partial<AdminPricingModelRow>): AdminPricingModelRow =>
  ({
    id: "fal-ai/flux-2/klein/9b",
    label: "FLUX.2 Lite",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/klein/9b/api",
    workflowType: "Text to image",
    pricingStrategy: "fal-economy-image-per-mp",
    pricingStrategyLabel: "fal-economy-image-per-mp",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "16:9"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    defaultDurationSeconds: null,
    defaultSourceDurationSeconds: null,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    allowedDurations: [],
    defaultAudio: null,
    roundingIncrement: 5,
    pricingAuthority: "shared_policy",
    pricingPreview: {
      usdRaw: 0.08,
      rawCredits: 8,
      billedCredits: 10,
      billedUsd: 0.1,
    },
    pricingPreviewVariants: [
      {
        id: "default",
        label: "Default",
        breakdown: {
          usdRaw: 0.08,
          rawCredits: 8,
          billedCredits: 10,
          billedUsd: 0.1,
        },
      },
    ],
    ...overrides,
  }) as AdminPricingModelRow;

describe("pricingAnalysis", () => {
  it("computes plan economics after discount, processor fees, and affiliate share", () => {
    const summary = computePlanEconomicsSummary({
      priceUsd: "49.00",
      includedCredits: "1500",
      discountPct: "10",
      affiliatePct: "20",
      processorPct: "2.9",
      processorFlatUsd: "0.30",
    });

    expect(summary.grossUsd).toBeCloseTo(49, 6);
    expect(summary.discountAmountUsd).toBeCloseTo(4.9, 6);
    expect(summary.afterDiscountUsd).toBeCloseTo(44.1, 6);
    expect(summary.processorFeeUsd).toBeCloseTo(1.5789, 6);
    expect(summary.effectiveRevenueUsd).toBeCloseTo(42.5211, 6);
    expect(summary.affiliateCostUsd).toBeCloseTo(8.50422, 6);
    expect(summary.netRevenueUsd).toBeCloseTo(34.01688, 6);
    expect(summary.dollarPerCredit).toBeCloseTo(34.01688 / 1500, 6);
    expect(summary.includedCredits).toBe(1500);
  });

  it("keeps usage-mix monthly revenue capped to the plan net revenue", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const models = [buildModelRow({})];
    const planSummary = computePlanEconomicsSummary({
      priceUsd: "39.00",
      includedCredits: "3000",
      discountPct: "0",
      affiliatePct: "0",
      processorPct: "2.9",
      processorFlatUsd: "0.30",
    });

    const usageRows: UsageMixDraftRow[] = [
      {
        id: "row-1",
        modelId: models[0].id,
        variantId: "default",
        durationSeconds: "",
        runsPerMonth: "1000",
      },
    ];

    const analysisRows = buildUsageMixAnalysisRows({
      rows: usageRows,
      models,
      pricingPolicy,
      planSummary,
    });

    expect(analysisRows).toHaveLength(1);
    expect(analysisRows[0]?.revenuePerMonthUsd).toBeCloseTo(planSummary.netRevenueUsd ?? 0, 6);
  });

  it("preserves server-provided economics for non-shared pricing rows", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const rows = buildModelEconomicsRows({
      models: [
        buildModelRow({
          id: "other/manual-model",
          label: "Manual Model",
          provider: "other",
          pricingAuthority: "metadata_only",
          pricingPreview: {
            usdRaw: 1.5,
            rawCredits: 150,
            billedCredits: 225,
            billedUsd: 2.25,
          },
          pricingPreviewVariants: [
            {
              id: "default",
              label: "Default",
              breakdown: {
                usdRaw: 1.5,
                rawCredits: 150,
                billedCredits: 225,
                billedUsd: 2.25,
              },
            },
          ],
        }),
      ],
      pricingPolicy,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      creditsAtCost: 150,
      billedCredits: 225,
      billedUsd: 2.25,
      markupBps: null,
      roundingIncrement: null,
    });
  });

  it("feeds duration draft overrides into model economics projections", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "eleven_multilingual_sts_v2",
      label: "ElevenLabs Voice Changer",
      provider: "elevenlabs",
      workflowType: "Text",
      pricingStrategy: "elevenlabs-voice-changer-per-minute",
      pricingStrategyLabel: "elevenlabs-voice-changer-per-minute",
      defaultDurationSeconds: null,
      defaultSourceDurationSeconds: 60,
      minDurationSeconds: 1,
      maxDurationSeconds: 600,
      allowedDurations: [],
      pricingPreview: {
        usdRaw: 0.6,
        rawCredits: 60,
        billedCredits: 60,
        billedUsd: 0.6,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.6,
            rawCredits: 60,
            billedCredits: 60,
            billedUsd: 0.6,
          },
        },
      ],
    });

    const liveRow = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    })[0];
    const draftRow = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
      durationDrafts: {
        [model.id]: "30",
      },
    })[0];

    expect(liveRow?.durationSeconds).toBe(60);
    expect(draftRow?.durationSeconds).toBe(30);
    expect(draftRow?.creditsAtCost).not.toBe(liveRow?.creditsAtCost);
  });

  it("scales shared-policy image costs linearly when amount changes", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "fal-ai/nano-banana",
      label: "Nano Banana",
      sourceUrl: "https://fal.ai/models/fal-ai/nano-banana/api",
      pricingStrategy: "google-nano-banana-per-image",
      pricingStrategyLabel: "Per image",
      defaultAspect: "1:1",
      allowedAspects: ["1:1"],
      defaultResolution: "model_default",
      allowedResolutions: ["model_default"],
      pricingPreview: {
        usdRaw: 0.039,
        rawCredits: 2,
        billedCredits: 2,
        billedUsd: 0.0667,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.039,
            rawCredits: 2,
            billedCredits: 2,
            billedUsd: 0.0667,
          },
        },
      ],
    });

    const liveRow = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    })[0];
    const draftRow = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
      durationDrafts: {
        [model.id]: "3",
      },
    })[0];

    expect(liveRow).toMatchObject({
      usageLabel: "Amount",
      usageValueLabel: "1",
      creditsAtCost: 4,
    });
    expect(liveRow?.providerCostUsd).toBeCloseTo(0.039, 6);
    expect(draftRow).toMatchObject({
      usageLabel: "Amount",
      usageValueLabel: "3",
      creditsAtCost: 12,
    });
    expect(draftRow?.providerCostUsd).toBeCloseTo(0.117, 6);
  });

  it("scales token-priced shared-policy models when usage increases", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "gpt-5.4",
      label: "GPT-5.4",
      provider: "openai",
      sourceUrl: "https://platform.openai.com/docs/pricing",
      workflowType: "Text",
      pricingStrategy: "openai-text-token",
      pricingStrategyLabel: "Per 1M input tokens",
      defaultAspect: "",
      allowedAspects: [""],
      defaultResolution: null as never,
      allowedResolutions: [],
      defaultDurationSeconds: null,
      defaultSourceDurationSeconds: null,
      minDurationSeconds: null,
      maxDurationSeconds: null,
      allowedDurations: [],
      defaultAudio: null,
      pricingPreview: {
        usdRaw: 2.5,
        rawCredits: 75,
        billedCredits: 75,
        billedUsd: 2.5,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 2.5,
            rawCredits: 75,
            billedCredits: 75,
            billedUsd: 2.5,
          },
        },
      ],
    });

    const liveRow = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    })[0];
    const draftRow = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
      durationDrafts: {
        [model.id]: "2000000",
      },
    })[0];

    expect(liveRow).toMatchObject({
      usageLabel: "Input tokens",
      usageValueLabel: "1,000,000",
      providerCostUsd: 2.5,
      creditsAtCost: 250,
    });
    expect(draftRow).toMatchObject({
      usageLabel: "Input tokens",
      usageValueLabel: "2,000,000",
      providerCostUsd: 5,
      creditsAtCost: 500,
    });
  });

  it("expands shared-policy image models into separate price-variant rows", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "fal-ai/nano-banana-2",
      label: "Nano Banana 2",
      sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/api",
      pricingStrategy: "nano-banana-2-per-image",
      pricingStrategyLabel: "nano-banana-2-per-image",
      defaultAspect: "auto",
      allowedAspects: ["auto"],
      defaultResolution: "1K",
      allowedResolutions: ["1K", "2K", "4K"],
      pricingPreview: {
        usdRaw: 0.08,
        rawCredits: 8,
        billedCredits: 8,
        billedUsd: 0.08,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.08,
            rawCredits: 8,
            billedCredits: 8,
            billedUsd: 0.08,
          },
        },
      ],
    });

    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.specLabel)).toEqual(["1K / auto", "2K / auto", "4K / auto"]);
    expect(rows.map((row) => row.providerCostUsd)).toEqual([0.08, 0.12, 0.16]);
  });

  it("scales shared-policy image overrides from the per-image rate instead of treating them as flat totals", () => {
    const model = buildModelRow({
      id: "fal-ai/nano-banana-2",
      label: "Nano Banana 2",
      sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/api",
      pricingStrategy: "nano-banana-2-per-image",
      pricingStrategyLabel: "nano-banana-2-per-image",
      defaultAspect: "auto",
      allowedAspects: ["auto"],
      defaultResolution: "1K",
      allowedResolutions: ["1K"],
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
    });
    const pricingPolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      perModel: {
        [model.id]: {
          variants: {
            default: {
              providerUsdOverride: 0.08,
            },
          },
        },
      },
    };

    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
      durationDrafts: {
        [model.id]: "15",
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      usageValueLabel: "15",
      providerCostUsd: 1.2,
    });
  });

  it("applies variant markup overrides to only the targeted expanded row", () => {
    const model = buildModelRow({
      id: "fal-ai/nano-banana-2",
      label: "Nano Banana 2",
      sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/api",
      pricingStrategy: "nano-banana-2-per-image",
      pricingStrategyLabel: "nano-banana-2-per-image",
      defaultAspect: "auto",
      allowedAspects: ["auto"],
      defaultResolution: "1K",
      allowedResolutions: ["1K", "2K", "4K"],
      pricingPreview: {
        usdRaw: 0.08,
        rawCredits: 8,
        billedCredits: 8,
        billedUsd: 0.08,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.08,
            rawCredits: 8,
            billedCredits: 8,
            billedUsd: 0.08,
          },
        },
      ],
    });
    const twoKVariantId = buildModelPricingVariantId({
      baseVariantId: "default",
      aspect: "auto",
      resolution: "2K",
    });
    const pricingPolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      perModel: {
        [model.id]: {
          variants: {
            [twoKVariantId]: {
              markupBps: 5_000,
            },
          },
        },
      },
    };

    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    });
    const oneKRow = rows.find((row) => row.specLabel === "1K / auto");
    const twoKRow = rows.find((row) => row.specLabel === "2K / auto");
    const fourKRow = rows.find((row) => row.specLabel === "4K / auto");

    expect(oneKRow).toMatchObject({
      markupBps: 6_000,
      billedCredits: 13,
      billedUsd: 0.13,
    });
    expect(twoKRow).toMatchObject({
      markupBps: 5_000,
      billedCredits: 18,
      billedUsd: 0.18,
    });
    expect(fourKRow).toMatchObject({
      markupBps: 6_000,
      billedCredits: 26,
      billedUsd: 0.26,
    });
  });

  it("expands Kling 3.0 into both 720p and 1080p price variants", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "kie-ai/kling-3.0",
      label: "Kling 3.0 (Kie)",
      provider: "kie",
      sourceUrl: "https://docs.kie.ai/",
      workflowType: "Image to video",
      pricingStrategy: "kling-3-per-second",
      pricingStrategyLabel: "kling-3-per-second",
      defaultAspect: "16:9",
      allowedAspects: ["16:9"],
      defaultResolution: "720p",
      allowedResolutions: ["720p", "1080p"],
      defaultDurationSeconds: 10,
      minDurationSeconds: 5,
      maxDurationSeconds: 10,
      defaultAudio: true,
      pricingPreview: {
        usdRaw: 0.7,
        rawCredits: 14,
        billedCredits: 14,
        billedUsd: 0.7,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.7,
            rawCredits: 14,
            billedCredits: 14,
            billedUsd: 0.7,
          },
        },
      ],
    });

    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    });

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.specLabel)).toEqual([
      "720p / 16:9 / audio on",
      "720p / 16:9 / audio off",
      "1080p / 16:9 / audio on",
      "1080p / 16:9 / audio off",
    ]);
    expect(rows[0]?.providerCostUsd).toBeCloseTo(1.05, 6);
    expect(rows[1]?.providerCostUsd).toBeCloseTo(0.7, 6);
    expect(rows[2]?.providerCostUsd).toBeCloseTo(1.35, 6);
    expect(rows[3]?.providerCostUsd).toBeCloseTo(0.9, 6);
  });

  it("recomputes shared-policy credits at cost from provider usd instead of marked runtime raw credits", () => {
    const model = buildModelRow({
      id: "kie-ai/veo-3.1-fast-i2v",
      label: "Veo 3.1 Fast I2V (Kie)",
      provider: "kie",
      sourceUrl: "https://docs.kie.ai/",
      workflowType: "Text to video",
      pricingStrategy: "veo-3-per-second",
      pricingStrategyLabel: "veo-3-per-second",
      defaultAspect: "16:9",
      allowedAspects: ["16:9"],
      defaultResolution: "720p",
      allowedResolutions: ["720p", "1080p"],
      defaultDurationSeconds: 2,
      minDurationSeconds: 2,
      maxDurationSeconds: 8,
      defaultAudio: true,
      pricingPreview: {
        usdRaw: 0.4,
        rawCredits: 27,
        billedCredits: 27,
        billedUsd: 0.9,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.4,
            rawCredits: 27,
            billedCredits: 27,
            billedUsd: 0.9,
          },
        },
      ],
    });
    const pricingPolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      global: {
        ...getDefaultModelPricingPolicyDocument().global,
        creditUsdScale: 30,
      },
      perModel: {
        [model.id]: {
          markupBps: 12_000,
        },
      },
    };

    const row = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    })[0];

    expect(row).toMatchObject({
      creditsAtCost: 12,
      billedCredits: 27,
      billedUsd: 0.9,
      markupBps: 12_000,
    });
  });

  it("applies variant provider cost per-second overrides linearly through duration", () => {
    const model = buildModelRow({
      id: "kie-ai/kling-3.0",
      label: "Kling 3.0 (Kie)",
      provider: "kie",
      sourceUrl: "https://docs.kie.ai/",
      workflowType: "Image to video",
      pricingStrategy: "kling-3-per-second",
      pricingStrategyLabel: "kling-3-per-second",
      defaultAspect: "16:9",
      allowedAspects: ["16:9"],
      defaultResolution: "720p",
      allowedResolutions: ["720p", "1080p"],
      defaultDurationSeconds: 10,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      defaultAudio: true,
      pricingPreview: {
        usdRaw: 1.05,
        rawCredits: 105,
        billedCredits: 105,
        billedUsd: 1.05,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 1.05,
            rawCredits: 105,
            billedCredits: 105,
            billedUsd: 1.05,
          },
        },
      ],
    });
    const variantId = buildModelPricingVariantId({
      baseVariantId: "default",
      aspect: "16:9",
      resolution: "720p",
      audio: true,
    });
    const pricingPolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      perModel: {
        [model.id]: {
          variants: {
            [variantId]: {
              providerUsdPerSecondOverride: 0.2,
            },
          },
        },
      },
    };

    const row = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    }).find((candidate) => candidate.variantId === variantId);

    expect(row).toMatchObject({
      durationSeconds: 10,
      providerCostUsd: 2,
      costPerSecondUsd: 0.2,
      creditsAtCost: 200,
      billedCredits: 320,
      billedUsd: 3.2,
    });
  });
});

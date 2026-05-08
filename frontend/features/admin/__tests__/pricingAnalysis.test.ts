import { describe, expect, it } from "vitest";
import {
  buildPlanMarginModelRows,
  buildModelEconomicsRows,
  buildUsageMixAnalysisRows,
  computePlanMarginSummary,
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
      simulatedName: "Plan",
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

  it("builds plan margin simulator rows from discounted-then-affiliate money-kept-per-credit math", () => {
    const pricingPolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      perModel: {
        "kie-ai/veo-3.1-fast-i2v": {
          markupBps: 12_000,
        },
      },
    };
    const model = buildModelRow({
      id: "kie-ai/veo-3.1-fast-i2v",
      label: "Veo 3.1",
      provider: "kie",
      sourceUrl: "https://docs.kie.ai/",
      workflowType: "Text to video",
      pricingStrategy: "veo-3-per-second",
      pricingStrategyLabel: "veo-3-per-second",
      defaultAspect: "16:9",
      allowedAspects: ["16:9"],
      defaultResolution: "720p",
      allowedResolutions: ["720p"],
      defaultDurationSeconds: 5,
      minDurationSeconds: 5,
      maxDurationSeconds: 5,
      allowedDurations: [5],
      defaultAudio: true,
      pricingPreview: {
        usdRaw: 0.3,
        rawCredits: 9,
        billedCredits: 18,
        billedUsd: 0.18,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          audio: true,
          resolution: "720p",
          aspect: "16:9",
          breakdown: {
            usdRaw: 0.3,
            rawCredits: 9,
            billedCredits: 18,
            billedUsd: 0.18,
          },
        },
      ],
    });
    const modelRows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    });
    const planSummary = computePlanMarginSummary({
      simulatedName: "Plan",
      priceUsd: "49",
      includedCredits: "1200",
      discountPct: "0",
      affiliatePct: "15",
      processorPct: "0",
      processorFlatUsd: "0",
    });

    const rows = buildPlanMarginModelRows({
      modelRows,
      planSummary,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      creditsWithMarkup: 88,
      afterDiscountAffiliateUsd: 3.0543333333333336,
    });
    expect(rows[0]?.afterMarkupUsd).toBeCloseTo(0.88, 6);
    expect(rows[0]?.profitAfterDiscountAffiliateUsd).toBeCloseTo(2.6543333333333337, 6);
    expect(rows[0]?.marginPercent).toBeCloseTo(86.90385245007094, 6);
  });

  it("maps billed credits into retained plan revenue using discounted-then-affiliate money kept per included credit", () => {
    const planSummary = computePlanMarginSummary({
      simulatedName: "Plan",
      priceUsd: "49",
      includedCredits: "1500",
      discountPct: "0",
      affiliatePct: "15",
      processorPct: "0",
      processorFlatUsd: "0",
    });

    const rows = buildPlanMarginModelRows({
      modelRows: [
        {
          key: "example",
          modelId: "example-model",
          variantId: "default",
          modelLabel: "Example model",
          provider: "fal",
          typeLabel: "text → image",
          specLabel: "Example spec",
          usageLabel: "Amount",
          usageValueLabel: "1",
          durationSeconds: null,
          providerCostUsd: 2.03,
          costPerSecondUsd: null,
          creditsAtCost: 60.9,
          billedCredits: 97,
          billedUsd: 3.25,
          marginUsd: 1.22,
          marginPercent: 37.5384615385,
          creditUsdScale: null,
          markupBps: null,
          roundingIncrement: null,
          pricingAuthority: "local_pricing",
        },
      ],
      planSummary,
    });

    expect(planSummary.moneyKeptUsd).toBeCloseTo(41.65, 6);
    expect(planSummary.dollarPerCredit).toBeCloseTo(41.65 / 1500, 6);
    expect(rows[0]?.creditsWithMarkup).toBe(97);
    expect(rows[0]?.afterDiscountAffiliateUsd).toBeCloseTo((41.65 / 1500) * 97, 6);
    expect(rows[0]?.profitAfterDiscountAffiliateUsd).toBeCloseTo((41.65 / 1500) * 97 - 2.03, 6);
  });

  it("subtracts affiliate from the discounted plan price before computing retained value per credit", () => {
    const planSummary = computePlanMarginSummary({
      simulatedName: "Plan",
      priceUsd: "49",
      includedCredits: "1500",
      discountPct: "20",
      affiliatePct: "15",
      processorPct: "0",
      processorFlatUsd: "0",
    });

    expect(planSummary.afterDiscountUsd).toBeCloseTo(39.2, 6);
    expect(planSummary.affiliateCostUsd).toBeCloseTo(5.88, 6);
    expect(planSummary.moneyKeptUsd).toBeCloseTo(33.32, 6);
    expect(planSummary.dollarPerCredit).toBeCloseTo(33.32 / 1500, 6);
  });

  it("matches the yearly-plan example where affiliate is deducted after discount", () => {
    const planSummary = computePlanMarginSummary({
      simulatedName: "$299/mo YEARLY",
      priceUsd: "299",
      includedCredits: "8000",
      discountPct: "23",
      affiliatePct: "15",
      processorPct: "0",
      processorFlatUsd: "0",
    });

    expect(planSummary.afterDiscountUsd).toBeCloseTo(230.23, 6);
    expect(planSummary.affiliateCostUsd).toBeCloseTo(34.5345, 6);
    expect(planSummary.moneyKeptUsd).toBeCloseTo(195.6955, 6);
    expect(planSummary.dollarPerCredit).toBeCloseTo(195.6955 / 8000, 6);
  });

  it("keeps usage-mix monthly revenue capped to the plan net revenue", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const models = [buildModelRow({})];
    const planSummary = computePlanEconomicsSummary({
      simulatedName: "Plan",
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

  it("shows OpenAI text models as a fixed per-50,000-character blended rate", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "gpt-5.5",
      label: "GPT-5.5",
      provider: "openai",
      sourceUrl: "https://openai.com/api/pricing/",
      workflowType: "Text",
      pricingStrategy: "openai-text-token",
      pricingStrategyLabel: "Per 50,000 characters",
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
        usdRaw: 0.4667,
        rawCredits: 14,
        billedCredits: 14,
        billedUsd: 0.4667,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.4667,
            rawCredits: 14,
            billedCredits: 14,
            billedUsd: 0.4667,
          },
        },
      ],
    });

    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.usageLabel).toBe("Characters");
    expect(rows[0]?.usageValueLabel).toBe("50,000");
    expect(rows[0]?.specLabel).toBe("Blended characters");
    expect(rows[0]?.providerCostUsd).toBeCloseTo(0.281, 6);
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

  it("expands Seedance 2.0 into Kie's live resolution and video-input price variants", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "kie-ai/seedance-2",
      label: "Seedance 2.0 (Kie)",
      provider: "kie",
      sourceUrl: "https://kie.ai/pricing",
      workflowType: "Text to video",
      pricingStrategy: "seedance-2-per-second",
      pricingStrategyLabel: "Per output second",
      defaultAspect: "16:9",
      allowedAspects: ["1:1", "16:9"],
      defaultResolution: "1080p",
      allowedResolutions: ["1080p", "720p", "480p"],
      defaultDurationSeconds: 5,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      defaultAudio: true,
      pricingPreview: {
        usdRaw: 0.51,
        rawCredits: 102,
        billedCredits: 102,
        billedUsd: 0.51,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.51,
            rawCredits: 102,
            billedCredits: 102,
            billedUsd: 0.51,
          },
        },
      ],
    });

    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy,
    });

    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.specLabel)).toEqual([
      "1080p / 16:9 / with video input",
      "1080p / 16:9 / no video input",
      "720p / 16:9 / with video input",
      "720p / 16:9 / no video input",
      "480p / 16:9 / with video input",
      "480p / 16:9 / no video input",
    ]);
    expect(rows.map((row) => row.providerCostUsd)).toHaveLength(6);
    expect(rows[0]?.providerCostUsd).toBeCloseTo(1.55, 6);
    expect(rows[1]?.providerCostUsd).toBeCloseTo(2.55, 6);
    expect(rows[2]?.providerCostUsd).toBeCloseTo(0.625, 6);
    expect(rows[3]?.providerCostUsd).toBeCloseTo(1.025, 6);
    expect(rows[4]?.providerCostUsd).toBeCloseTo(0.2875, 6);
    expect(rows[5]?.providerCostUsd).toBeCloseTo(0.475, 6);
  });

  it("expands Seedance 2.0 Fast into Kie's live resolution and video-input price variants", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const model = buildModelRow({
      id: "kie-ai/seedance-2-fast",
      label: "Seedance 2.0 Fast (Kie)",
      provider: "kie",
      sourceUrl: "https://kie.ai/pricing",
      workflowType: "Text to video",
      pricingStrategy: "seedance-2-fast-per-second",
      pricingStrategyLabel: "Per output second",
      defaultAspect: "16:9",
      allowedAspects: ["1:1", "16:9"],
      defaultResolution: "720p",
      allowedResolutions: ["720p", "480p"],
      defaultDurationSeconds: 5,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      defaultAudio: true,
      pricingPreview: {
        usdRaw: 0.165,
        rawCredits: 33,
        billedCredits: 33,
        billedUsd: 0.165,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.165,
            rawCredits: 33,
            billedCredits: 33,
            billedUsd: 0.165,
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
      "720p / 16:9 / with video input",
      "720p / 16:9 / no video input",
      "480p / 16:9 / with video input",
      "480p / 16:9 / no video input",
    ]);
    expect(rows.map((row) => row.providerCostUsd)).toHaveLength(4);
    expect(rows[0]?.providerCostUsd).toBeCloseTo(0.5, 6);
    expect(rows[1]?.providerCostUsd).toBeCloseTo(0.825, 6);
    expect(rows[2]?.providerCostUsd).toBeCloseTo(0.225, 6);
    expect(rows[3]?.providerCostUsd).toBeCloseTo(0.3875, 6);
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

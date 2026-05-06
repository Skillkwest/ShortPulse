import { describe, expect, it } from "vitest";
import {
  buildModelEconomicsRows,
  buildUsageMixAnalysisRows,
  computePlanEconomicsSummary,
  type UsageMixDraftRow,
} from "../pricingAnalysis";
import type { AdminPricingModelRow } from "../types";
import { getDefaultModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";

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
    defaultResolution: "model_default",
    defaultDurationSeconds: null,
    defaultSourceDurationSeconds: null,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    allowedDurations: [],
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
});

/**
 * Protects admin pricing-grid invariants where unit rates must stay stable
 * while totals scale linearly with the current usage input.
 */
import { describe, expect, it } from "vitest";
import { buildModelEconomicsRows } from "../pricingAnalysis";
import { getModelRateSourceInputMode, getRateSourceCostUsd } from "../pricingWorkbookMath";
import { getModelUsageRateMultiplier } from "../pricingDrafts";
import type { AdminPricingModelRow } from "../types";
import { getDefaultModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";

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
      id: "eleven_text_to_sound_v2",
      label: "ElevenLabs Sound Effects",
      provider: "elevenlabs",
      sourceUrl: "https://elevenlabs.io/docs/overview/capabilities/sound-effects",
      workflowType: "Text to sound",
      pricingStrategy: "elevenlabs-sound-effect",
      pricingStrategyLabel: "Per second",
      defaultResolution: null,
      allowedResolutions: [],
      defaultDurationSeconds: 5,
      minDurationSeconds: 0.5,
      maxDurationSeconds: 30,
      pricingPreview: {
        usdRaw: 0.01,
        rawCredits: 1,
        billedCredits: 2,
        billedUsd: 0.02,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.01,
            rawCredits: 1,
            billedCredits: 2,
            billedUsd: 0.02,
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
    const row = rows[0];

    expect(row).toMatchObject({
      durationSeconds: 10,
      providerCostUsd: 0.02,
      costPerSecondUsd: 0.002,
    });
    expect(
      getRateSourceCostUsd({
        rateSourceInputMode: getModelRateSourceInputMode(model),
        providerCostUsd: row?.providerCostUsd,
        providerCostUsdPerSecond: row?.costPerSecondUsd,
        durationSeconds: row?.durationSeconds,
      })
    ).toBe(0.002);
  });

  it("keeps per-1M-token rate fixed while token usage scales total provider cost", () => {
    const model = buildModelRow({
      id: "gpt-5.4-nano",
      label: "GPT-5.4 Nano",
      provider: "openai",
      sourceUrl: "https://platform.openai.com/docs/pricing",
      workflowType: "Text to text",
      pricingStrategy: "openai-text-token",
      pricingStrategyLabel: "Per 1M input tokens",
      defaultResolution: null,
      allowedResolutions: [],
      pricingPreview: {
        usdRaw: 0.2,
        rawCredits: 6,
        billedCredits: 10,
        billedUsd: 0.3333,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.2,
            rawCredits: 6,
            billedCredits: 10,
            billedUsd: 0.3333,
          },
        },
      ],
    });
    const rows = buildModelEconomicsRows({
      models: [model],
      pricingPolicy: getDefaultModelPricingPolicyDocument(),
      durationDrafts: {
        [model.id]: "2000000",
      },
    });
    const row = rows[0];

    expect(row).toMatchObject({
      usageValueLabel: "2,000,000",
      providerCostUsd: 0.4,
    });
    expect(
      getRateSourceCostUsd({
        rateSourceInputMode: getModelRateSourceInputMode(model),
        providerCostUsd: row?.providerCostUsd,
        providerCostUsdPerSecond: row?.costPerSecondUsd,
        durationSeconds: row?.durationSeconds,
        usageRateMultiplier: getModelUsageRateMultiplier(model, 2_000_000),
      })
    ).toBe(0.2);
  });
});

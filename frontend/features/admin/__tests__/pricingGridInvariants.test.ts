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

  it("keeps OpenAI text scenarios fixed and treats the rate source as the displayed scenario price", () => {
    const model = buildModelRow({
      id: "gpt-5.4-pro",
      label: "GPT-5.4 Pro",
      provider: "openai",
      sourceUrl: "https://openai.com/api/pricing/",
      workflowType: "Text to text",
      pricingStrategy: "openai-text-token",
      pricingStrategyLabel: "Per 10,000 characters",
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
    });
    const row = rows.find((candidate) => candidate.specLabel === "10,000 characters generated");

    expect(row?.usageValueLabel).toBe("");
    expect(row?.providerCostUsd).toBeCloseTo(0.45, 4);
    expect(
      getRateSourceCostUsd({
        rateSourceInputMode: getModelRateSourceInputMode(model),
        providerCostUsd: row?.providerCostUsd,
        providerCostUsdPerSecond: row?.costPerSecondUsd,
        durationSeconds: row?.durationSeconds,
      })
    ).toBeCloseTo(0.45, 4);
  });
});

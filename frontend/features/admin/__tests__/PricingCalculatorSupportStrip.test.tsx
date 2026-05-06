import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PricingCalculatorSupportStrip } from "../PricingCalculatorSupportStrip";
import { buildModelEconomicsRows, type UsageMixDraftRow } from "../pricingAnalysis";
import type { AdminPricingModelRow, AdminPricingPlanRow } from "../types";
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

describe("PricingCalculatorSupportStrip", () => {
  it("summary profit subtracts all modeled provider cost even when a row has no revenue allocation", () => {
    const pricingPolicy = getDefaultModelPricingPolicyDocument();
    const models = [
      buildModelRow({}),
      buildModelRow({
        id: "manual/metadata-only",
        label: "Metadata Only",
        provider: "other",
        pricingAuthority: "metadata_only",
        pricingPreview: {
          usdRaw: 5,
          rawCredits: null,
          billedCredits: null,
          billedUsd: null,
        },
        pricingPreviewVariants: [
          {
            id: "default",
            label: "Default",
            breakdown: {
              usdRaw: 5,
              rawCredits: null,
              billedCredits: null,
              billedUsd: null,
            },
          },
        ],
      }),
    ];
    const modelRows = buildModelEconomicsRows({ models, pricingPolicy });
    const plans: AdminPricingPlanRow[] = [
      {
        planId: "studio",
        displayName: "Studio",
        offerId: "studio__current",
        sortOrder: 30,
        accountCount: 1,
        status: "active",
        recurringPriceCents: 1000,
        monthlyCreditsCents: 100,
        storageLimitBytes: 0,
        stripeProductId: null,
        stripePriceId: null,
        acquisitionEnabled: true,
        isActive: true,
        effectiveStartAt: "2026-04-24T12:00:00.000Z",
        monthlyOffer: null,
        annualOffer: null,
      },
    ];
    const usageMixRows: UsageMixDraftRow[] = [
      {
        id: "shared-row",
        modelId: models[0].id,
        variantId: "default",
        durationSeconds: "",
        runsPerMonth: "10",
      },
      {
        id: "metadata-row",
        modelId: models[1].id,
        variantId: "default",
        durationSeconds: "",
        runsPerMonth: "1",
      },
    ];

    render(
      <PricingCalculatorSupportStrip
        plans={plans}
        selectedPlanId="studio"
        setSelectedPlanId={vi.fn()}
        selectedPlanDraft={{
          priceUsd: "10.00",
          includedCredits: "100",
          discountPct: "0",
          affiliatePct: "0",
          processorPct: "0",
          processorFlatUsd: "0.00",
        }}
        updatePlanDraft={vi.fn()}
        usageMixRows={usageMixRows}
        updateUsageMixRow={vi.fn()}
        addUsageMixRow={vi.fn()}
        removeUsageMixRow={vi.fn()}
        models={models}
        modelRows={modelRows}
        pricingPolicy={pricingPolicy}
        aspectDrafts={{}}
        resolutionDrafts={{}}
        audioDrafts={{}}
        isDraftDirty={false}
      />
    );

    const summaryPanel = screen
      .getByRole("heading", { name: "Projected Margin" })
      .closest("article");
    expect(summaryPanel).not.toBeNull();
    const summary = within(summaryPanel!);

    expect(summary.getByText("Studio")).toBeInTheDocument();
    expect(summary.getByText("$10.00")).toBeInTheDocument();
    expect(summary.getByText("$5.06")).toBeInTheDocument();
    expect(summary.getByText("$4.94")).toBeInTheDocument();
  });
});

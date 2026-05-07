import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PricingCalculatorSupportStrip } from "../PricingCalculatorSupportStrip";
import type { AdminPricingModelRow, AdminPricingPlanRow } from "../types";
import { getDefaultModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";

const buildModelRow = (overrides: Partial<AdminPricingModelRow>): AdminPricingModelRow =>
  ({
    id: "kie-ai/veo-3.1-fast-i2v",
    label: "Veo 3.1",
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/",
    workflowType: "Text to video",
    pricingStrategy: "veo-3-per-second",
    pricingStrategyLabel: "veo-3-per-second",
    defaultAspect: "16:9",
    allowedAspects: ["16:9"],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p"],
    defaultDurationSeconds: 15,
    defaultSourceDurationSeconds: null,
    minDurationSeconds: 15,
    maxDurationSeconds: 15,
    allowedDurations: [15],
    defaultAudio: true,
    roundingIncrement: 5,
    pricingAuthority: "local_pricing",
    pricingPreview: {
      usdRaw: 2.03,
      rawCredits: 60.9,
      billedCredits: 97,
      billedUsd: 3.25,
    },
    pricingPreviewVariants: [
      {
        id: "1080p",
        label: "1080p",
        audio: true,
        resolution: "1080p",
        aspect: "16:9",
        breakdown: {
          usdRaw: 2.03,
          rawCredits: 60.9,
          billedCredits: 97,
          billedUsd: 3.25,
        },
      },
      {
        id: "720p",
        label: "720p",
        audio: true,
        resolution: "720p",
        aspect: "16:9",
        breakdown: {
          usdRaw: 1.5,
          rawCredits: 45,
          billedCredits: 72,
          billedUsd: 2.4,
        },
      },
    ],
    ...overrides,
  }) as AdminPricingModelRow;

describe("PricingCalculatorSupportStrip", () => {
  it("mirrors pricing-grid variants and converts billed credits into post-discount plan revenue", () => {
    const plans: AdminPricingPlanRow[] = [
      {
        planId: "plus",
        displayName: "Plus",
        offerId: "plus__current",
        sortOrder: 10,
        accountCount: 1,
        status: "active",
        recurringPriceCents: 4900,
        monthlyCreditsCents: 1500,
        storageLimitBytes: 0,
        stripeProductId: null,
        stripePriceId: null,
        acquisitionEnabled: true,
        isActive: true,
        effectiveStartAt: "2026-05-07T00:00:00.000Z",
        monthlyOffer: null,
        annualOffer: null,
      },
    ];

    render(
      <PricingCalculatorSupportStrip
        plans={plans}
        displayedModels={[buildModelRow({})]}
        effectiveModelPolicyDraft={getDefaultModelPricingPolicyDocument()}
        durationDrafts={{}}
        aspectDrafts={{}}
        resolutionDrafts={{}}
        audioDrafts={{}}
        modelSortOption="model_asc"
        planDraftsByPlanId={{
          plus: {
            simulatedName: "$49.00/mo Plus",
            priceUsd: "49",
            includedCredits: "1500",
            discountPct: "20",
            affiliatePct: "15",
            processorPct: "2.9",
            processorFlatUsd: "0.30",
          },
        }}
        simulatorPlanIds={["plus"]}
        updatePlanDraft={vi.fn()}
        addSimulatorPlan={vi.fn()}
        removeSimulatorPlan={vi.fn()}
        isDraftDirty={false}
      />
    );

    expect(screen.getByRole("heading", { name: "Plan Margin Simulator" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("$49.00/mo Plus")).toBeInTheDocument();
    expect(screen.getByText("Model economics (mirrors pricing grid variants)")).toBeInTheDocument();
    expect(screen.getByText("$39.20")).toBeInTheDocument();
    expect(screen.getByText("$31.85")).toBeInTheDocument();
    expect(screen.getByText("$0.0212")).toBeInTheDocument();
    expect(screen.getAllByText("2 price variants")).toHaveLength(2);
    expect(screen.getByText("$2.40 to $3.25")).toBeInTheDocument();
    expect(screen.getByText("$1.53 to $2.06")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Veo 3\.1/i }));

    expect(screen.getByText("Variant 1")).toBeInTheDocument();
    expect(screen.getByText("97")).toBeInTheDocument();
    expect(screen.getByText("$3.25")).toBeInTheDocument();
    expect(screen.getByText("$2.06")).toBeInTheDocument();
    expect(screen.getByText("$0.0296")).toBeInTheDocument();
  });

  it("lets the simulator title be renamed without coupling that input to the price field", () => {
    const updatePlanDraft = vi.fn();

    render(
      <PricingCalculatorSupportStrip
        plans={[
          {
            planId: "free",
            displayName: "Free",
            offerId: "free__current",
            sortOrder: 1,
            accountCount: 1,
            status: "active",
            recurringPriceCents: 4900,
            monthlyCreditsCents: 100,
            storageLimitBytes: 0,
            stripeProductId: null,
            stripePriceId: null,
            acquisitionEnabled: true,
            isActive: true,
            effectiveStartAt: "2026-05-07T00:00:00.000Z",
            monthlyOffer: null,
            annualOffer: null,
          },
        ]}
        displayedModels={[buildModelRow({})]}
        effectiveModelPolicyDraft={getDefaultModelPricingPolicyDocument()}
        durationDrafts={{}}
        aspectDrafts={{}}
        resolutionDrafts={{}}
        audioDrafts={{}}
        modelSortOption="model_asc"
        planDraftsByPlanId={{
          free: {
            simulatedName: "$49.00/mo Starter Test",
            priceUsd: "49",
            includedCredits: "100",
            discountPct: "0",
            affiliatePct: "0",
            processorPct: "2.9",
            processorFlatUsd: "0.30",
          },
        }}
        simulatorPlanIds={["free"]}
        updatePlanDraft={updatePlanDraft}
        addSimulatorPlan={vi.fn()}
        removeSimulatorPlan={vi.fn()}
        isDraftDirty={false}
      />
    );

    fireEvent.change(screen.getByLabelText("Free simulator title"), {
      target: { value: "Growth Sandbox Plan" },
    });

    expect(updatePlanDraft).toHaveBeenCalledWith("free", "simulatedName", "Growth Sandbox Plan");
    expect(screen.getAllByText("$49.00").length).toBeGreaterThan(0);
  });

  it("supports adding and removing simulator-only plan cards", () => {
    const addSimulatorPlan = vi.fn();
    const removeSimulatorPlan = vi.fn();

    render(
      <PricingCalculatorSupportStrip
        plans={[]}
        displayedModels={[buildModelRow({})]}
        effectiveModelPolicyDraft={getDefaultModelPricingPolicyDocument()}
        durationDrafts={{}}
        aspectDrafts={{}}
        resolutionDrafts={{}}
        audioDrafts={{}}
        modelSortOption="model_asc"
        planDraftsByPlanId={{
          "sim-plan-1": {
            simulatedName: "$49.00/mo Sandbox",
            priceUsd: "49",
            includedCredits: "1200",
            discountPct: "0",
            affiliatePct: "0",
            processorPct: "2.9",
            processorFlatUsd: "0.30",
          },
        }}
        simulatorPlanIds={["sim-plan-1"]}
        updatePlanDraft={vi.fn()}
        addSimulatorPlan={addSimulatorPlan}
        removeSimulatorPlan={removeSimulatorPlan}
        isDraftDirty={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add simulator plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(addSimulatorPlan).toHaveBeenCalledTimes(1);
    expect(removeSimulatorPlan).toHaveBeenCalledWith("sim-plan-1");
  });
});

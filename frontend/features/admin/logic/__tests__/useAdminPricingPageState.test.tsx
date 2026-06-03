/**
 * Regression tests for admin pricing page state hydration.
 * Protects custom simulator cards from being dropped during the first restore pass.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminPricingPageState } from "../useAdminPricingPageState";
import type { AdminPricingStateResponse } from "../../types";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const ADMIN_PRICING_WORKSPACE_STORAGE_KEY = "shortpulse.adminPricingWorkspace.v1";

const buildPricingState = (): AdminPricingStateResponse => ({
  generatedAt: "2026-05-07T12:00:00.000Z",
  modelPolicy: {
    version: "policy-v3",
    activePolicyVersion: 3,
    policySource: "control_plane",
    updatedAt: "2026-05-07T12:00:00.000Z",
    updatedByEmail: "admin@example.com",
    creditUsdScale: 100,
    creditValueUsd: 0.01,
    defaultRoundingMode: "ceil",
    defaultRoundingIncrement: 1,
    overrideCount: 0,
    document: {
      schemaVersion: 1,
      global: {
        creditUsdScale: 100,
        defaultRoundingMode: "ceil",
        defaultRoundingIncrement: 1,
      },
      perModel: {},
    },
  },
  customRows: {
    schemaVersion: 1,
    rowsByModel: {},
  },
  models: [],
  plans: [
    {
      planId: "starter",
      displayName: "Starter",
      offerId: "starter__current",
      sortOrder: 1,
      accountCount: 1,
      status: "active",
      recurringPriceCents: 4900,
      monthlyCreditsCents: 900,
      storageLimitBytes: 0,
      stripeProductId: null,
      stripePriceId: null,
      acquisitionEnabled: true,
      isActive: true,
      effectiveStartAt: "2026-05-07T00:00:00.000Z",
      monthlyOffer: null,
      annualOffer: null,
    },
  ],
  creditPackages: [],
  storageAddons: [],
  health: {
    planOffersMissingStripePriceIds: 0,
    storageOffersMissingStripePriceIds: 0,
    creditPackagesMissingStripePriceIds: 0,
    totalWarnings: 0,
    warnings: [],
  },
});

describe("useAdminPricingPageState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("preserves restored custom simulator cards during initial pricing-state hydration", async () => {
    const pricingState = buildPricingState();

    window.localStorage.setItem(
      ADMIN_PRICING_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: "2026-05-07T11:30:00.000Z",
        sourceActivePolicyVersion: 3,
        modelPolicyDirty: false,
        modelPolicyDraft: null,
        customRowsDraft: {
          schemaVersion: 1,
          rowsByModel: {
            "fal-ai/flux-pro/v1.1": [
              {
                displayRowId: "custom-row-1",
                variantId: "create|aspect:1:1",
                spec: {
                  baseVariantId: "create",
                  aspect: "1:1",
                },
              },
            ],
          },
        },
        durationDrafts: {},
        aspectDrafts: {},
        resolutionDrafts: {},
        audioDrafts: {},
        creditScaleDrafts: {},
        markupDrafts: {},
        variantMarkupDrafts: {},
        providerCostDrafts: {},
        providerCostPerSecondDrafts: {},
        variantProviderCostDrafts: {},
        variantProviderCostPerSecondDrafts: {},
        modelSearchQuery: "",
        modelSortOption: "type",
        globalCreditScaleDraft: "100",
        globalCreditUsdAmountDraft: "1",
        simulatorPlanIds: ["starter", "sim-plan-1"],
        selectedUsagePlanId: "starter",
        planEconomicsDrafts: {
          starter: {
            simulatedName: "Starter",
            priceUsd: "49",
            includedCredits: "900",
            discountPct: "0",
            affiliatePct: "0",
            processorPct: "2.9",
            processorFlatUsd: "0.30",
          },
          "sim-plan-1": {
            simulatedName: "Sandbox Plan",
            priceUsd: "79",
            includedCredits: "1200",
            discountPct: "0",
            affiliatePct: "0",
            processorPct: "2.9",
            processorFlatUsd: "0.30",
          },
        },
        usageMixRowsByPlanId: {
          starter: [],
        },
      })
    );

    const { result } = renderHook(() =>
      useAdminPricingPageState({
        pricingState,
        pricingLoading: false,
        pricingError: null,
        refreshPricingState: async () => undefined,
      })
    );

    await waitFor(() => expect(result.current.simulatorPlanIds).toEqual(["starter", "sim-plan-1"]));
    expect(result.current.planEconomicsDrafts["sim-plan-1"]?.simulatedName).toBe("Sandbox Plan");
    expect(
      result.current.effectiveCustomRowsDraft.rowsByModel["fal-ai/flux-pro/v1.1"]?.[0]
    ).toEqual(
      expect.objectContaining({
        displayRowId: "custom-row-1",
        variantId: "create|aspect:1:1",
      })
    );
  });

  it("drops the hidden free tier from default simulator plan ids when starter exists", async () => {
    const pricingState = {
      ...buildPricingState(),
      plans: [
        {
          planId: "free",
          displayName: "Free",
          offerId: "free__current",
          sortOrder: 0,
          accountCount: 10,
          status: "active" as const,
          recurringPriceCents: 0,
          monthlyCreditsCents: 100,
          storageLimitBytes: 1073741824,
          stripeProductId: null,
          stripePriceId: null,
          acquisitionEnabled: true,
          isActive: true,
          effectiveStartAt: "2026-05-07T00:00:00.000Z",
          monthlyOffer: null,
          annualOffer: null,
        },
        ...buildPricingState().plans,
      ],
    } satisfies AdminPricingStateResponse;

    const { result } = renderHook(() =>
      useAdminPricingPageState({
        pricingState,
        pricingLoading: false,
        pricingError: null,
        refreshPricingState: async () => undefined,
      })
    );

    await waitFor(() => expect(result.current.simulatorPlanIds).toEqual(["starter"]));
    expect(result.current.selectedUsagePlanId).toBe("starter");
  });
});

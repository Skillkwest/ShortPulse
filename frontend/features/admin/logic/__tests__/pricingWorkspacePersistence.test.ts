import { describe, expect, it } from "vitest";
import {
  clearAdminPricingWorkspaceDraftFromStorage,
  readAdminPricingWorkspaceDraftFromStorage,
  writeAdminPricingWorkspaceDraftToStorage,
  type AdminPricingWorkspaceDraftSnapshot,
} from "../pricingWorkspacePersistence";
import { compactModelPricingPolicyDocument } from "../../../../lib/model-runtime/pricingPolicy";

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
};

const buildSnapshot = (): AdminPricingWorkspaceDraftSnapshot => ({
  version: 1,
  savedAt: "2026-05-06T12:00:00.000Z",
  sourceActivePolicyVersion: 7,
  modelPolicyDirty: true,
  modelPolicyDraft: {
    global: {
      creditUsdScale: 30,
      defaultRoundingIncrement: 1,
    },
    perModel: {
      "elevenlabs-sound-effect": {
        markupBps: 12000,
      },
    },
  },
  durationDrafts: {
    "elevenlabs-sound-effect": "5",
  },
  aspectDrafts: {},
  resolutionDrafts: {},
  audioDrafts: {
    "elevenlabs-sound-effect": "on",
  },
  creditScaleDrafts: {},
  markupDrafts: {
    "elevenlabs-sound-effect": "120",
  },
  variantMarkupDrafts: {
    "elevenlabs-sound-effect::default": "120",
  },
  providerCostDrafts: {},
  providerCostPerSecondDrafts: {},
  variantProviderCostDrafts: {
    "elevenlabs-sound-effect::default": "0.002",
  },
  variantProviderCostPerSecondDrafts: {},
  modelSearchQuery: "sound",
  modelSortOption: "type",
  globalCreditScaleDraft: "30",
  globalCreditUsdAmountDraft: "1",
  simulatorPlanIds: ["starter", "sim-plan-1"],
  selectedUsagePlanId: "starter",
  planEconomicsDrafts: {
    starter: {
      simulatedName: "Starter",
      priceUsd: "19",
      includedCredits: "900",
      discountPct: "0",
      affiliatePct: "20",
      processorPct: "2.9",
      processorFlatUsd: "0.3",
    },
  },
  usageMixRowsByPlanId: {
    starter: [
      {
        id: "row-1",
        modelId: "elevenlabs-sound-effect",
        variantId: "default",
        durationSeconds: "5",
        runsPerMonth: "100",
      },
    ],
  },
});

describe("pricingWorkspacePersistence", () => {
  it("round-trips a pricing workspace snapshot", () => {
    const storage = createMemoryStorage();
    const snapshot = buildSnapshot();
    const expected = {
      ...snapshot,
      modelPolicyDraft: compactModelPricingPolicyDocument(snapshot.modelPolicyDraft!),
    };

    writeAdminPricingWorkspaceDraftToStorage(storage, snapshot);

    expect(readAdminPricingWorkspaceDraftFromStorage(storage)).toEqual(expected);
  });

  it("sanitizes malformed payloads without crashing", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "shortpulse.adminPricingWorkspace.v1",
      JSON.stringify({
        modelPolicyDirty: 1,
        modelSearchQuery: 42,
        modelSortOption: "not-a-sort",
        durationDrafts: {
          good: "5",
          bad: 10,
        },
        planEconomicsDrafts: {
          starter: {
            simulatedName: "Starter",
            priceUsd: "19",
            includedCredits: "900",
            discountPct: "0",
            affiliatePct: "20",
            processorPct: "2.9",
            processorFlatUsd: "0.3",
          },
        },
        usageMixRowsByPlanId: {
          starter: [
            {
              id: "row-1",
              modelId: "model-a",
              variantId: "default",
              durationSeconds: "5",
              runsPerMonth: "100",
            },
            {
              id: "row-2",
              modelId: 7,
            },
          ],
        },
      })
    );

    expect(readAdminPricingWorkspaceDraftFromStorage(storage)).toEqual({
      version: 1,
      savedAt: new Date(0).toISOString(),
      sourceActivePolicyVersion: null,
      modelPolicyDirty: true,
      modelPolicyDraft: null,
      durationDrafts: {
        good: "5",
      },
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
      globalCreditScaleDraft: "",
      globalCreditUsdAmountDraft: "1",
      simulatorPlanIds: null,
      selectedUsagePlanId: "",
      planEconomicsDrafts: {
        starter: {
          simulatedName: "Starter",
          priceUsd: "19",
          includedCredits: "900",
          discountPct: "0",
          affiliatePct: "20",
          processorPct: "2.9",
          processorFlatUsd: "0.3",
        },
      },
      usageMixRowsByPlanId: {
        starter: [
          {
            id: "row-1",
            modelId: "model-a",
            variantId: "default",
            durationSeconds: "5",
            runsPerMonth: "100",
          },
        ],
      },
    });
  });

  it("preserves older plan economics drafts that do not yet include a simulator name", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "shortpulse.adminPricingWorkspace.v1",
      JSON.stringify({
        planEconomicsDrafts: {
          starter: {
            priceUsd: "19",
            includedCredits: "900",
            discountPct: "0",
            affiliatePct: "20",
            processorPct: "2.9",
            processorFlatUsd: "0.3",
          },
        },
      })
    );

    expect(readAdminPricingWorkspaceDraftFromStorage(storage)?.planEconomicsDrafts).toEqual({
      starter: {
        simulatedName: "",
        priceUsd: "19",
        includedCredits: "900",
        discountPct: "0",
        affiliatePct: "20",
        processorPct: "2.9",
        processorFlatUsd: "0.3",
      },
    });
  });

  it("sanitizes simulator plan ids as a simple string list", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "shortpulse.adminPricingWorkspace.v1",
      JSON.stringify({
        simulatorPlanIds: ["starter", 42, "sim-plan-2"],
      })
    );

    expect(readAdminPricingWorkspaceDraftFromStorage(storage)?.simulatorPlanIds).toEqual([
      "starter",
      "sim-plan-2",
    ]);
  });

  it("preserves an intentionally empty simulator plan list", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "shortpulse.adminPricingWorkspace.v1",
      JSON.stringify({
        simulatorPlanIds: [],
      })
    );

    expect(readAdminPricingWorkspaceDraftFromStorage(storage)?.simulatorPlanIds).toEqual([]);
  });

  it("clears the stored workspace snapshot", () => {
    const storage = createMemoryStorage();
    writeAdminPricingWorkspaceDraftToStorage(storage, buildSnapshot());

    clearAdminPricingWorkspaceDraftFromStorage(storage);

    expect(readAdminPricingWorkspaceDraftFromStorage(storage)).toBeNull();
  });
});

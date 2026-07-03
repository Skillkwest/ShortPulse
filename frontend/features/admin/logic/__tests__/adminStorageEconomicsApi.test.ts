import { describe, expect, it } from "vitest";
import { normalizeAdminStorageEconomicsResponse } from "../adminStorageEconomicsApi";

describe("adminStorageEconomicsApi", () => {
  it("normalizes populated storage economics payloads", () => {
    const normalized = normalizeAdminStorageEconomicsResponse({
      assumptions: {
        storageCostPerGbMonth: 0.021,
        uncachedEgressCostPerGb: 0.09,
        cachedEgressCostPerGb: 0.03,
        stripePercent: 0.029,
        stripeFixedCents: 30,
        targetGrossMarginPct: 60,
        computePlan: "medium",
        computeMonthlyCostCents: 6000,
      },
      overview: {
        trackedAccounts: 3,
        accountsWithMedia: 2,
        totalTrackedBytes: 1200,
        p90TrackedBytes: 900,
        activeAddonMrrCents: 900,
        estimatedAddonGrossMargin2xPct: 72.5,
        estimatedBusinessStorageMarginPct: 48.5,
        estimatedGrossMargin2xPct: 72.5,
      },
      providerUsage: {
        status: "current",
        source: "manual",
        snapshotMonth: "2026-07-01",
        capturedAt: "2026-07-15T00:00:00.000Z",
        supabasePlan: "Pro",
        computePlan: "medium",
        computeMonthlyCostCents: 6000,
        storageUsedGb: 42,
        storageIncludedGb: 100,
        storageQuotaUsedPct: 42,
        projectedStorageUsedGb: 84,
        uncachedEgressGb: 100,
        cachedEgressGb: 80,
        totalEgressGb: 180,
        uncachedEgressIncludedGb: 250,
        cachedEgressIncludedGb: 250,
        uncachedEgressQuotaUsedPct: 40,
        cachedEgressQuotaUsedPct: 32,
        projectedUncachedEgressGb: 200,
        projectedCachedEgressGb: 160,
        egressMultiple: 4.29,
        estimatedStorageOverageCostCents: 0,
        estimatedUncachedEgressOverageCostCents: 0,
        estimatedCachedEgressOverageCostCents: 0,
        estimatedTotalOverageCostCents: 0,
        observedTotalOverageCostCents: null,
        notes: "usage page snapshot",
      },
      byPlan: [
        {
          planId: "starter",
          displayName: "Starter",
          isActive: true,
          sortOrder: 2,
          catalogStorageLimitBytes: 5368709120,
          catalogRecurringPriceCents: 1900,
          catalogAcquisitionEnabled: true,
          activeStripeContracts: 2,
          contractMrrCents: 3800,
          accountCount: 2,
          usersWithMedia: 1,
          totalTrackedBytes: 900,
          p90TrackedBytes: 900,
          accountsOver80Pct: 1,
        },
      ],
      addonPackages: [
        {
          storageAddonId: "storage_50gb",
          displayName: "50 GB",
          isActive: true,
          sortOrder: 2,
          acquisitionEnabled: true,
          catalogStorageLimitBytes: 53687091200,
          catalogRecurringPriceCents: 900,
          activeSubscribers: 1,
          activeQuantity: 1,
          mrrCents: 900,
          soldCapacityBytes: 53687091200,
          estimatedMargin2xPct: 80,
        },
      ],
      funnel: {
        addRequests: { total: 4, last24h: 1, last7d: 3 },
        addSuccesses: { total: 2, last24h: 1, last7d: 2 },
        source: "app_error_events",
      },
      riskQueue: [
        {
          userId: "user-1",
          planId: "starter",
          trackedBytes: 900,
          totalLimitBytes: 1000,
          usagePct: 90,
          activeAddonCount: 1,
          riskTypes: ["near_quota", "not_real"],
          details: "near quota",
        },
      ],
      dataGaps: ["invoice proof unavailable"],
      health: {
        degraded: false,
        storageSource: "live_query",
        funnelSource: "app_error_events",
      },
      generatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(normalized.assumptions.source).toBe("configured_estimate");
    expect(normalized.overview.trackedAccounts).toBe(3);
    expect(normalized.overview.estimatedAddonGrossMargin2xPct).toBe(72.5);
    expect(normalized.overview.estimatedBusinessStorageMarginPct).toBe(48.5);
    expect(normalized.overview.estimatedGrossMargin2xPct).toBe(72.5);
    expect(normalized.providerUsage).toEqual(
      expect.objectContaining({
        status: "current",
        source: "manual",
        storageUsedGb: 42,
        egressMultiple: 4.29,
        notes: "usage page snapshot",
      })
    );
    expect(normalized.byPlan[0]).toEqual(
      expect.objectContaining({
        planId: "starter",
        isActive: true,
        catalogStorageLimitBytes: 5368709120,
        catalogRecurringPriceCents: 1900,
        catalogAcquisitionEnabled: true,
        activeStripeContracts: 2,
        contractMrrCents: 3800,
        accountCount: 2,
        accountsOver80Pct: 1,
      })
    );
    expect(normalized.addonPackages[0]).toEqual(
      expect.objectContaining({
        storageAddonId: "storage_50gb",
        catalogStorageLimitBytes: 53687091200,
        catalogRecurringPriceCents: 900,
        activeSubscribers: 1,
        estimatedMargin2xPct: 80,
      })
    );
    expect(normalized.funnel.addRequests.total).toBe(4);
    expect(normalized.funnel.source).toBe("app_error_events");
    expect(normalized.riskQueue[0]?.riskTypes).toEqual(["near_quota"]);
    expect(normalized.dataGaps).toEqual(["invoice proof unavailable"]);
    expect(normalized.health.storageSource).toBe("live_query");
  });

  it("falls back to safe empty values for malformed payloads", () => {
    const normalized = normalizeAdminStorageEconomicsResponse({
      overview: {
        trackedAccounts: "bad",
        estimatedGrossMargin1xPct: "bad",
      },
      providerUsage: {
        status: "weird",
        source: "spreadsheet",
        egressMultiple: "bad",
      },
      byPlan: "bad",
      addonPackages: null,
      funnel: {
        source: "unknown",
      },
      riskQueue: [
        {
          riskTypes: ["over_quota"],
        },
      ],
      dataGaps: ["ok", 123],
      health: {
        degraded: true,
      },
    });

    expect(normalized.overview.trackedAccounts).toBe(0);
    expect(normalized.overview.estimatedGrossMargin1xPct).toBeNull();
    expect(normalized.providerUsage.status).toBe("unavailable");
    expect(normalized.providerUsage.source).toBe("unavailable");
    expect(normalized.providerUsage.egressMultiple).toBeNull();
    expect(normalized.byPlan).toEqual([]);
    expect(normalized.addonPackages).toEqual([]);
    expect(normalized.funnel.source).toBe("unavailable");
    expect(normalized.riskQueue[0]).toEqual(
      expect.objectContaining({
        userId: "unknown",
        riskTypes: ["over_quota"],
      })
    );
    expect(normalized.dataGaps).toEqual(["ok"]);
    expect(normalized.health.degraded).toBe(true);
  });
});

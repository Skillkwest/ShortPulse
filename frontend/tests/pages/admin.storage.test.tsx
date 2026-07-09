import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminStoragePage from "../../pages/admin/storage";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminStorageEconomicsControllerMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminStorageEconomicsController", () => ({
  useAdminStorageEconomicsController: (...args: unknown[]) =>
    useAdminStorageEconomicsControllerMock(...args),
}));

const buildEmptyCountWindow = () => ({
  total: 0,
  last24h: 0,
  last7d: 0,
});

const buildStorageEconomicsState = () => ({
  storageEconomics: {
    assumptions: {
      storageCostPerGbMonth: 0.021,
      uncachedEgressCostPerGb: 0.09,
      cachedEgressCostPerGb: 0.03,
      stripePercent: 0.029,
      stripeFixedCents: 30,
      targetGrossMarginPct: 60,
      computePlan: "medium",
      computeMonthlyCostCents: 6000,
      source: "configured_estimate",
    },
    overview: {
      trackedAccounts: 2,
      accountsWithMedia: 2,
      totalTrackedBytes: 10737418240,
      medianTrackedBytes: 5368709120,
      p90TrackedBytes: 10737418240,
      accountsOver80Pct: 1,
      accountsOverQuota: 0,
      baselineStorageUsers: 1,
      activeAddonSubscribers: 1,
      activeAddonMrrCents: 900,
      activeAddonSoldCapacityBytes: 53687091200,
      estimatedStorageCostCents: 107,
      estimatedEgressCost1xCents: 450,
      estimatedEgressCost2xCents: 900,
      estimatedStripeFeeCents: 56,
      estimatedComputeCostCents: 6000,
      estimatedAddonCost1xCents: 613,
      estimatedAddonCost2xCents: 1063,
      estimatedAddonGrossMargin1xPct: 31.9,
      estimatedAddonGrossMargin2xPct: 26.9,
      estimatedPlanMrrCents: 1900,
      estimatedTotalStorageRevenueCents: 2800,
      estimatedBusinessStorageCostCents: 6141,
      estimatedBusinessStorageMarginPct: -119.3,
      estimatedVariableCost1xCents: 613,
      estimatedVariableCost2xCents: 1063,
      estimatedGrossMargin1xPct: 31.9,
      estimatedGrossMargin2xPct: 26.9,
    },
    providerUsage: {
      status: "current",
      source: "api_import",
      snapshotMonth: "2026-07-01",
      capturedAt: "2026-07-15T00:00:00.000Z",
      supabasePlan: "Pro",
      computePlan: "medium",
      computeMonthlyCostCents: 6000,
      storageUsedGb: 42,
      storageIncludedGb: 100,
      storageQuotaUsedPct: 42,
      projectedStorageUsedGb: 84,
      uncachedEgressGb: 120,
      cachedEgressGb: 60,
      totalEgressGb: 180,
      uncachedEgressIncludedGb: 250,
      cachedEgressIncludedGb: 250,
      uncachedEgressQuotaUsedPct: 48,
      cachedEgressQuotaUsedPct: 24,
      projectedUncachedEgressGb: 240,
      projectedCachedEgressGb: 120,
      egressMultiple: 18,
      estimatedStorageOverageCostCents: 0,
      estimatedUncachedEgressOverageCostCents: 0,
      estimatedCachedEgressOverageCostCents: 0,
      estimatedTotalOverageCostCents: 0,
      observedTotalOverageCostCents: null,
      notes: null,
    },
    byPlan: [
      {
        planId: "starter",
        displayName: "Starter",
        isActive: true,
        visibilityLabel: "active",
        sortOrder: 2,
        catalogStorageLimitBytes: 5368709120,
        catalogRecurringPriceCents: 1900,
        catalogAcquisitionEnabled: true,
        activeStripeContracts: 1,
        contractMrrCents: 1900,
        accountCount: 1,
        usersWithMedia: 1,
        totalTrackedBytes: 10737418240,
        medianTrackedBytes: 10737418240,
        p90TrackedBytes: 10737418240,
        baseLimitBytes: 10737418240,
        addonLimitBytes: 53687091200,
        monthlyStorageGrowthBytes: null,
        accountsOver50Pct: 1,
        accountsOver80Pct: 1,
        accountsOver95Pct: 0,
        accountsOverQuota: 0,
        baselineStorageUsers: 0,
      },
      {
        planId: "payment_exempt",
        displayName: "Payment exempt testers",
        isActive: false,
        visibilityLabel: "hidden/admin only",
        sortOrder: 999,
        catalogStorageLimitBytes: 161061273600,
        catalogRecurringPriceCents: 0,
        catalogAcquisitionEnabled: false,
        activeStripeContracts: 0,
        contractMrrCents: 0,
        accountCount: 1,
        usersWithMedia: 1,
        totalTrackedBytes: 2147483648,
        medianTrackedBytes: 2147483648,
        p90TrackedBytes: 2147483648,
        baseLimitBytes: 161061273600,
        addonLimitBytes: 0,
        monthlyStorageGrowthBytes: null,
        accountsOver50Pct: 0,
        accountsOver80Pct: 0,
        accountsOver95Pct: 0,
        accountsOverQuota: 0,
        baselineStorageUsers: 0,
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
        trackedUsageBytes: 10737418240,
        estimatedStorageCostCents: 107,
        estimatedEgressCost1xCents: 450,
        estimatedEgressCost2xCents: 900,
        estimatedStripeFeeCents: 56,
        estimatedMargin1xPct: 31.9,
        estimatedMargin2xPct: 26.9,
      },
    ],
    funnel: {
      impressions: buildEmptyCountWindow(),
      addClicks: buildEmptyCountWindow(),
      warningViews: buildEmptyCountWindow(),
      addRequests: { total: 2, last24h: 1, last7d: 2 },
      addSuccesses: { total: 1, last24h: 1, last7d: 1 },
      addFailures: buildEmptyCountWindow(),
      removals: buildEmptyCountWindow(),
      source: "app_error_events",
    },
    riskQueue: [
      {
        userId: "user-1",
        userEmail: "starter@example.com",
        planId: "starter",
        trackedBytes: 10737418240,
        totalLimitBytes: 64424509440,
        usagePct: 16.7,
        activeAddonCount: 1,
        riskTypes: ["baseline_storage_usage"],
        details: "baseline storage usage",
      },
    ],
    accountHealth: {
      topStorageAccounts: [
        {
          userId: "user-1",
          userEmail: "starter@example.com",
          planId: "starter",
          trackedBytes: 10737418240,
          totalLimitBytes: 64424509440,
          usagePct: 16.7,
          activeAddonCount: 1,
          opportunityTypes: ["top_storage"],
          details: "Top tracked storage account.",
        },
      ],
      quotaPressureAccounts: [
        {
          userId: "user-2",
          userEmail: "quota@example.com",
          planId: "free",
          trackedBytes: 2147483648,
          totalLimitBytes: 0,
          usagePct: null,
          activeAddonCount: 0,
          opportunityTypes: ["baseline_usage"],
          details: "Tracked storage exists without a base/add-on limit.",
        },
      ],
      addonOpportunityAccounts: [],
    },
    lifecycleHealth: {
      source: "lifecycle_rpc",
      status: "current",
      cleanupTtlDays: 7,
      totalObjectCount: 12,
      totalMb: 2048,
      protectedObjectCount: 10,
      protectedMb: 1700,
      deleteCandidateObjectCount: 1,
      deleteCandidateMb: 2,
      manualReviewObjectCount: 1,
      manualReviewMb: 346,
      integrityProblemObjectCount: 0,
      integrityProblemMb: 0,
      reason: null,
      rows: [
        {
          manifestAction: "manual_review_required",
          manifestReason: "voice source requires lifecycle proof",
          safePathClass: "media_library/voice_changer_source_audio",
          objectCount: 1,
          objectsMissingSizeMetadata: 0,
          totalMb: 346,
          oldestObjectCreatedAt: "2026-07-01T00:00:00.000Z",
          newestObjectCreatedAt: "2026-07-01T00:00:00.000Z",
          youngestAgeDays: 1,
          oldestAgeDays: 1,
        },
      ],
    },
    trend: {
      source: "unavailable",
      status: "unavailable",
      snapshots: [],
      reason: "Historical aggregate storage snapshots are not wired yet.",
    },
    evidence: [
      {
        metricKey: "product_tracked_storage",
        label: "Product-tracked storage",
        source: "product_tracked",
        status: "current",
        capturedAt: null,
        details: "Summed from media_files.file_size and used for customer quota decisions.",
      },
      {
        metricKey: "provider_egress",
        label: "Provider egress and overage",
        source: "provider_snapshot",
        status: "current",
        capturedAt: "2026-07-15T00:00:00.000Z",
        details: "Latest admin provider snapshot row supplies egress evidence.",
      },
    ],
    dataGaps: ["Provider invoice proof is unavailable."],
    health: {
      degraded: false,
      reason: null,
      storageSource: "live_query",
      funnelSource: "app_error_events",
    },
    generatedAt: "2026-07-01T00:00:00.000Z",
  },
  loading: false,
  error: null,
  refresh: vi.fn(),
});

describe("Admin storage page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "admin-1", email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });
    useAdminStorageEconomicsControllerMock.mockReturnValue(buildStorageEconomicsState());
  });

  it("renders storage as a standalone admin page with decision-grade business panels", () => {
    render(<AdminStoragePage />);

    expect(screen.getByRole("heading", { name: "Storage", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Storage" })).toHaveAttribute("href", "/admin/storage");
    expect(screen.getByText("Executive snapshot")).toBeInTheDocument();
    expect(screen.getByText("Storage intelligence")).toBeInTheDocument();
    expect(screen.getByText("Supabase usage")).toBeInTheDocument();
    expect(screen.getByText("Provider pressure")).toBeInTheDocument();
    expect(screen.getAllByText("Current").length).toBeGreaterThan(0);
    expect(screen.getByText(/Production database/)).toBeInTheDocument();
    expect(screen.getByText("Total Egress")).toBeInTheDocument();
    expect(screen.getByText("18.00x product-tracked storage")).toBeInTheDocument();
    expect(screen.getByText("Top storage accounts")).toBeInTheDocument();
    expect(screen.getByText("Quota and add-on opportunities")).toBeInTheDocument();
    expect(screen.getByText("Storage object classes")).toBeInTheDocument();
    expect(screen.getByText("Source confidence")).toBeInTheDocument();
    expect(screen.getByText("Capacity and margin snapshot")).toBeInTheDocument();
    expect(screen.getByText("Product Tracked")).toBeInTheDocument();
    expect(screen.getByText("Add-on Margin")).toBeInTheDocument();
    expect(screen.getByText("Business Margin")).toBeInTheDocument();
    expect(screen.getByText("Storage add-on conversion")).toBeInTheDocument();
    expect(screen.getByText("Estimate boundaries")).toBeInTheDocument();
    expect(screen.getByText("Provider invoice proof is unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Plan Limit")).toBeInTheDocument();
    expect(screen.getByText("Catalog Price")).toBeInTheDocument();
    expect(screen.getByText("Contract MRR")).toBeInTheDocument();
    const planSection = screen.getByRole("heading", { name: "Storage by plan" }).closest("section");
    expect(planSection).toBeTruthy();
    expect(within(planSection as HTMLElement).queryByText("P90")).not.toBeInTheDocument();
    expect(within(planSection as HTMLElement).queryByText("Total Limit")).not.toBeInTheDocument();
    expect(within(planSection as HTMLElement).queryByText("Over 80%")).not.toBeInTheDocument();
    expect(within(planSection as HTMLElement).queryByText("Over")).not.toBeInTheDocument();
    expect(within(planSection as HTMLElement).queryByText("Baseline")).not.toBeInTheDocument();
    expect(within(planSection as HTMLElement).queryByText("Growth")).not.toBeInTheDocument();
    expect(within(planSection as HTMLElement).getByText("Starter")).toBeInTheDocument();
    expect(
      within(planSection as HTMLElement).queryByText("ID: starter • active")
    ).not.toBeInTheDocument();
    expect(
      within(planSection as HTMLElement).getByText("Payment exempt testers")
    ).toBeInTheDocument();
    expect(
      within(planSection as HTMLElement).queryByText("ID: payment_exempt • hidden/admin only")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Starterstarter/)).not.toBeInTheDocument();
    expect(screen.getAllByText("$19")[0]).toBeInTheDocument();
    expect(screen.queryByText("1 Stripe")).not.toBeInTheDocument();
    const addOnsSection = screen
      .getByRole("heading", { name: "Recurring storage packages" })
      .closest("section");
    expect(addOnsSection).toBeTruthy();
    expect(within(addOnsSection as HTMLElement).getByText("Catalog")).toBeInTheDocument();
    expect(within(addOnsSection as HTMLElement).getByText("50 GB")).toBeInTheDocument();
    expect(
      within(addOnsSection as HTMLElement).queryByText("ID: storage_50gb • active")
    ).not.toBeInTheDocument();
    expect(
      within(addOnsSection as HTMLElement).queryByText("$9 • available")
    ).not.toBeInTheDocument();
    expect(within(addOnsSection as HTMLElement).queryByText("Cost 2x")).not.toBeInTheDocument();
    expect(within(addOnsSection as HTMLElement).getByText("Margin 2x")).toBeInTheDocument();
    expect(screen.queryByText(/50 GBstorage_50gb/)).not.toBeInTheDocument();
    const funnelSection = screen
      .getByRole("heading", { name: "Storage add-on conversion" })
      .closest("section");
    expect(funnelSection).toBeTruthy();
    expect(within(funnelSection as HTMLElement).getByText("Requests")).toBeInTheDocument();
    expect(within(funnelSection as HTMLElement).getByText("Successes")).toBeInTheDocument();
    const riskSection = screen
      .getByRole("heading", { name: "Storage risk queue" })
      .closest("section");
    expect(riskSection).toBeTruthy();
    expect(within(riskSection as HTMLElement).getByText("starter@example.com")).toBeInTheDocument();
    expect(within(riskSection as HTMLElement).queryByText("user-1")).not.toBeInTheDocument();
    const lifecycleSection = screen
      .getByRole("heading", { name: "Storage object classes" })
      .closest("section");
    expect(lifecycleSection).toBeTruthy();
    expect(
      within(lifecycleSection as HTMLElement).getByText("media_library/voice_changer_source_audio")
    ).toBeInTheDocument();
    expect(
      within(lifecycleSection as HTMLElement).getAllByText(/report-only/).length
    ).toBeGreaterThan(0);
    const evidenceSection = screen
      .getByRole("heading", { name: "Source confidence" })
      .closest("section");
    expect(evidenceSection).toBeTruthy();
    expect(within(evidenceSection as HTMLElement).getByText("Product rows")).toBeInTheDocument();
    expect(
      within(evidenceSection as HTMLElement).getByText("Provider snapshot")
    ).toBeInTheDocument();
  });

  it("labels egress as configured estimate when no provider egress snapshot backs it", () => {
    const baseState = buildStorageEconomicsState();
    useAdminStorageEconomicsControllerMock.mockReturnValue({
      ...baseState,
      storageEconomics: {
        ...baseState.storageEconomics,
        evidence: baseState.storageEconomics.evidence.map((row) =>
          row.metricKey === "provider_egress"
            ? {
                ...row,
                source: "configured_estimate",
                status: "estimated",
                capturedAt: null,
                details:
                  "Egress uses configured defaults because no provider snapshot row is available.",
              }
            : row
        ),
      },
    });

    render(<AdminStoragePage />);

    expect(screen.getAllByText(/Configured egress estimate/).length).toBeGreaterThan(0);
    const evidenceSection = screen
      .getByRole("heading", { name: "Source confidence" })
      .closest("section");
    expect(evidenceSection).toBeTruthy();
    expect(
      within(evidenceSection as HTMLElement).getByText("Configured estimate")
    ).toBeInTheDocument();
  });

  it("does not render missing Supabase provider evidence as zero usage", () => {
    const baseState = buildStorageEconomicsState();
    useAdminStorageEconomicsControllerMock.mockReturnValue({
      ...baseState,
      storageEconomics: {
        ...baseState.storageEconomics,
        providerUsage: {
          ...baseState.storageEconomics.providerUsage,
          status: "unavailable",
          source: "unavailable",
          snapshotMonth: null,
          capturedAt: null,
          supabasePlan: null,
          storageUsedGb: 0,
          storageIncludedGb: 0,
          storageQuotaUsedPct: null,
          projectedStorageUsedGb: null,
          uncachedEgressGb: 0,
          cachedEgressGb: 0,
          totalEgressGb: 0,
          uncachedEgressIncludedGb: 0,
          cachedEgressIncludedGb: 0,
          uncachedEgressQuotaUsedPct: null,
          cachedEgressQuotaUsedPct: null,
          projectedUncachedEgressGb: null,
          projectedCachedEgressGb: null,
          egressMultiple: null,
        },
      },
    });

    render(<AdminStoragePage />);

    expect(screen.getByText("No Supabase usage snapshot is available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Capture snapshot" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload ShortPulse storage data" })).toHaveAttribute(
      "title",
      "Reload live ShortPulse storage and Supabase production usage."
    );
    expect(screen.getByText("No snapshot")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0 GB")).not.toBeInTheDocument();
  });

  it("does not expose manual provider snapshot entry from the storage page", () => {
    render(<AdminStoragePage />);

    expect(screen.queryByRole("button", { name: "Capture snapshot" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Capture Supabase usage" })
    ).not.toBeInTheDocument();
  });
});

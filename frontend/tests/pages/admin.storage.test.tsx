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
        planId: "starter",
        trackedBytes: 10737418240,
        totalLimitBytes: 64424509440,
        usagePct: 16.7,
        activeAddonCount: 1,
        riskTypes: ["baseline_storage_usage"],
        details: "baseline storage usage",
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

  it("renders storage economics as a standalone admin page", () => {
    render(<AdminStoragePage />);

    expect(screen.getByRole("heading", { name: "Storage", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Storage" })).toHaveAttribute("href", "/admin/storage");
    expect(screen.getByText("Capacity and margin snapshot")).toBeInTheDocument();
    expect(screen.getByText("Provider usage snapshot")).toBeInTheDocument();
    expect(screen.getByText("Supabase pressure")).toBeInTheDocument();
    expect(screen.getByText("Business margin")).toBeInTheDocument();
    expect(screen.getByText("Storage revenue against shared infra")).toBeInTheDocument();
    expect(screen.getByText("Tracked Storage")).toBeInTheDocument();
    expect(screen.getByText("Add-on MRR")).toBeInTheDocument();
    expect(screen.getByText("Egress Multiple")).toBeInTheDocument();
    expect(screen.getByText("18.00x")).toBeInTheDocument();
    expect(screen.getByText("Plan Limit")).toBeInTheDocument();
    expect(screen.getByText("Catalog Price")).toBeInTheDocument();
    expect(screen.getByText("Contract MRR")).toBeInTheDocument();
    expect(screen.getAllByText("$19")[0]).toBeInTheDocument();
    expect(screen.getByText("1 Stripe")).toBeInTheDocument();
    const addOnsSection = screen
      .getByRole("heading", { name: "Recurring storage packages" })
      .closest("section");
    expect(addOnsSection).toBeTruthy();
    expect(within(addOnsSection as HTMLElement).getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Provider invoice proof is unavailable.")).toBeInTheDocument();
  });
});

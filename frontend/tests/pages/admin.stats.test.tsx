import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminStatsPage from "../../pages/admin/stats";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminGlobalStatsControllerMock = vi.hoisted(() => vi.fn());
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

vi.mock("../../features/admin/logic/useAdminGlobalStatsController", () => ({
  useAdminGlobalStatsController: (...args: unknown[]) => useAdminGlobalStatsControllerMock(...args),
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
      storageCostPerGbMonth: 0.0213,
      uncachedEgressCostPerGb: 0.09,
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
      estimatedVariableCost1xCents: 6613,
      estimatedVariableCost2xCents: 7063,
      estimatedGrossMargin1xPct: 26.5,
      estimatedGrossMargin2xPct: 21.5,
    },
    byPlan: [
      {
        planId: "starter",
        displayName: "Starter",
        isActive: true,
        sortOrder: 2,
        catalogStorageLimitBytes: 5368709120,
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

describe("Admin stats page", () => {
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
    const baseControllerState = {
      overview: {
        generateClicks: buildEmptyCountWindow(),
        acceptedGenerations: buildEmptyCountWindow(),
        successfulGenerations: buildEmptyCountWindow(),
        failedGenerations: buildEmptyCountWindow(),
        savedGenerations: buildEmptyCountWindow(),
        projectAttachedGenerations: buildEmptyCountWindow(),
        uniqueGenerationUsers: 0,
        uniqueClickUsers: 0,
        uniqueSavingUsers: 0,
        uniqueModels: 0,
        pendingGenerations: 0,
        runningGenerations: 0,
        lastGenerationAt: null,
        lastGenerateClickAt: null,
      },
      models: [],
      workflows: {
        highlights: {
          styleAppliedGenerations: buildEmptyCountWindow(),
          characterModeGenerations: buildEmptyCountWindow(),
          referenceAssistedGenerations: buildEmptyCountWindow(),
          styleClicks: buildEmptyCountWindow(),
          characterModeClicks: buildEmptyCountWindow(),
          referenceAssistedClicks: buildEmptyCountWindow(),
        },
        byTool: [],
        byMode: [],
      },
      assets: {
        autosave: {
          autoPersisted: buildEmptyCountWindow(),
          autosaveSkipped: buildEmptyCountWindow(),
        },
        events: [],
      },
      projects: {
        summary: {
          projectsCreated: buildEmptyCountWindow(),
          activeProjectsWithGenerations: buildEmptyCountWindow(),
          attachedGenerations: buildEmptyCountWindow(),
          attachedMedia: buildEmptyCountWindow(),
          attachedPrompts: buildEmptyCountWindow(),
        },
        leaderboard: [],
      },
      health: {
        degraded: false,
        reason: null,
        overviewSource: "legacy_fallback",
        modelsSource: "unavailable",
        workflowsSource: "unavailable",
        assetsSource: "unavailable",
        projectsSource: "unavailable",
      },
      growth: {
        marketing: {
          summary: {
            signups: buildEmptyCountWindow(),
            activatedUsers: buildEmptyCountWindow(),
            activationRatePct: buildEmptyCountWindow(),
            medianHours: {
              signupToGenerate: null,
              signupToSuccess: null,
              signupToActivation: null,
              generateToActivation: null,
            },
          },
          retention: {
            activated: {
              cohortSize: 0,
              eligibleD1: 0,
              retainedD1: 0,
              d1RatePct: 0,
              eligibleD7: 0,
              retainedD7: 0,
              d7RatePct: 0,
              eligibleD30: 0,
              retainedD30: 0,
              d30RatePct: 0,
            },
            nonActivated: {
              cohortSize: 0,
              eligibleD1: 0,
              retainedD1: 0,
              d1RatePct: 0,
              eligibleD7: 0,
              retainedD7: 0,
              d7RatePct: 0,
              eligibleD30: 0,
              retainedD30: 0,
              d30RatePct: 0,
            },
          },
          attribution: {
            sources: [],
            campaigns: [],
          },
        },
        sales: {
          summary: {
            pricingViewedUsers: buildEmptyCountWindow(),
            upgradeClickedUsers: buildEmptyCountWindow(),
            checkoutStartedUsers: buildEmptyCountWindow(),
            checkoutCompletedUsers: buildEmptyCountWindow(),
            paidConvertedUsers: buildEmptyCountWindow(),
            pqlUsers: buildEmptyCountWindow(),
            activatedToPqlRatePct: 0,
            pqlToPaidRatePct: 0,
          },
          highIntentUsers: [],
        },
        health: {
          degraded: false,
          reason: null,
          marketingSource: "unavailable",
          salesSource: "unavailable",
        },
      },
      generatedAt: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    };
    useAdminGlobalStatsControllerMock.mockReturnValue(baseControllerState);
    useAdminStorageEconomicsControllerMock.mockReturnValue(buildStorageEconomicsState());
  });

  it("shows a structured warning when stats loading fails", () => {
    useAdminGlobalStatsControllerMock.mockReturnValue({
      overview: {
        generateClicks: buildEmptyCountWindow(),
        acceptedGenerations: buildEmptyCountWindow(),
        successfulGenerations: buildEmptyCountWindow(),
        failedGenerations: buildEmptyCountWindow(),
        savedGenerations: buildEmptyCountWindow(),
        projectAttachedGenerations: buildEmptyCountWindow(),
        uniqueGenerationUsers: 0,
        uniqueClickUsers: 0,
        uniqueSavingUsers: 0,
        uniqueModels: 0,
        pendingGenerations: 0,
        runningGenerations: 0,
        lastGenerationAt: null,
        lastGenerateClickAt: null,
      },
      models: [],
      workflows: {
        highlights: {
          styleAppliedGenerations: buildEmptyCountWindow(),
          characterModeGenerations: buildEmptyCountWindow(),
          referenceAssistedGenerations: buildEmptyCountWindow(),
          styleClicks: buildEmptyCountWindow(),
          characterModeClicks: buildEmptyCountWindow(),
          referenceAssistedClicks: buildEmptyCountWindow(),
        },
        byTool: [],
        byMode: [],
      },
      assets: {
        autosave: {
          autoPersisted: buildEmptyCountWindow(),
          autosaveSkipped: buildEmptyCountWindow(),
        },
        events: [],
      },
      projects: {
        summary: {
          projectsCreated: buildEmptyCountWindow(),
          activeProjectsWithGenerations: buildEmptyCountWindow(),
          attachedGenerations: buildEmptyCountWindow(),
          attachedMedia: buildEmptyCountWindow(),
          attachedPrompts: buildEmptyCountWindow(),
        },
        leaderboard: [],
      },
      health: {
        degraded: false,
        reason: null,
        overviewSource: "legacy_fallback",
        modelsSource: "unavailable",
        workflowsSource: "unavailable",
        assetsSource: "unavailable",
        projectsSource: "unavailable",
      },
      growth: {
        marketing: {
          summary: {
            signups: buildEmptyCountWindow(),
            activatedUsers: buildEmptyCountWindow(),
            activationRatePct: buildEmptyCountWindow(),
            medianHours: {
              signupToGenerate: null,
              signupToSuccess: null,
              signupToActivation: null,
              generateToActivation: null,
            },
          },
          retention: {
            activated: {
              cohortSize: 0,
              eligibleD1: 0,
              retainedD1: 0,
              d1RatePct: 0,
              eligibleD7: 0,
              retainedD7: 0,
              d7RatePct: 0,
              eligibleD30: 0,
              retainedD30: 0,
              d30RatePct: 0,
            },
            nonActivated: {
              cohortSize: 0,
              eligibleD1: 0,
              retainedD1: 0,
              d1RatePct: 0,
              eligibleD7: 0,
              retainedD7: 0,
              d7RatePct: 0,
              eligibleD30: 0,
              retainedD30: 0,
              d30RatePct: 0,
            },
          },
          attribution: {
            sources: [],
            campaigns: [],
          },
        },
        sales: {
          summary: {
            pricingViewedUsers: buildEmptyCountWindow(),
            upgradeClickedUsers: buildEmptyCountWindow(),
            checkoutStartedUsers: buildEmptyCountWindow(),
            checkoutCompletedUsers: buildEmptyCountWindow(),
            paidConvertedUsers: buildEmptyCountWindow(),
            pqlUsers: buildEmptyCountWindow(),
            activatedToPqlRatePct: 0,
            pqlToPaidRatePct: 0,
          },
          highIntentUsers: [],
        },
        health: {
          degraded: false,
          reason: null,
          marketingSource: "unavailable",
          salesSource: "unavailable",
        },
      },
      generatedAt: null,
      loading: false,
      error: 'column reference "model_id" is ambiguous',
      refresh: vi.fn(),
    });

    render(<AdminStatsPage />);

    expect(screen.getByText("Some stats sources failed to load.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The stats workspace has fallen back to safe empty values until the next refresh succeeds."
      )
    ).toBeInTheDocument();
    expect(screen.getByText('column reference "model_id" is ambiguous')).toBeInTheDocument();
  });

  it("renders Product, Marketing, Sales, and Storage lens tabs", () => {
    render(<AdminStatsPage />);

    expect(screen.getByRole("button", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sales" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Storage" })).toBeInTheDocument();
  });

  it("renders the Storage lens from the storage economics controller", () => {
    render(<AdminStatsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Storage" }));

    expect(screen.getByText("Local estimates")).toBeInTheDocument();
    expect(screen.getByText("Capacity and margin snapshot")).toBeInTheDocument();
    expect(screen.getByText("Tracked Storage")).toBeInTheDocument();
    expect(screen.getByText("Add-on MRR")).toBeInTheDocument();
    expect(screen.getByText("Plan Limit")).toBeInTheDocument();
    expect(screen.getByText("Recurring storage packages")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Provider invoice proof is unavailable.")).toBeInTheDocument();
  });
});

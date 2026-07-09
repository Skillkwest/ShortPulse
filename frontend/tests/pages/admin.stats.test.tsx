import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminStatsPage from "../../pages/admin/stats";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminGlobalStatsControllerMock = vi.hoisted(() => vi.fn());
const useAdminCustomerAnalyticsControllerMock = vi.hoisted(() => vi.fn());
const useRouterMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../features/admin/logic/useAdminCustomerAnalyticsController", () => ({
  useAdminCustomerAnalyticsController: (...args: unknown[]) =>
    useAdminCustomerAnalyticsControllerMock(...args),
}));

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

const buildEmptyCountWindow = () => ({
  total: 0,
  last24h: 0,
  last7d: 0,
});

const buildEmptyGenerationBreakdown = () => ({
  summary: {
    acceptedGenerations: buildEmptyCountWindow(),
    successfulGenerations: buildEmptyCountWindow(),
    failedGenerations: buildEmptyCountWindow(),
    imageGenerations: buildEmptyCountWindow(),
    videoGenerations: buildEmptyCountWindow(),
    audioGenerations: buildEmptyCountWindow(),
    unknownGenerations: buildEmptyCountWindow(),
    uniqueUsers: 0,
    uniqueModels: 0,
    lastGenerationAt: null,
  },
  users: [],
  modelMediaTypes: [],
});

const buildEmptyGrowthCohorts = () => ({
  summary: {
    signedUp: 0,
    currentlySubscribed: 0,
    signedUpNotSubscribed: 0,
    neverSubscribed: 0,
    lapsedOrCanceled: 0,
    notSubscribedNoGeneration: 0,
    notSubscribedWithGeneration: 0,
    notSubscribedWithSuccess: 0,
    notSubscribedWithSavedOutput: 0,
    everPaidConverted: 0,
    boughtCredits: 0,
    activeStorageAddons: 0,
    subscribedAndGenerated: 0,
    subscribedNoGeneration: 0,
    subscribedBoughtCredits: 0,
    subscribedBoughtStorageAddons: 0,
    subscribedBoughtCreditsAndAddons: 0,
  },
  conversionTargetRows: [],
});

const buildCustomerAnalyticsResponse = () => ({
  generatedAt: "2026-04-30T12:00:00.000Z",
  target: {
    userId: "22222222-2222-4222-8222-222222222222",
    email: "alpha@example.com",
    createdAt: "2026-03-02T12:00:00.000Z",
    lastSignInAt: "2026-04-29T12:00:00.000Z",
  },
  credits: {
    spendableCredits: 5000,
    availableCredits: 5000,
    reservedCredits: 0,
    totalCreditsSpent: 3200,
    currentCycleSpentCredits: 88,
    generationCreditsSpent: 2800,
    expiringCredits: 1200,
    nonExpiringCredits: 3800,
    nextExpiringCredits: 1200,
    nextExpiresAt: "2026-05-20T12:00:00.000Z",
    source: "exact",
  },
  billing: {
    status: "active",
    contractSource: "stripe",
    recurringPriceCents: 3000,
    billingInterval: "month",
    monthlyRecurringRevenueCents: 3000,
    renewalAt: "2026-04-30T12:00:00.000Z",
    paymentExempt: false,
    source: "exact",
  },
  revenue: {
    totalRevenueCents: 14900,
    subscriptionRevenueCents: 9900,
    topUpRevenueCents: 5000,
    invoiceCount: 3,
    topUpPurchaseCount: 2,
    source: "stripe",
    note: "Subscription and storage revenue is summed from the most recent paid Stripe invoices.",
  },
  topUps: {
    purchaseCount: 2,
    creditsPurchased: 2500,
    revenueCents: 5000,
    source: "local_ledger",
  },
  generations: {
    total: 42,
    succeeded: 39,
    failed: 1,
    last30dTotal: 12,
    last30dSucceeded: 11,
    last30dFailed: 0,
    byStatus: { success: 39, fail: 1 },
    source: "generation_rows",
  },
  mediaBreakdown: {
    images: 20,
    videos: 8,
    audio: 10,
    voices: 4,
    music: 3,
    soundEffects: 2,
    unknownAudio: 1,
    unknown: 4,
    source: "generation_rows",
  },
  storage: {
    usedBytes: 2147483648,
    totalLimitBytes: 536870912000,
    addonLimitBytes: 0,
    remainingBytes: 534723428352,
    isOverLimit: false,
    source: "exact",
  },
  agentUsage: {
    standard: {
      turns: null,
      source: "unavailable",
      note: "Standard agent route telemetry is not durable yet.",
    },
    pulse: {
      turns: null,
      source: "unavailable",
      note: "Pulse agent route telemetry is not durable yet.",
    },
  },
  sourceHealth: [
    {
      key: "target",
      label: "Customer identity",
      status: "exact",
      detail: "Loaded Supabase auth identity.",
    },
  ],
});

describe("Admin stats page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ query: {} });
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
    useAdminCustomerAnalyticsControllerMock.mockReturnValue({
      customerIdInput: "",
      activeCustomerId: null,
      analytics: null,
      loading: false,
      error: null,
      loaded: false,
      setCustomerIdInput: vi.fn(),
      loadCustomerAnalytics: vi.fn(),
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
      generationBreakdown: buildEmptyGenerationBreakdown(),
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
          firstValueFunnel: {
            steps: [],
            gaps: [],
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
          cohorts: buildEmptyGrowthCohorts(),
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
          cohortsSource: "unavailable",
        },
      },
      generatedAt: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    };
    useAdminGlobalStatsControllerMock.mockReturnValue(baseControllerState);
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
      generationBreakdown: buildEmptyGenerationBreakdown(),
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
          firstValueFunnel: {
            steps: [],
            gaps: [],
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
          cohorts: buildEmptyGrowthCohorts(),
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
          cohortsSource: "unavailable",
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

  it("renders Product, Marketing, and Sales lens tabs", () => {
    render(<AdminStatsPage />);

    expect(screen.getByTestId("admin-customer-analytics-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customer detail" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sales" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Storage" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Storage" })).toHaveAttribute("href", "/admin/storage");
  });

  it("renders selected-customer analytics in the stats page", () => {
    useRouterMock.mockReturnValue({
      query: { customerId: "22222222-2222-4222-8222-222222222222" },
    });
    useAdminCustomerAnalyticsControllerMock.mockReturnValue({
      customerIdInput: "22222222-2222-4222-8222-222222222222",
      activeCustomerId: "22222222-2222-4222-8222-222222222222",
      analytics: buildCustomerAnalyticsResponse(),
      loading: false,
      error: null,
      loaded: true,
      setCustomerIdInput: vi.fn(),
      loadCustomerAnalytics: vi.fn(),
    });

    render(<AdminStatsPage />);

    expect(useAdminCustomerAnalyticsControllerMock).toHaveBeenCalledWith({
      enabled: true,
      initialCustomerId: "22222222-2222-4222-8222-222222222222",
    });
    expect(screen.getByText("alpha@example.com")).toBeInTheDocument();
    expect(screen.getByText("Total revenue")).toBeInTheDocument();
    expect(screen.getByText("$149.00")).toBeInTheDocument();
    expect(screen.getByText("MRR")).toBeInTheDocument();
    expect(screen.getByText("Voices")).toBeInTheDocument();
    expect(screen.getAllByText("Source health").length).toBeGreaterThan(0);
    expect(screen.getByText(/Loaded Supabase auth identity/)).toBeInTheDocument();
  });

  it("renders conversion target cohorts in the Marketing lens", () => {
    const baseState = useAdminGlobalStatsControllerMock();
    useAdminGlobalStatsControllerMock.mockClear();
    useAdminGlobalStatsControllerMock.mockReturnValue({
      ...baseState,
      growth: {
        ...baseState.growth,
        marketing: {
          ...baseState.growth.marketing,
          cohorts: {
            ...baseState.growth.marketing.cohorts,
            summary: {
              ...baseState.growth.marketing.cohorts.summary,
              signedUp: 27,
              currentlySubscribed: 4,
              signedUpNotSubscribed: 23,
              neverSubscribed: 21,
              lapsedOrCanceled: 2,
            },
          },
        },
      },
    });

    render(<AdminStatsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Marketing" }));

    expect(
      screen.getByText("21 accounts created with no subscription purchase")
    ).toBeInTheDocument();
    expect(screen.getByText("Created, Never Purchased")).toBeInTheDocument();
    expect(
      screen.getByText("23 no current paid subscription • 2 lapsed or canceled")
    ).toBeInTheDocument();
    expect(screen.getByText("No Generation Yet")).toBeInTheDocument();
    expect(
      screen.getByText("No signed-up non-subscriber targets are available yet.")
    ).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminStatsPage from "../../pages/admin/stats";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminGlobalStatsControllerMock = vi.hoisted(() => vi.fn());

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

    expect(screen.getByRole("button", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sales" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Storage" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Storage" })).toHaveAttribute("href", "/admin/storage");
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

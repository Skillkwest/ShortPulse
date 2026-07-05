/**
 * Dashboard page tests for profile-menu and logout behavior.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedDashboardView } from "../../features/dashboard/components/AuthenticatedDashboardView";
import { SHORTPULSE_COMMUNITY_URL } from "../../features/dashboard/communityLinks";
import { DashboardAppBar } from "../../features/dashboard/components/DashboardAppBar";
import { resetBillingAccountSummaryClientStateForTests } from "../../features/billing/accountSummary";
import DashboardPage from "../../pages/dashboard";

const useRouterMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionMock = vi.hoisted(() => vi.fn());
const refreshSupabaseSessionMock = vi.hoisted(() => vi.fn());
const readPersistedSupabaseSessionHintMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());
const signOutSupabaseSessionMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const isAuthRequiredErrorMock = vi.hoisted(() => vi.fn());
const isAuthSessionTimeoutErrorMock = vi.hoisted(() => vi.fn());
const publicFetchMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  } & Record<string, unknown>) => {
    void _prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <div aria-label={alt} data-next-image={String(rest.src ?? "")} />
  ),
}));

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../../features/ai-studio/hooks/useCredits", () => ({
  useCredits: (...args: unknown[]) => useCreditsMock(...args),
}));

vi.mock("../../features/billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: (...args: unknown[]) => useMediaStorageQuotaSummaryMock(...args),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  ensureSupabaseQueryClient: (...args: unknown[]) => ensureSupabaseQueryClientMock(...args),
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
  readSupabaseSession: (...args: unknown[]) => readSupabaseSessionMock(...args),
  refreshSupabaseSession: (...args: unknown[]) => refreshSupabaseSessionMock(...args),
  readPersistedSupabaseSessionHint: (...args: unknown[]) =>
    readPersistedSupabaseSessionHintMock(...args),
  signOutSupabaseSession: (...args: unknown[]) => signOutSupabaseSessionMock(...args),
}));

vi.mock("../../lib/supabaseSessionHints", async () => {
  const actual = await vi.importActual<typeof import("../../lib/supabaseSessionHints")>(
    "../../lib/supabaseSessionHints"
  );
  return {
    ...actual,
    readPersistedSupabaseSessionHint: (...args: unknown[]) =>
      readPersistedSupabaseSessionHintMock(...args),
    readSupabaseSessionBootstrapHint: (...args: unknown[]) =>
      readSupabaseSessionBootstrapHintMock(...args),
  };
});

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  isAuthRequiredError: (...args: unknown[]) => isAuthRequiredErrorMock(...args),
  isAuthSessionTimeoutError: (...args: unknown[]) => isAuthSessionTimeoutErrorMock(...args),
}));

const appUser = {
  id: "user-1",
  email: "user@example.com",
  user_metadata: {
    display_name: "Kirk",
    plan: "business",
  },
};

const buildSupabaseClient = () => ({
  auth: {
    signOut: signOutMock,
  },
  from: vi.fn((table: string) => {
    if (table === "billing_subscription_contracts") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { plan_id: "business", monthly_credits_cents: 12000 },
                error: null,
              })),
            })),
          })),
        })),
      };
    }
    if (table === "billing_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { plan_id: "business" }, error: null })),
          })),
        })),
      };
    }
    if (table === "billing_plans") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [],
            error: null,
          })),
        })),
      };
    }
    if (table === "media_files") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [{ file_size: 1024 }],
            error: null,
          })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  }),
});

describe("Dashboard actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerReplaceMock.mockReset();
    routerPushMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });
    signOutSupabaseSessionMock.mockReset();
    signOutSupabaseSessionMock.mockResolvedValue(undefined);
    publicFetchMock.mockReset();
    vi.stubGlobal("fetch", publicFetchMock);
    publicFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tutorials: [] }),
    });
    resetBillingAccountSummaryClientStateForTests();

    useRouterMock.mockReturnValue({ replace: routerReplaceMock, push: routerPushMock });
    useCreditsMock.mockReturnValue({
      balanceCents: 86,
      balanceLoading: false,
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: {
        usedBytes: 1024,
        baseLimitBytes: 500 * 1024 * 1024 * 1024,
        addonLimitBytes: 0,
        totalLimitBytes: 500 * 1024 * 1024 * 1024,
        remainingBytes: 500 * 1024 * 1024 * 1024 - 1024,
        isOverLimit: false,
      },
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: appUser },
      user: appUser,
    });
    readSupabaseSessionMock.mockResolvedValue({ user: appUser });
    refreshSupabaseSessionMock.mockResolvedValue({ user: appUser });
    isAuthRequiredErrorMock.mockReturnValue(false);
    isAuthSessionTimeoutErrorMock.mockReturnValue(false);
    readPersistedSupabaseSessionHintMock.mockReturnValue(true);
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);
    ensureSupabaseClientMock.mockReturnValue(buildSupabaseClient());
    ensureSupabaseQueryClientMock.mockReturnValue(buildSupabaseClient());
    fetchWithAuthMock.mockImplementation(async (input: unknown) => {
      if (input === "/api/announcements/active") {
        return {
          ok: true,
          json: async () => ({ announcement: null }),
        };
      }
      if (input === "/api/billing/account-summary") {
        return {
          ok: true,
          json: async () => ({
            userId: "user-1",
            resolvedPlan: {
              id: "business",
              label: "Business",
              className: "plan-business",
              monthlyCreditsCents: 12_000,
            },
            quotaStatus: "available",
            quotaSummary: {
              usedBytes: 1024,
              baseLimitBytes: 500 * 1024 * 1024 * 1024,
              addonLimitBytes: 0,
              totalLimitBytes: 500 * 1024 * 1024 * 1024,
              remainingBytes: 500 * 1024 * 1024 * 1024 - 1024,
              isOverLimit: false,
            },
          }),
        };
      }
      if (input === "/api/account/media-compliance") {
        return {
          ok: true,
          json: async () => ({
            agreement: {
              version: "test-media-compliance",
              title: "Media agreement",
              summary: "Test media compliance agreement.",
              bullets: [],
            },
            accepted: true,
            acceptedAt: "2026-06-29T00:00:00.000Z",
          }),
        };
      }
      if (input === "/api/projects?limit=12&offset=0&previewMode=none") {
        return {
          ok: true,
          json: async () => ({
            projects: [
              {
                id: "project-1",
                title: "Project One",
                createdAt: "2026-04-23T00:00:00.000Z",
                updatedAt: "2026-04-23T01:00:00.000Z",
              },
              {
                id: "project-2",
                title: "Project Two",
                createdAt: "2026-04-22T00:00:00.000Z",
                updatedAt: "2026-04-22T01:00:00.000Z",
              },
            ],
            hasMore: true,
            nextOffset: 2,
          }),
        };
      }
      if (input === "/api/projects?limit=12&offset=2&previewMode=none") {
        return {
          ok: true,
          json: async () => ({
            projects: [
              {
                id: "project-3",
                title: "Project Three",
                createdAt: "2026-04-21T00:00:00.000Z",
                updatedAt: "2026-04-21T01:00:00.000Z",
              },
            ],
            hasMore: false,
            nextOffset: null,
          }),
        };
      }
      if (input === "/api/projects/create") {
        return {
          ok: true,
          json: async () => ({
            project: {
              id: "project-created",
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.getElementById("__next-route-announcer__")?.remove();
    document.title = "";
    document.body.classList.remove("dashboard-body");
    document.documentElement.classList.remove("dashboard-body");
  });

  it("adds and removes dashboard body classes", async () => {
    const { unmount } = render(<DashboardPage />);

    expect(
      await screen.findByRole("button", { name: "Profile menu" }, { timeout: 5000 })
    ).toBeInTheDocument();

    expect(document.body.classList.contains("dashboard-body")).toBe(true);
    expect(document.documentElement.classList.contains("dashboard-body")).toBe(true);

    unmount();

    expect(document.body.classList.contains("dashboard-body")).toBe(false);
    expect(document.documentElement.classList.contains("dashboard-body")).toBe(false);
  });

  it("renders the signed-in dashboard logo without home navigation", async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByRole("button", { name: "Profile menu" }, { timeout: 5000 })
    ).toBeInTheDocument();

    expect(screen.getByLabelText("ShortPulse logo")).toBeInTheDocument();
    expect(document.querySelector(".app-bar .brand-mark-logo")).not.toHaveAttribute("href");
  });

  it("renders the dashboard logo with a ShortPulse wordmark", () => {
    render(<DashboardAppBar cards={[]} actionSlot={<span />} brandHref={null} />);

    expect(screen.getByLabelText("ShortPulse logo")).toBeInTheDocument();
    expect(screen.getByText("ShortPulse")).toBeInTheDocument();
    expect(document.querySelector(".app-bar .brand-mark-logo")).not.toHaveAttribute("href");
  });

  it("updates the route announcer when the authenticated dashboard branch resolves", async () => {
    const routeAnnouncer = document.createElement("p");
    routeAnnouncer.id = "__next-route-announcer__";
    routeAnnouncer.textContent = "ShortPulse · Home";
    document.body.appendChild(routeAnnouncer);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Profile menu" })).toBeInTheDocument();
    });
    expect(routeAnnouncer).toHaveTextContent("ShortPulse · Dashboard");
    expect(document.title).toBe("ShortPulse · Dashboard");
  });

  it("falls back to a trimmed full name when profile display name metadata is blank", async () => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: {
        user: {
          ...appUser,
          user_metadata: {
            display_name: "   ",
            full_name: " Ada Lovelace ",
          },
        },
      },
      user: {
        ...appUser,
        user_metadata: {
          display_name: "   ",
          full_name: " Ada Lovelace ",
        },
      },
    });

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: /hello, ada/i })).toBeInTheDocument();
  });

  it("uses the email handle instead of the full email address for the dashboard hero greeting", async () => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: {
        user: {
          ...appUser,
          email: "skillkwest@gmail.com",
          user_metadata: {
            display_name: "   ",
            full_name: "   ",
          },
        },
      },
      user: {
        ...appUser,
        email: "skillkwest@gmail.com",
        user_metadata: {
          display_name: "   ",
          full_name: "   ",
        },
      },
    });

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: /hello, skillkwest/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /gmail\.com/i })).not.toBeInTheDocument();
  });

  it("links signed-in dashboard account summary cards to profile account sections", async () => {
    render(<DashboardPage />);

    expect(await screen.findByRole("link", { name: /^Creator hub:/i })).toHaveAttribute(
      "href",
      SHORTPULSE_COMMUNITY_URL
    );
    expect(
      await screen.findByRole("link", { name: "Media Storage: 0.0 MB / 500 GB" })
    ).toHaveAttribute("href", "/profile?section=storage");
    expect(await screen.findByRole("link", { name: "AI credits: 86 / 12,000" })).toHaveAttribute(
      "href",
      "/profile?section=credits"
    );
    expect(await screen.findByRole("link", { name: /^Plan:/i })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );

    expect(document.querySelector('[data-next-image="/Community.svg"]')).toBeInTheDocument();
    expect(document.querySelector('[data-next-image="/Media.svg"]')).toBeInTheDocument();
    expect(document.querySelector('[data-next-image="/Credits.svg"]')).toBeInTheDocument();
    expect(document.querySelector('[data-next-image="/Plan.svg"]')).toBeInTheDocument();
  });

  it("uses signed-in labels for shared footer links", async () => {
    render(<DashboardPage />);

    await screen.findByRole("button", { name: "Profile menu" });
    const footer = await screen.findByRole("contentinfo", { name: "ShortPulse footer" });

    expect(within(footer).getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/profile?section=account"
    );
    expect(within(footer).getByRole("link", { name: "Subscription" })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
    expect(within(footer).queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Join Free" })).toHaveAttribute(
      "href",
      SHORTPULSE_COMMUNITY_URL
    );
    expect(within(footer).getByRole("button", { name: "Open AI Studio" })).toBeInTheDocument();
    expect(within(footer).queryByRole("link", { name: "Open AI Studio" })).not.toBeInTheDocument();
  });

  it("routes the signed-in footer Open AI Studio action through new project creation", async () => {
    render(<DashboardPage />);

    await screen.findByRole("button", { name: "Profile menu" });
    const footer = await screen.findByRole("contentinfo", { name: "ShortPulse footer" });
    fireEvent.click(within(footer).getByRole("button", { name: "Open AI Studio" }));

    expect(await screen.findByRole("dialog", { name: "Name project" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Footer Campaign" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/projects/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Footer Campaign" }),
        })
      );
      expect(routerPushMock).toHaveBeenCalledWith({
        pathname: "/ai-studio",
        query: {
          projectId: "project-created",
        },
      });
    });
  });

  it("opens the profile menu with account sections, issue reporting, and logout", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));

    const menu = screen.getByRole("menu", { name: "Account settings" });
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveClass("toolbar-account-menu");
    expect(within(menu).getByText("Kirk")).toBeInTheDocument();
    expect(within(menu).getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/profile?section=account"
    );
    expect(screen.getByRole("menuitem", { name: "Billing" })).toHaveAttribute(
      "href",
      "/profile?section=account#billing"
    );
    expect(screen.getByRole("menuitem", { name: "Subscription" })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
    expect(screen.getByRole("menuitem", { name: "Credits" })).toHaveAttribute(
      "href",
      "/profile?section=credits"
    );
    expect(screen.getByRole("menuitem", { name: "Storage" })).toHaveAttribute(
      "href",
      "/profile?section=storage"
    );
    expect(screen.getByRole("menuitem", { name: "Transactions" })).toHaveAttribute(
      "href",
      "/profile?section=transactions"
    );
    expect(screen.getByRole("menuitem", { name: "Report an issue" })).toHaveAttribute(
      "href",
      "/report-issue?from=%2Fdashboard"
    );
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("opens and closes the logout confirmation modal", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(screen.getByRole("dialog", { name: "Log out?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument();
    });
  });

  it("signs out and redirects home after logout confirmation", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(signOutSupabaseSessionMock).toHaveBeenCalledTimes(1);
      expect(routerReplaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("creates a project and routes into AI Studio with project identity", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: /New Project:/i }));
    expect(await screen.findByRole("dialog", { name: "Name project" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Launch Campaign" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/projects/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Launch Campaign" }),
        })
      );
      expect(routerPushMock).toHaveBeenCalledWith({
        pathname: "/ai-studio",
        query: {
          projectId: "project-created",
        },
      });
    });
  });

  it("closes the new project modal with Escape", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: /New Project:/i }));
    expect(await screen.findByRole("dialog", { name: "Name project" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Name project" })).not.toBeInTheDocument();
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalledWith("/api/projects/create", expect.anything());
  });

  it("opens the shared projects modal from the dashboard projects card", async () => {
    render(<DashboardPage />);

    expect(
      screen.queryByRole("button", { name: "Open project Project One" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", { name: "Open Projects: Open saved projects" })
    );

    expect(await screen.findByRole("dialog", { name: "Projects" })).toBeInTheDocument();
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/projects?limit=12&offset=0&previewMode=none",
      expect.objectContaining({ method: "GET" })
    );

    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));

    expect(
      await screen.findByRole("button", { name: "Select project Project Three" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select project Project One" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open project Project One" }));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith({
        pathname: "/ai-studio",
        query: {
          projectId: "project-1",
        },
      });
    });
  });

  it("keeps the legacy dashboard flag off retired onboarding routes", () => {
    render(
      <AuthenticatedDashboardView
        dashboardAnnouncement={null}
        dashboardFallbackHelperCopy="Start a project from your dashboard."
        dashboardTutorials={[]}
        firstName="Kirk"
        hideLegacySections={false}
        isCreatingProject={false}
        projectCreateError={null}
        toolCards={[]}
        onCreateProject={vi.fn()}
        onOpenProjects={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /New Project:/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Projects: Open saved projects" })
    ).toBeInTheDocument();
    expect(document.querySelector('a[href^="/onboarding"]')).not.toBeInTheDocument();
  });
});

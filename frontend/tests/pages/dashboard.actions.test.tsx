/**
 * Dashboard page tests for profile-menu and logout behavior.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../../pages/dashboard";

const useRouterMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const readPersistedSupabaseSessionHintMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());
const signOutSupabaseSessionMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
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
              maybeSingle: vi.fn(async () => ({ data: { plan_id: "business" }, error: null })),
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
    document.body.classList.remove("dashboard-body");
    document.documentElement.classList.remove("dashboard-body");
  });

  it("adds and removes dashboard body classes", async () => {
    const { unmount } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Profile menu" })).toBeInTheDocument();
    });

    expect(document.body.classList.contains("dashboard-body")).toBe(true);
    expect(document.documentElement.classList.contains("dashboard-body")).toBe(true);

    unmount();

    expect(document.body.classList.contains("dashboard-body")).toBe(false);
    expect(document.documentElement.classList.contains("dashboard-body")).toBe(false);
  });

  it("renders the signed-in dashboard logo without home navigation", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Profile menu" })).toBeInTheDocument();
    });

    expect(screen.getByLabelText("ShortPulse logo")).toBeInTheDocument();
    expect(document.querySelector(".app-bar .brand-mark-logo")).not.toHaveAttribute("href");
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

    expect(
      await screen.findByRole("heading", { name: /welcome back, ada\./i })
    ).toBeInTheDocument();
  });

  it("links signed-in dashboard account summary cards to profile account sections", async () => {
    render(<DashboardPage />);

    expect(await screen.findByRole("link", { name: /^Media Storage:/i })).toHaveAttribute(
      "href",
      "/profile?section=storage"
    );
    expect(await screen.findByRole("link", { name: /^AI credits:/i })).toHaveAttribute(
      "href",
      "/profile?section=credits"
    );
    expect(await screen.findByRole("link", { name: /^Plan:/i })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
  });

  it("opens the profile menu with account, subscription, billing, and issue-report links", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));

    expect(screen.getByRole("link", { name: "Account & profile settings" })).toHaveAttribute(
      "href",
      "/profile?section=account"
    );
    expect(screen.getByRole("link", { name: "Subscription plans" })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
    expect(screen.getByRole("link", { name: "Credits & billing" })).toHaveAttribute(
      "href",
      "/profile?section=credits"
    );
    expect(screen.getByRole("link", { name: "Report an issue" })).toHaveAttribute(
      "href",
      "/report-issue?from=%2Fdashboard"
    );
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("opens and closes the logout confirmation modal", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByRole("dialog", { name: "Log out?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument();
    });
  });

  it("signs out and redirects home after logout confirmation", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
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
      await screen.findByRole("button", { name: "Open project Project Three" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open project Project One" }));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith({
        pathname: "/ai-studio",
        query: {
          projectId: "project-1",
        },
      });
    });
  });
});

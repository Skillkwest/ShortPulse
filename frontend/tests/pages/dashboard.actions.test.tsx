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
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
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
}));

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

const createDeferredResponse = () => {
  let resolve!: (value: {
    ok: boolean;
    json: () => Promise<{ projects: Array<Record<string, unknown>> }>;
  }) => void;
  const promise = new Promise<{
    ok: boolean;
    json: () => Promise<{ projects: Array<Record<string, unknown>> }>;
  }>((resolver) => {
    resolve = resolver;
  });
  return {
    promise,
    resolve,
  };
};

describe("Dashboard actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerReplaceMock.mockReset();
    routerPushMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });

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
    ensureSupabaseClientMock.mockReturnValue(buildSupabaseClient());
    ensureSupabaseQueryClientMock.mockReturnValue(buildSupabaseClient());
    fetchWithAuthMock.mockImplementation(async (input: unknown) => {
      if (input === "/api/announcements/active") {
        return {
          ok: true,
          json: async () => ({ announcement: null }),
        };
      }
      if (input === "/api/projects?limit=3") {
        return {
          ok: true,
          json: async () => ({
            projects: [
              {
                id: "project-1",
                title: "Project One",
                createdAt: "2026-04-23T00:00:00.000Z",
                updatedAt: "2026-04-23T01:00:00.000Z",
                previewImageUrls: ["https://cdn.example.com/project-one-preview.png"],
              },
            ],
          }),
        };
      }
      if (input === "/api/projects?limit=all") {
        return {
          ok: true,
          json: async () => ({
            projects: [
              {
                id: "project-1",
                title: "Project One",
                createdAt: "2026-04-23T00:00:00.000Z",
                updatedAt: "2026-04-23T01:00:00.000Z",
                previewImageUrls: ["https://cdn.example.com/project-one-preview.png"],
              },
              {
                id: "project-2",
                title: "Project Two",
                createdAt: "2026-04-22T00:00:00.000Z",
                updatedAt: "2026-04-22T01:00:00.000Z",
                previewImageUrls: [],
              },
            ],
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

  it("opens the profile menu with account and billing links", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));

    expect(screen.getByRole("link", { name: "Account & profile settings" })).toHaveAttribute(
      "href",
      "/profile?section=account"
    );
    expect(screen.getByRole("link", { name: "Billing & subscription" })).toHaveAttribute(
      "href",
      "/profile?section=billing"
    );
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("opens and closes the logout confirmation modal", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByRole("dialog", { name: "Are you sure?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Are you sure?" })).not.toBeInTheDocument();
    });
  });

  it("signs out and redirects home after logout confirmation", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, log out" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith(null);
      expect(routerReplaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("creates a project and routes into AI Studio with project identity", async () => {
    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: /New Project:/i }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/projects/create",
        expect.objectContaining({ method: "POST" })
      );
      expect(routerPushMock).toHaveBeenCalledWith({
        pathname: "/ai-studio",
        query: {
          projectId: "project-created",
        },
      });
    });
  });

  it("shows a full-card spinner while recent projects are loading", async () => {
    const deferredProjectsResponse = createDeferredResponse();

    fetchWithAuthMock.mockImplementation(async (input: unknown) => {
      if (input === "/api/announcements/active") {
        return {
          ok: true,
          json: async () => ({ announcement: null }),
        };
      }
      if (input === "/api/projects?limit=3") {
        return deferredProjectsResponse.promise;
      }
      if (input === "/api/projects?limit=all") {
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
            ],
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

    render(<DashboardPage />);

    const recentProjectsButton = await screen.findByRole("button", {
      name: "Recent Projects: Open saved projects",
    });
    expect(recentProjectsButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading recent projects");
    expect(screen.queryByText("Loading projects...")).not.toBeInTheDocument();

    deferredProjectsResponse.resolve({
      ok: true,
      json: async () => ({
        projects: [
          {
            id: "project-1",
            title: "Project One",
            createdAt: "2026-04-23T00:00:00.000Z",
            updatedAt: "2026-04-23T01:00:00.000Z",
          },
        ],
      }),
    });

    await waitFor(() => {
      expect(recentProjectsButton).toHaveAttribute("aria-busy", "false");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("opens the shared projects modal from the dashboard projects card", async () => {
    render(<DashboardPage />);

    expect(
      screen.queryByRole("button", { name: "Open project Project One" })
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId("hero-session-card-art-project-1")).toHaveStyle({
      backgroundImage: 'url("https://cdn.example.com/project-one-preview.png")',
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Recent Projects: Open saved projects" })
    );

    expect(await screen.findByRole("dialog", { name: "Projects" })).toBeInTheDocument();

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

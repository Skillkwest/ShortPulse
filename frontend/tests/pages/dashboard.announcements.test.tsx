/**
 * Dashboard page tests for announcement rendering and fail-soft fallback behavior.
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
const readSupabaseSessionMock = vi.hoisted(() => vi.fn());
const clearSupabaseSessionSnapshotMock = vi.hoisted(() => vi.fn());
const isSupabaseAbortErrorMock = vi.hoisted(() => vi.fn());
const readPersistedSupabaseSessionHintMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const isAuthSessionTimeoutErrorMock = vi.hoisted(() => vi.fn());
const isAuthRequiredErrorMock = vi.hoisted(() => vi.fn());
const publicFetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  } & Record<string, unknown>) => {
    void prefetch;
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
  clearSupabaseSessionSnapshot: (...args: unknown[]) => clearSupabaseSessionSnapshotMock(...args),
  isSupabaseAbortError: (...args: unknown[]) => isSupabaseAbortErrorMock(...args),
  readPersistedSupabaseSessionHint: (...args: unknown[]) =>
    readPersistedSupabaseSessionHintMock(...args),
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
  isAuthSessionTimeoutError: (...args: unknown[]) => isAuthSessionTimeoutErrorMock(...args),
  isAuthRequiredError: (...args: unknown[]) => isAuthRequiredErrorMock(...args),
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
    signOut: vi.fn(async () => ({ error: null })),
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

const buildAcceptedMediaComplianceResponse = () => ({
  ok: true,
  json: async () => ({
    accepted: true,
    acceptedAt: "2026-03-10T00:00:00.000Z",
  }),
});

const mockAuthenticatedDashboardFetch = (
  readAnnouncement: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>
) => {
  fetchWithAuthMock.mockImplementation(async (input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    if (path === "/api/account/media-compliance") {
      return buildAcceptedMediaComplianceResponse();
    }
    return readAnnouncement();
  });
};

describe("Dashboard announcement rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ replace: vi.fn() });
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
    clearSupabaseSessionSnapshotMock.mockReset();
    isSupabaseAbortErrorMock.mockReturnValue(false);
    isAuthSessionTimeoutErrorMock.mockReturnValue(false);
    isAuthRequiredErrorMock.mockReturnValue(false);
    readPersistedSupabaseSessionHintMock.mockReturnValue(true);
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);
    ensureSupabaseClientMock.mockReturnValue(buildSupabaseClient());
    ensureSupabaseQueryClientMock.mockReturnValue(buildSupabaseClient());
    publicFetchMock.mockReset();
    vi.stubGlobal("fetch", publicFetchMock);
    publicFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tutorials: [] }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders active announcement title and message when available", async () => {
    mockAuthenticatedDashboardFetch(async () => {
      return {
        ok: true,
        json: async () => ({
          announcement: {
            id: "ann-1",
            title: "Maintenance window",
            message: "AI Studio saves may be briefly delayed at 2AM UTC.",
            publishedAt: "2026-03-10T00:00:00.000Z",
            updatedAt: "2026-03-10T00:00:00.000Z",
          },
        }),
      };
    });

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("Maintenance window")).toBeInTheDocument());
    expect(
      screen.getByText("AI Studio saves may be briefly delayed at 2AM UTC.")
    ).toBeInTheDocument();
    await vi.dynamicImportSettled();
  });

  it("renders fallback helper copy when no active announcement exists", async () => {
    mockAuthenticatedDashboardFetch(async () => {
      return {
        ok: true,
        json: async () => ({ announcement: null }),
      };
    });

    render(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText(/your next great idea is waiting/i)).toBeInTheDocument()
    );
    await vi.dynamicImportSettled();
  });

  it("renders active dashboard tutorial cards from the global tutorial hub", async () => {
    publicFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tutorials: [
          {
            id: "tutorial-1",
            title: "Create your first project",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://cdn.example.com/tutorial.mp4",
            thumbnailPosterUrl: "https://cdn.example.com/tutorial-poster.jpg",
            thumbnailMediaType: "video",
            thumbnailAlt: "Animated project creation preview",
            displayOrder: 1,
          },
        ],
      }),
    });
    mockAuthenticatedDashboardFetch(async () => {
      return {
        ok: true,
        json: async () => ({ announcement: null }),
      };
    });

    render(<DashboardPage />);

    await screen.findByRole("button", { name: "Profile menu" });
    await screen.findByRole("heading", { name: /quick-start tutorial workflows/i });
    const tutorialButton = await screen.findByRole("button", {
      name: "Create your first project: open tutorial",
    });
    expect(
      tutorialButton.querySelector(
        '[data-next-image="https://cdn.example.com/tutorial-poster.jpg"]'
      )
    ).toBeInTheDocument();
    fireEvent.click(tutorialButton);

    expect(screen.getByRole("dialog", { name: "Create your first project" })).toBeInTheDocument();
    expect(screen.getByTitle("Create your first project")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123?rel=0&modestbranding=1&playsinline=1"
    );
    expect(screen.getByRole("link", { name: /launch ai studio/i })).toHaveAttribute(
      "href",
      "/ai-studio"
    );
    expect(publicFetchMock).toHaveBeenCalledWith("/api/dashboard/tutorials", {
      method: "GET",
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalledWith("/api/dashboard/tutorials", {
      method: "GET",
    });
    await vi.dynamicImportSettled();
  });

  it("renders fallback helper copy when announcement API fails", async () => {
    mockAuthenticatedDashboardFetch(async () => {
      throw new Error("network down");
    });

    render(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText(/your next great idea is waiting/i)).toBeInTheDocument()
    );
    await vi.dynamicImportSettled();
  });
});

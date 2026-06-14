/**
 * Dashboard bootstrap tests for session-resolution gating on the shared dashboard route.
 */
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
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
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
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
    throw new Error(`Unexpected table ${table}`);
  }),
});

describe("Dashboard bootstrap state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ pathname: "/dashboard", push: vi.fn(), replace: vi.fn() });
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
    ensureSupabaseClientMock.mockReturnValue(buildSupabaseClient());
    ensureSupabaseQueryClientMock.mockReturnValue(buildSupabaseClient());
    publicFetchMock.mockReset();
    vi.stubGlobal("fetch", publicFetchMock);
    publicFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tutorials: [] }),
    });
    readPersistedSupabaseSessionHintMock.mockReturnValue(true);
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);
    fetchWithAuthMock.mockImplementation(async (input: unknown) => {
      if (input === "/api/announcements/active") {
        return {
          ok: true,
          json: async () => ({ announcement: null }),
        };
      }
      if (input === "/api/projects?limit=12&offset=0") {
        return {
          ok: true,
          json: async () => ({ projects: [], hasMore: false, nextOffset: null }),
        };
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the first signed-in client render aligned with the static public dashboard, then resolves auth", async () => {
    const snapshot: {
      initialized: boolean;
      session: { user: typeof appUser } | null;
      user: typeof appUser | null;
    } = {
      initialized: false,
      session: null,
      user: null,
    };
    useSupabaseSessionStateMock.mockImplementation(() => snapshot);

    expect(renderToString(<DashboardPage />)).toContain(
      "The creative studio for <span>AI creators</span>"
    );

    const { rerender } = render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard");
    });
    expect(
      screen.getByText("Checking your session before your dashboard workspace loads.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("entry-animation-stage")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /the creative studio for ai creators/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();

    snapshot.initialized = true;
    snapshot.session = { user: appUser };
    snapshot.user = appUser;
    rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Profile menu" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /welcome back, kirk/i })).toBeInTheDocument();
    expect(
      screen.queryByText("Checking your session before your dashboard workspace loads.")
    ).not.toBeInTheDocument();
  });
});

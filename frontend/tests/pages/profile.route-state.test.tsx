/**
 * Profile route-state tests for section normalization and checkout notice cleanup.
 */
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const billingProfileMaybeSingleMock = vi.hoisted(() => vi.fn());
const billingContractMaybeSingleMock = vi.hoisted(() => vi.fn());
const billingLedgerLimitMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  isReady: true,
  pathname: "/profile",
}));

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

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: routerState.query,
    isReady: routerState.isReady,
    pathname: routerState.pathname,
    replace: routerReplaceMock,
  }),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: useProtectedRouteMock,
}));

vi.mock("../../features/ai-studio/hooks/useCredits", () => ({
  useCredits: useCreditsMock,
}));

vi.mock("../../features/ai-studio/hooks/useMediaAutosavePreference", () => ({
  useMediaAutosavePreference: useMediaAutosavePreferenceMock,
}));

vi.mock("../../features/billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: (...args: unknown[]) => useMediaStorageQuotaSummaryMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "billing_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: billingProfileMaybeSingleMock,
            }),
          }),
        };
      }
      if (table === "billing_subscription_contracts") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: billingContractMaybeSingleMock,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ai_credit_ledger") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: billingLedgerLimitMock,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "billing_subscription_storage_addons") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                eq: async () => ({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table mock: ${table}`);
    },
  }),
}));

describe("Profile route state", () => {
  beforeEach(() => {
    vi.useRealTimers();
    routerState.query = {};
    routerState.isReady = true;
    routerReplaceMock.mockReset();
    routerReplaceMock.mockImplementation((nextUrl) => {
      if (nextUrl && typeof nextUrl === "object" && "query" in nextUrl) {
        const nextQuery = nextUrl.query;
        routerState.query =
          nextQuery && typeof nextQuery === "object"
            ? { ...(nextQuery as Record<string, string>) }
            : {};
      }
      return Promise.resolve(true);
    });

    useProtectedRouteMock.mockReturnValue({ loading: false, user: null });
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({ plans: [], packages: [], storageAddons: [] }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions") {
        return {
          ok: true,
          json: async () => ({ transactions: [] }),
        };
      }
      throw new Error(`Unexpected fetch ${String(url)}`);
    });
    billingProfileMaybeSingleMock.mockReset();
    billingProfileMaybeSingleMock.mockResolvedValue({
      data: {
        plan_id: "media",
        subscription_status: "active",
        current_period_end: "2026-05-01T00:00:00.000Z",
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_123",
      },
      error: null,
    });
    billingContractMaybeSingleMock.mockReset();
    billingContractMaybeSingleMock.mockResolvedValue({
      data: {
        id: "contract_1",
        plan_id: "media",
        offer_id: "media__monthly",
        billing_interval: "month",
        stripe_subscription_id: "sub_123",
        stripe_price_id: "price_media",
        contract_source: "stripe",
        recurring_price_cents: 1900,
        monthly_credits_cents: 20000,
        storage_limit_bytes: 26843545600,
        status: "active",
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
        cancel_at_period_end: false,
        started_at: "2026-04-01T00:00:00.000Z",
        ended_at: null,
      },
      error: null,
    });
    billingLedgerLimitMock.mockReset();
    billingLedgerLimitMock.mockResolvedValue({
      data: [],
      error: null,
    });
    useCreditsMock.mockReturnValue({
      balanceCents: 0,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(async () => 0),
    });
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: null,
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
  });

  it("maps the legacy profile section alias to account settings", () => {
    routerState.query = { section: "profile" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Billing & credits" })).not.toBeInTheDocument();
  }, 15000);

  it("maps the legacy billing section alias to credits", () => {
    routerState.query = { section: "billing" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Credits & billing" })).toBeInTheDocument();
  });

  it("falls back to account settings for unknown sections", () => {
    routerState.query = { section: "unknown" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Account settings" })).toBeInTheDocument();
  });

  it("renders the dedicated transactions section", () => {
    routerState.query = { section: "transactions" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Transaction history" })).toBeInTheDocument();
  });

  it("shows a checkout success notice, refreshes credits, and clears the query flag", async () => {
    const refreshBalance = vi.fn(async () => 1250);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });
    routerState.query = { checkout: "success" };

    render(<ProfilePage />);

    expect(
      await screen.findByText("Credit purchase completed. Your balance is syncing now.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(refreshBalance).toHaveBeenCalledWith({ silent: true });
      expect(routerReplaceMock).toHaveBeenCalledWith(
        { pathname: "/profile", query: {} },
        undefined,
        { shallow: true }
      );
    });
  });

  it("shows a checkout cancel notice and clears the query flag", async () => {
    routerState.query = { checkout: "cancel", section: "billing" };

    render(<ProfilePage />);

    expect(await screen.findByText("Checkout canceled. No charge was made.")).toBeInTheDocument();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        { pathname: "/profile", query: { section: "billing" } },
        undefined,
        { shallow: true }
      );
    });
  });

  it("re-polls local subscription state after a successful plan-change return", async () => {
    routerState.query = { section: "subscription", plan_change: "checkout_success" };
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: {
        id: "user-1",
        email: "creator@example.com",
        user_metadata: { plan: "media" },
      },
    });

    render(<ProfilePage />);

    expect(
      await screen.findByText("Subscription checkout completed. Your plan is syncing now.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(billingProfileMaybeSingleMock).toHaveBeenCalled();
      expect(billingContractMaybeSingleMock).toHaveBeenCalled();
    });

    const initialProfileCalls = billingProfileMaybeSingleMock.mock.calls.length;
    const initialContractCalls = billingContractMaybeSingleMock.mock.calls.length;

    await waitFor(
      () => {
        expect(billingProfileMaybeSingleMock.mock.calls.length).toBeGreaterThan(
          initialProfileCalls
        );
        expect(billingContractMaybeSingleMock.mock.calls.length).toBeGreaterThan(
          initialContractCalls
        );
      },
      { timeout: 4000 }
    );
  }, 15000);
});

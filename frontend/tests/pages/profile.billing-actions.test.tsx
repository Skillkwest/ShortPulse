/**
 * Profile credits-section tests for portal and credit-refresh action wiring.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const billingProfileState = vi.hoisted(() => ({
  plan_id: "media",
  subscription_status: "active",
  current_period_end: "2026-04-01T00:00:00.000Z",
  stripe_customer_id: "cus_123" as string | null,
}));
const billingContractState = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
}));

const routerState = vi.hoisted(() => ({
  query: { section: "credits" } as Record<string, string>,
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
    replace: vi.fn(),
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
              maybeSingle: async () => ({
                data: billingProfileState,
                error: null,
              }),
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
                    maybeSingle: async () => ({
                      data: billingContractState.value,
                      error: null,
                    }),
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
                  limit: async () => ({
                    data: [],
                    error: null,
                  }),
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

describe("Profile credits actions", () => {
  beforeEach(() => {
    routerState.query = { section: "credits" };
    fetchWithAuthMock.mockReset();
    billingProfileState.plan_id = "media";
    billingProfileState.subscription_status = "active";
    billingProfileState.current_period_end = "2026-04-01T00:00:00.000Z";
    billingProfileState.stripe_customer_id = "cus_123";
    billingContractState.value = null;

    useProtectedRouteMock.mockReturnValue({ loading: false, user: null });
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(async () => 1000),
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

  it("renders the credits section controls", () => {
    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Credits & billing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh credits" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage card, invoices, and subscription" })
    ).toBeInTheDocument();
  });

  it("maps the legacy billing section alias to credits", () => {
    routerState.query = { section: "billing" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Credits & billing" })).toBeInTheDocument();
  });

  it("shows an info notice when credit refresh returns the same balance", async () => {
    const refreshBalance = vi.fn(async () => 1000);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Credits synced. Balance is still 1,000."
    );
    expect(refreshBalance).toHaveBeenCalledTimes(1);
  });

  it("shows a success notice when credit refresh changes the balance", async () => {
    const refreshBalance = vi.fn(async () => 2500);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Credits updated from 1,000 to 2,500."
    );
  });

  it("shows an error notice when credit refresh fails", async () => {
    const refreshBalance = vi.fn(async () => null);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Unable to sync credits right now. Please try again."
    );
  });

  it("shows an error notice when opening the billing portal fails", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Portal unavailable" }),
    });

    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Manage card, invoices, and subscription" })
    );

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/stripe/portal", {
        method: "POST",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Portal unavailable");
  });

  it("disables Stripe portal controls for internal comp contracts", async () => {
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: {
        id: "user-1",
        email: "creator@example.com",
        user_metadata: { plan: "business" },
      },
    });
    billingProfileState.plan_id = "business";
    billingProfileState.subscription_status = "active";
    billingProfileState.current_period_end = "2026-05-01T00:00:00.000Z";
    billingProfileState.stripe_customer_id = null;
    billingContractState.value = {
      id: "contract_internal",
      plan_id: "business",
      offer_id: "business__internal_comp",
      stripe_price_id: null,
      contract_source: "internal_comp",
      recurring_price_cents: 0,
      monthly_credits_cents: 12000,
      storage_limit_bytes: 536870912000,
      status: "active",
      current_period_start: "2026-04-01T00:00:00.000Z",
      current_period_end: "2026-05-01T00:00:00.000Z",
      cancel_at_period_end: false,
      started_at: "2026-04-01T00:00:00.000Z",
      ended_at: null,
    } as Record<string, unknown>;

    render(<ProfilePage />);

    const button = await screen.findByRole("button", { name: "Managed internally" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Subscription managed internally outside Stripe")).toBeInTheDocument();
  });
});

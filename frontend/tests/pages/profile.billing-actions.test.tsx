/**
 * Profile credits and account-billing tests for portal and credit-refresh action wiring.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const creditLedgerQueryState = vi.hoisted(() => ({
  sourceFilter: [] as string[],
}));

const routerState = vi.hoisted(() => ({
  query: { section: "credits" } as Record<string, string>,
  isReady: true,
  pathname: "/profile",
}));

const formatCompactDateForTest = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

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
              in: (_column: string, values: string[]) => {
                creditLedgerQueryState.sourceFilter = values;
                return {
                  order: () => ({
                    limit: async () => ({
                      data: [],
                      error: null,
                    }),
                  }),
                };
              },
            }),
          }),
        };
      }
      if (table === "billing_subscription_storage_addons") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: async () => ({
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

describe("Profile credits actions", () => {
  beforeEach(() => {
    routerState.query = { section: "credits" };
    fetchWithAuthMock.mockReset();
    billingProfileState.plan_id = "media";
    billingProfileState.subscription_status = "active";
    billingProfileState.current_period_end = "2026-04-01T00:00:00.000Z";
    billingProfileState.stripe_customer_id = "cus_123";
    billingContractState.value = null;
    creditLedgerQueryState.sourceFilter = [];

    useProtectedRouteMock.mockReturnValue({ loading: false, user: null });
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceError: null,
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

    expect(screen.getByRole("heading", { name: "Credits" })).toBeInTheDocument();
    expect(screen.getByText("Available balance")).toBeInTheDocument();
    expect(screen.queryByText("Your credits")).not.toBeInTheDocument();
    expect(screen.getAllByText("1,000").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Refresh credits" })).toBeInTheDocument();
    expect(screen.queryByText("Last synced")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage Billing" })).not.toBeInTheDocument();
    expect(screen.queryByText("Billing identity")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Payment method and subscription billing are managed outside Stripe/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Billing email:/)).not.toBeInTheDocument();
  });

  it("shows account summary credits as current balance over plan allowance", async () => {
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: {
        id: "user-1",
        email: "creator@example.com",
        user_metadata: { plan: "starter" },
      },
    });
    useCreditsMock.mockReturnValue({
      balanceCents: 850,
      balanceError: null,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(async () => 850),
    });
    billingProfileState.plan_id = "starter";
    billingContractState.value = {
      id: "contract_starter",
      plan_id: "starter",
      offer_id: "starter__monthly",
      stripe_price_id: "price_starter",
      contract_source: "stripe",
      recurring_price_cents: 1500,
      monthly_credits_cents: 350,
      storage_limit_bytes: 1073741824,
      status: "active",
      current_period_start: "2026-06-15T00:00:00.000Z",
      current_period_end: "2026-07-15T00:00:00.000Z",
      cancel_at_period_end: false,
      started_at: "2026-06-15T00:00:00.000Z",
      ended_at: null,
    } as Record<string, unknown>;
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({ plans: [], packages: [], storageAddons: [] }),
        };
      }
      return {
        ok: true,
        json: async () => ({}),
      };
    });

    render(<ProfilePage />);

    const accountSummary = screen.getByLabelText("Account summary");
    expect(
      await within(accountSummary).findByText((_, element) => element?.textContent === "850 / 350")
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(creditLedgerQueryState.sourceFilter).toEqual(["stripe_checkout"]);
    });
    expect(within(accountSummary).getByText("850")).toHaveClass("profile-credit-surplus-value");
  });

  it("does not render an unavailable balance as zero", () => {
    useCreditsMock.mockReturnValue({
      balanceCents: null,
      balanceError: "Unable to load spendable credit snapshot.",
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(async () => null),
    });

    render(<ProfilePage />);

    expect(screen.getAllByText("Unavailable")).not.toHaveLength(0);
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
    expect(screen.getByText("Unable to load spendable credit snapshot.")).toBeInTheDocument();
  });

  it("shows the next credit renewal date and incoming credits in the hero card", async () => {
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: {
        id: "user-1",
        email: "creator@example.com",
        user_metadata: { plan: "studio" },
      },
    });
    billingContractState.value = {
      id: "contract_studio",
      plan_id: "studio",
      offer_id: "studio__monthly",
      stripe_price_id: "price_studio",
      contract_source: "stripe",
      recurring_price_cents: 3900,
      monthly_credits_cents: 3000,
      storage_limit_bytes: 107374182400,
      status: "active",
      current_period_start: "2026-04-15T00:00:00.000Z",
      current_period_end: "2026-05-15T00:00:00.000Z",
      cancel_at_period_end: false,
      started_at: "2026-04-15T00:00:00.000Z",
      ended_at: null,
    } as Record<string, unknown>;

    render(<ProfilePage />);

    expect(await screen.findByText("Next renewal")).toBeInTheDocument();
    expect(
      await screen.findByText(formatCompactDateForTest("2026-05-15T00:00:00.000Z"))
    ).toBeInTheDocument();
    expect(await screen.findByText("Incoming credits")).toBeInTheDocument();
    expect(await screen.findByText("+3,000")).toBeInTheDocument();
  });

  it("maps the legacy billing section alias to account settings", () => {
    routerState.query = { section: "billing" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Payment details" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage subscription" })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
  });

  it("shows an info notice when credit refresh returns the same balance", async () => {
    const refreshBalance = vi.fn(async () => 1000);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceError: null,
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
      balanceError: null,
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
      balanceError: null,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sync credits right now. Please try again."
    );
  });

  it("shows an error notice when opening the billing portal fails", async () => {
    routerState.query = { section: "account" };
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Portal unavailable" }),
    });

    render(<ProfilePage />);
    expect(screen.getByRole("link", { name: "Manage subscription" })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
    const manageBillingButton = screen.getByRole("button", { name: "Manage Billing" });
    expect(manageBillingButton).toHaveClass("ghost-btn");
    fireEvent.click(manageBillingButton);

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/stripe/portal", {
        method: "POST",
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Portal unavailable");
  });

  it("disables Stripe portal controls for internal comp contracts", async () => {
    routerState.query = { section: "account" };
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

    expect(await screen.findByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    expect(
      screen.queryByText("Subscription managed internally outside Stripe")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage subscription" })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
    expect(screen.queryByRole("button", { name: "Managed internally" })).not.toBeInTheDocument();
  });
});

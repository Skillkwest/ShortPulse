/**
 * Profile subscription-section tests for plan actions and cancel-confirm flow.
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
const fetchBillingAccountSummaryMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  query: { section: "subscription" } as Record<string, string>,
  isReady: true,
  pathname: "/profile",
}));

const billingProfileState = vi.hoisted(() => ({
  plan_id: "media",
  subscription_status: "active",
  current_period_end: "2026-04-01T00:00:00.000Z" as string | null,
  stripe_customer_id: "cus_123" as string | null,
  stripe_subscription_id: "sub_123" as string | null,
}));

const billingContractState = vi.hoisted(() => ({
  value: {
    id: "contract_1",
    plan_id: "media",
    offer_id: "media__legacy_10",
    billing_interval: "month",
    stripe_price_id: "price_media_legacy",
    stripe_subscription_id: "sub_123",
    contract_source: "stripe",
    recurring_price_cents: 1000,
    monthly_credits_cents: 20000,
    storage_limit_bytes: 26843545600,
    status: "active",
    current_period_start: "2026-03-01T00:00:00.000Z",
    current_period_end: "2026-04-01T00:00:00.000Z",
    cancel_at_period_end: false,
    started_at: "2026-03-01T00:00:00.000Z",
    ended_at: null,
  } as Record<string, unknown> | null,
}));

const billingPlansFixture = [
  {
    id: "free",
    display_name: "Starter",
    monthly_price_cents: 0,
    monthly_credits_cents: 0,
    storage_limit_bytes: 1073741824,
    is_active: true,
  },
  {
    id: "media",
    display_name: "Media",
    monthly_price_cents: 1900,
    monthly_credits_cents: 20000,
    storage_limit_bytes: 26843545600,
    is_active: true,
    offers: {
      year: {
        id: "media_year",
        billing_interval: "year",
        recurring_price_cents: 19000,
        monthly_credits_cents: 20000,
        storage_limit_bytes: 26843545600,
        stripe_price_id: "price_media_year",
        acquisition_enabled: true,
        is_active: true,
      },
    },
  },
  {
    id: "studio",
    display_name: "Studio",
    monthly_price_cents: 3900,
    monthly_credits_cents: 3000,
    storage_limit_bytes: 107374182400,
    is_active: true,
    offers: {
      year: {
        id: "studio_year",
        billing_interval: "year",
        recurring_price_cents: 39000,
        monthly_credits_cents: 3000,
        storage_limit_bytes: 107374182400,
        stripe_price_id: "price_studio_year",
        acquisition_enabled: true,
        is_active: true,
      },
    },
  },
  {
    id: "business",
    display_name: "Business",
    monthly_price_cents: 4900,
    monthly_credits_cents: 60000,
    storage_limit_bytes: 536870912000,
    is_active: true,
    offers: {
      year: {
        id: "business_year",
        billing_interval: "year",
        recurring_price_cents: 49000,
        monthly_credits_cents: 60000,
        storage_limit_bytes: 536870912000,
        stripe_price_id: "price_business_year",
        acquisition_enabled: true,
        is_active: true,
      },
    },
  },
];

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

vi.mock("../../features/billing/accountSummary", () => ({
  fetchBillingAccountSummary: (...args: unknown[]) => fetchBillingAccountSummaryMock(...args),
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

describe("Profile subscription actions", () => {
  beforeEach(() => {
    routerState.query = { section: "subscription" };
    billingProfileState.plan_id = "media";
    billingProfileState.subscription_status = "active";
    billingProfileState.current_period_end = "2026-04-01T00:00:00.000Z";
    billingProfileState.stripe_customer_id = "cus_123";
    billingProfileState.stripe_subscription_id = "sub_123";
    billingContractState.value = {
      id: "contract_1",
      plan_id: "media",
      offer_id: "media__legacy_10",
      billing_interval: "month",
      stripe_price_id: "price_media_legacy",
      stripe_subscription_id: "sub_123",
      contract_source: "stripe",
      recurring_price_cents: 1000,
      monthly_credits_cents: 20000,
      storage_limit_bytes: 26843545600,
      status: "active",
      current_period_start: "2026-03-01T00:00:00.000Z",
      current_period_end: "2026-04-01T00:00:00.000Z",
      cancel_at_period_end: false,
      started_at: "2026-03-01T00:00:00.000Z",
      ended_at: null,
    };
    fetchBillingAccountSummaryMock.mockReset();
    fetchBillingAccountSummaryMock.mockImplementation(async () => ({
      userId: "user-1",
      resolvedPlan: {
        id: billingContractState.value?.plan_id ?? billingProfileState.plan_id ?? "free",
        label: "Media",
        className: "plan-media",
        monthlyCreditsCents: billingContractState.value?.monthly_credits_cents ?? 0,
      },
      quotaStatus: "unavailable",
      quotaSummary: null,
      profileState: {
        billingProfile: { ...billingProfileState },
        billingContract: billingContractState.value,
        billingActivity: [],
        activeStorageAddons: [],
      },
    }));
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({ plans: billingPlansFixture, packages: [], storageAddons: [] }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions") {
        return {
          ok: true,
          json: async () => ({
            transactions: [
              {
                id: "in_123",
                invoiceNumber: "9A12E1",
                amountPaidCents: 1900,
                currency: "usd",
                status: "paid",
                title: "Monthly subscription renewal",
                createdAt: "2026-03-01T00:00:00.000Z",
                paidAt: "2026-03-01T00:00:00.000Z",
                receiptUrl: "https://stripe.test/invoices/in_123",
                kind: "subscription",
                kindLabel: "Subscription",
                reference: "9A12E1",
              },
            ],
          }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Portal unavailable" }),
      };
    });

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: {
        id: "user-1",
        email: "creator@example.com",
        user_metadata: { plan: "media" },
      },
    });
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(),
    });
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: {
        usedBytes: 2 * 1024 * 1024 * 1024,
        baseLimitBytes: 25 * 1024 * 1024 * 1024,
        addonLimitBytes: 0,
        totalLimitBytes: 25 * 1024 * 1024 * 1024,
        remainingBytes: 23 * 1024 * 1024 * 1024,
        isOverLimit: false,
      },
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
  });

  it("renders current, upgrade, and cancel plan actions", async () => {
    const { container } = render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect(screen.getByText("Current plan")).toBeInTheDocument();
    expect(screen.queryByText("Your subscription")).not.toBeInTheDocument();
    expect(container.querySelector(".profile-subscription-hero-card.plan-media")).not.toBeNull();
    expect(container.querySelector(".subscription-plan-card.is-current.plan-media")).not.toBeNull();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Current Plan" })).toBeDisabled();
    expect(await screen.findByRole("button", { name: "Upgrade to Business" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Cancel subscription" })).toHaveClass(
      "profile-subscription-cancel-button",
      "profile-subscription-cancel-header-button"
    );
    expect(screen.queryByText(/Ideal for creators testing cadence/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recent subscription payments" })
    ).toBeInTheDocument();
    expect(await screen.findByText("Monthly subscription renewal")).toBeInTheDocument();
    expect(screen.getByText(/If you are on a legacy contract/)).toBeInTheDocument();
    expect((await screen.findAllByText("$19.00")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: "View invoice" })).toHaveAttribute(
      "href",
      "https://stripe.test/invoices/in_123"
    );
  }, 15000);

  it("shows scheduled cancellation access state and hides repeat cancel action", async () => {
    billingContractState.value = {
      ...(billingContractState.value as Record<string, unknown>),
      cancel_at_period_end: true,
    };

    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect(screen.getByText("Access ends")).toBeInTheDocument();
    expect(screen.getByText(/Cancellation scheduled/)).toBeInTheDocument();
    expect(
      screen.getByText(/remaining subscription credits, and recurring storage add-ons/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
  });

  it("does not show the legacy plan notice for a current public offer", async () => {
    billingProfileState.plan_id = "starter";
    billingProfileState.current_period_end = "2026-07-15T00:00:00.000Z";
    billingContractState.value = {
      id: "contract_starter",
      plan_id: "starter",
      offer_id: "starter__monthly",
      billing_interval: "month",
      stripe_price_id: "price_starter_month",
      stripe_subscription_id: "sub_123",
      contract_source: "stripe",
      recurring_price_cents: 1500,
      monthly_credits_cents: 350,
      storage_limit_bytes: 1073741824,
      max_concurrent_generations: 1,
      status: "active",
      current_period_start: "2026-06-15T00:00:00.000Z",
      current_period_end: "2026-07-15T00:00:00.000Z",
      cancel_at_period_end: false,
      started_at: "2026-06-15T00:00:00.000Z",
      ended_at: null,
    };

    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect(screen.queryByText(/If you are on a legacy contract/)).not.toBeInTheDocument();
  });

  it("hides the baseline-access sentinel when starter exists and keeps the downgrade destination", async () => {
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({
            plans: [
              {
                id: "free",
                display_name: "Starter",
                monthly_price_cents: 0,
                monthly_credits_cents: 100,
                storage_limit_bytes: 1073741824,
                is_active: true,
              },
              {
                id: "starter",
                display_name: "Starter",
                monthly_price_cents: 1500,
                monthly_credits_cents: 350,
                storage_limit_bytes: 1073741824,
                is_active: true,
              },
              ...billingPlansFixture.slice(1),
            ],
            packages: [],
            storageAddons: [],
          }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions") {
        return {
          ok: true,
          json: async () => ({ transactions: [] }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Portal unavailable" }),
      };
    });

    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Cancel subscription" })).toHaveClass(
      "profile-subscription-cancel-button",
      "profile-subscription-cancel-header-button"
    );
    expect(screen.getByRole("button", { name: "Downgrade to Starter" })).toBeInTheDocument();
  });

  it("falls back to the billing profile plan when the contract row is missing", async () => {
    billingContractState.value = null;

    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect(screen.getAllByText("Media")[0]).toBeInTheDocument();
    expect(screen.getAllByText("$19.00 / month").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ideal for creators testing cadence/)).not.toBeInTheDocument();
  });

  it("shows the shared pricing CTA instead of subscription cards for baseline access", async () => {
    billingProfileState.plan_id = "free";
    billingProfileState.subscription_status = "inactive";
    billingProfileState.current_period_end = null;
    billingProfileState.stripe_customer_id = null;
    billingProfileState.stripe_subscription_id = null;
    billingContractState.value = null;

    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect((await screen.findAllByText("Baseline access")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Next renewal")).not.toBeInTheDocument();
    expect(screen.queryByText("Not scheduled")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View subscription plans" })).toHaveAttribute(
      "href",
      "/pricing"
    );
    expect(screen.getByText("View plans")).toBeInTheDocument();
    expect(screen.queryByText("Monthly credits")).not.toBeInTheDocument();
    expect(screen.queryByText("Storage included")).not.toBeInTheDocument();
    expect(screen.queryByText("Available plans")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Monthly" })).not.toBeInTheDocument();
  });

  it("opens and closes the cancel subscription modal", async () => {
    render(<ProfilePage />);

    await screen.findByText("Monthly subscription renewal");
    fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));
    expect(
      await screen.findByRole("heading", { name: "Manage your downgrade?" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Paid top-up credits stay available/)).toBeInTheDocument();
    expect(screen.getByText(/normal 60-day schedule/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Manage your downgrade?" })
      ).not.toBeInTheDocument();
    });
  });

  it("routes cancel confirmation through the billing portal handler", async () => {
    render(<ProfilePage />);

    await screen.findByText("Monthly subscription renewal");
    fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));
    expect(
      await screen.findByRole("heading", { name: "Manage your downgrade?" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalled();
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/subscription/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPlanId: "free", billingInterval: "month" }),
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Portal unavailable");
  });

  it("routes upgrade actions through the billing portal handler", async () => {
    render(<ProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Upgrade to Business" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId: "business", billingInterval: "month" }),
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Portal unavailable");
  });

  it("uses the selected annual billing interval for upgrade actions", async () => {
    render(<ProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Annual" }));
    fireEvent.click(await screen.findByRole("button", { name: "Upgrade to Business" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId: "business", billingInterval: "year" }),
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Portal unavailable");
  });

  it("routes current-plan annual billing switches through the subscription change handler", async () => {
    render(<ProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Annual" }));
    fireEvent.click(await screen.findByRole("button", { name: "Upgrade to annual billing" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId: "media", billingInterval: "year" }),
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Portal unavailable");
  });

  it("disables annual paid-plan actions when the target plan has no live annual offer", async () => {
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({
            plans: [
              billingPlansFixture[0],
              billingPlansFixture[1],
              {
                ...billingPlansFixture[2],
                offers: undefined,
              },
            ],
            packages: [],
            storageAddons: [],
          }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions") {
        return {
          ok: true,
          json: async () => ({ transactions: [] }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Portal unavailable" }),
      };
    });

    render(<ProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Annual" }));
    expect(await screen.findByRole("button", { name: "Annual unavailable" })).toBeDisabled();
  });

  it("shows self-serve plan actions for internal comp contracts", async () => {
    billingProfileState.plan_id = "business";
    billingProfileState.subscription_status = "active";
    billingProfileState.current_period_end = "2026-05-01T00:00:00.000Z";
    billingProfileState.stripe_customer_id = null;
    billingProfileState.stripe_subscription_id = null;
    billingContractState.value = {
      id: "contract_internal",
      plan_id: "business",
      offer_id: "business__internal_comp",
      billing_interval: "month",
      stripe_price_id: null,
      stripe_subscription_id: null,
      contract_source: "internal_comp",
      recurring_price_cents: 0,
      monthly_credits_cents: 8000,
      storage_limit_bytes: 536870912000,
      status: "active",
      current_period_start: "2026-04-01T00:00:00.000Z",
      current_period_end: "2026-05-01T00:00:00.000Z",
      cancel_at_period_end: false,
      started_at: "2026-04-01T00:00:00.000Z",
      ended_at: null,
    } as Record<string, unknown>;
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({ plans: billingPlansFixture, packages: [], storageAddons: [] }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions") {
        return {
          ok: true,
          json: async () => ({ transactions: [] }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Portal unavailable" }),
      };
    });

    const { container } = render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect(container.querySelector(".profile-subscription-hero-card.plan-business")).not.toBeNull();
    expect(
      container.querySelector(".subscription-plan-card.is-current.plan-business")
    ).not.toBeNull();
    expect(screen.queryByText("How subscriptions work")).not.toBeInTheDocument();
    expect(screen.queryByText(/Managed internally ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Compare the public offers/)).not.toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel subscription" })).toHaveClass(
      "profile-subscription-cancel-button",
      "profile-subscription-cancel-header-button"
    );
    expect(screen.getByRole("button", { name: "Downgrade to Media" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Downgrade to Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Current Plan" })).toBeDisabled();
    expect(
      screen.getByText(
        "No Stripe subscription payments are available for this internally managed account."
      )
    ).toBeInTheDocument();
  });
});

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
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  query: { section: "subscription" } as Record<string, string>,
  isReady: true,
  pathname: "/profile",
}));

const billingPlansFixture = [
  {
    id: "free",
    display_name: "Free",
    monthly_price_cents: 0,
    monthly_credits_cents: 0,
    is_active: true,
  },
  {
    id: "media",
    display_name: "Media",
    monthly_price_cents: 1900,
    monthly_credits_cents: 20000,
    is_active: true,
  },
  {
    id: "business",
    display_name: "Business",
    monthly_price_cents: 4900,
    monthly_credits_cents: 60000,
    is_active: true,
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
                data: {
                  plan_id: "media",
                  subscription_status: "active",
                  current_period_end: "2026-04-01T00:00:00.000Z",
                  stripe_customer_id: "cus_123",
                },
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
                      data: {
                        id: "contract_1",
                        plan_id: "media",
                        offer_id: "media__legacy_10",
                        stripe_price_id: "price_media_legacy",
                        recurring_price_cents: 1000,
                        monthly_credits_cents: 20000,
                        status: "active",
                        current_period_start: "2026-03-01T00:00:00.000Z",
                        current_period_end: "2026-04-01T00:00:00.000Z",
                        cancel_at_period_end: false,
                        started_at: "2026-03-01T00:00:00.000Z",
                        ended_at: null,
                      },
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

describe("Profile subscription actions", () => {
  beforeEach(() => {
    routerState.query = { section: "subscription" };
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({ plans: billingPlansFixture, packages: [] }),
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
  });

  it("renders current, upgrade, and cancel plan actions", async () => {
    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Subscription plans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Current Plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upgrade to Business" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel subscription" })).toBeInTheDocument();
    expect(screen.getByText("$10.00 / month")).toBeInTheDocument();
    expect(
      screen.getByText("Legacy contract locked for your active subscription")
    ).toBeInTheDocument();
  });

  it("opens and closes the cancel subscription modal", async () => {
    render(<ProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel subscription" }));
    expect(screen.getByRole("heading", { name: "Cancel subscription?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep subscription" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Cancel subscription?" })
      ).not.toBeInTheDocument();
    });
  });

  it("routes cancel confirmation through the billing portal handler", async () => {
    render(<ProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to billing portal" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/stripe/portal", {
        method: "POST",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Portal unavailable");
  });

  it("routes upgrade actions through the billing portal handler", async () => {
    render(<ProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Upgrade to Business" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/stripe/portal", {
        method: "POST",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Portal unavailable");
  });
});

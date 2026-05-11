/**
 * Profile transactions-section tests for unified billing history rendering.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  query: { section: "transactions" } as Record<string, string>,
  isReady: true,
  pathname: "/profile",
}));

const billingProfileState = vi.hoisted(() => ({
  plan_id: "business",
  subscription_status: "active",
  current_period_end: "2026-05-01T00:00:00.000Z",
  stripe_customer_id: "cus_123",
}));

const billingContractState = vi.hoisted(() => ({
  value: {
    id: "contract_1",
    plan_id: "business",
    offer_id: "business__public",
    stripe_price_id: "price_business",
    contract_source: "stripe",
    recurring_price_cents: 12900,
    monthly_credits_cents: 120000,
    storage_limit_bytes: 536870912000,
    status: "active",
    current_period_start: "2026-04-01T00:00:00.000Z",
    current_period_end: "2026-05-01T00:00:00.000Z",
    cancel_at_period_end: false,
    started_at: "2026-04-01T00:00:00.000Z",
    ended_at: null,
  } as Record<string, unknown> | null,
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

describe("Profile transactions actions", () => {
  beforeEach(() => {
    routerState.query = { section: "transactions" };
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({ plans: [], packages: [], storageAddons: [] }),
        };
      }
      if (url === "/api/billing/stripe/transactions") {
        return {
          ok: true,
          json: async () => ({
            transactions: [
              {
                id: "txn_credit_1",
                invoiceNumber: null,
                amountPaidCents: 2600,
                currency: "usd",
                status: "paid",
                title: "Credit top-up · Growth 2,000",
                createdAt: "2026-04-03T15:00:00.000Z",
                paidAt: "2026-04-03T15:00:00.000Z",
                receiptUrl: null,
                kind: "credit_purchase",
                kindLabel: "Credit top-up",
                reference: "cs_test_123",
              },
              {
                id: "txn_invoice_1",
                invoiceNumber: "INV-100",
                amountPaidCents: 14400,
                currency: "usd",
                status: "paid",
                title: "Subscription + storage",
                createdAt: "2026-04-02T09:00:00.000Z",
                paidAt: "2026-04-02T09:00:00.000Z",
                receiptUrl: "https://stripe.test/invoices/in_100",
                kind: "mixed",
                kindLabel: "Combined invoice",
                reference: "INV-100",
              },
            ],
          }),
        };
      }
      if (url === "/api/billing/stripe/portal") {
        return {
          ok: true,
          json: async () => ({ portalUrl: "https://stripe.test/portal" }),
        };
      }
      throw new Error(`Unexpected fetch ${String(url)}`);
    });

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: {
        id: "user-1",
        email: "creator@example.com",
        user_metadata: { plan: "business" },
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
      quotaSummary: null,
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
  });

  it("renders the unified transaction history page", async () => {
    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Transaction history" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Recent transactions" })).toHaveLength(2);
    expect(await screen.findByText("Credit top-up · Growth 2,000")).toBeInTheDocument();
    expect(await screen.findByText("Subscription + storage")).toBeInTheDocument();
    expect(await screen.findByText(/Ref cs_test_123/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "View invoice" })).toHaveAttribute(
      "href",
      "https://stripe.test/invoices/in_100"
    );
    expect(
      screen.getByRole("button", { name: "Manage card, invoices, and subscription" })
    ).toBeInTheDocument();
  });
});

/**
 * Profile storage-section tests for recurring storage add-on presentation.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const refreshQuotaSummaryMock = vi.hoisted(() => vi.fn());
const activeStorageAddonsQueryMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  query: { section: "storage" } as Record<string, string>,
  isReady: true,
  pathname: "/profile",
}));

const billingProfileState = vi.hoisted(() => ({
  plan_id: "business",
  subscription_status: "active",
  current_period_end: "2026-05-01T00:00:00.000Z" as string | null,
  stripe_customer_id: "cus_123" as string | null,
  stripe_subscription_id: "sub_123" as string | null,
}));

const billingContractState = vi.hoisted(() => ({
  value: {
    id: "contract_1",
    plan_id: "business",
    offer_id: "business__public",
    stripe_price_id: "price_business",
    stripe_subscription_id: "sub_123",
    contract_source: "stripe",
    recurring_price_cents: 4900,
    monthly_credits_cents: 60000,
    storage_limit_bytes: 161061273600,
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
                in: activeStorageAddonsQueryMock,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table mock: ${table}`);
    },
  }),
}));

describe("Profile storage actions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    routerState.query = { section: "storage" };
    billingProfileState.plan_id = "business";
    billingProfileState.subscription_status = "active";
    billingProfileState.current_period_end = "2026-05-01T00:00:00.000Z";
    billingProfileState.stripe_customer_id = "cus_123";
    billingProfileState.stripe_subscription_id = "sub_123";
    billingContractState.value = {
      id: "contract_1",
      plan_id: "business",
      offer_id: "business__public",
      stripe_price_id: "price_business",
      stripe_subscription_id: "sub_123",
      contract_source: "stripe",
      recurring_price_cents: 4900,
      monthly_credits_cents: 60000,
      storage_limit_bytes: 161061273600,
      status: "active",
      current_period_start: "2026-04-01T00:00:00.000Z",
      current_period_end: "2026-05-01T00:00:00.000Z",
      cancel_at_period_end: false,
      started_at: "2026-04-01T00:00:00.000Z",
      ended_at: null,
    } as Record<string, unknown>;
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      if (url === "/api/billing/catalog") {
        return {
          ok: true,
          json: async () => ({
            plans: [],
            packages: [],
            storageAddons: [
              {
                id: "storage_100gb",
                display_name: "100 GB add-on",
                storage_limit_bytes: 107374182400,
                monthly_price_cents: 5900,
                sort_order: 1,
              },
              {
                id: "storage_250gb",
                display_name: "250 GB add-on",
                storage_limit_bytes: 268435456000,
                monthly_price_cents: 14900,
                sort_order: 2,
              },
            ],
          }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions?kind=storage") {
        return {
          ok: true,
          json: async () => ({
            transactions: [
              {
                id: "in_storage_1",
                invoiceNumber: "S100GB1",
                amountPaidCents: 5900,
                currency: "usd",
                status: "paid",
                title: "Extra 100 GB",
                createdAt: "2026-03-01T00:00:00.000Z",
                paidAt: "2026-03-01T00:00:00.000Z",
                receiptUrl: "https://stripe.test/invoices/in_storage_1",
                kind: "storage",
                kindLabel: "Storage",
                reference: "S100GB1",
              },
            ],
          }),
        };
      }
      if (url === "/api/billing/storage-addon/change") {
        return {
          ok: true,
          json: async () => ({
            message: "Storage add-on update submitted. Your workspace storage is syncing now.",
          }),
        };
      }
      throw new Error(`Unexpected fetch ${String(url)}`);
    });
    activeStorageAddonsQueryMock.mockReset();
    activeStorageAddonsQueryMock.mockResolvedValue({
      data: [
        {
          id: "storage_row_1",
          storage_addon_id: "storage_100gb",
          offer_id: "storage_100gb__current",
          stripe_subscription_item_id: "si_storage_100",
          storage_limit_bytes: 107374182400,
          quantity: 1,
          recurring_price_cents: 1500,
          status: "active",
        },
      ],
      error: null,
    });
    refreshQuotaSummaryMock.mockReset();
    refreshQuotaSummaryMock.mockResolvedValue(undefined);

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
      quotaSummary: {
        usedBytes: 50 * 1024 * 1024 * 1024,
        baseLimitBytes: 150 * 1024 * 1024 * 1024,
        addonLimitBytes: 100 * 1024 * 1024 * 1024,
        totalLimitBytes: 250 * 1024 * 1024 * 1024,
        remainingBytes: 200 * 1024 * 1024 * 1024,
        isOverLimit: false,
      },
      loading: false,
      refreshQuotaSummary: refreshQuotaSummaryMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders storage usage and recurring add-ons", async () => {
    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Media storage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your media storage" })).toBeInTheDocument();
    expect(screen.getByText("Expand media capacity")).toBeInTheDocument();
    expect(screen.getByText("250 GB")).toBeInTheDocument();
    expect(screen.queryByText(/across uploads, references, and saved AI Studio media/)).toBeNull();
    expect(screen.getByRole("meter", { name: "Media storage used" })).toHaveAttribute(
      "aria-valuenow",
      "20"
    );
    const currentUsageChip = screen.getByText("Current usage");
    const planCapacityChip = screen.getByText("Plan capacity");
    expect(
      currentUsageChip.compareDocumentPosition(planCapacityChip) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect((await screen.findAllByText("100 GB add-on")).length).toBeGreaterThan(1);
    expect(await screen.findByText("Active add-on")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Remove" })).toBeEnabled();
    expect(
      await screen.findByRole("button", { name: "Remove current add-on first" })
    ).toBeDisabled();
    expect(
      screen.getByText("You can keep one recurring storage add-on active at a time.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Need 500 GB or more? Contact support for a storage review.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent storage payments" })).toBeInTheDocument();
    expect(screen.getByText("Extra 100 GB")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View invoice" })).toHaveAttribute(
      "href",
      "https://stripe.test/invoices/in_storage_1"
    );
  });

  it("shows the legacy 25 GB add-on card for Starter while the new catalog is not live", async () => {
    billingProfileState.plan_id = "starter";
    billingContractState.value = {
      id: "contract_1",
      plan_id: "starter",
      offer_id: "starter__public",
      stripe_price_id: "price_starter",
      stripe_subscription_id: "sub_123",
      contract_source: "stripe",
      recurring_price_cents: 1500,
      monthly_credits_cents: 35000,
      storage_limit_bytes: 5 * 1024 * 1024 * 1024,
      max_concurrent_generations: 1,
      billing_interval: "month",
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
          json: async () => ({
            plans: [],
            packages: [],
            storageAddons: [
              {
                id: "storage_25gb",
                display_name: "25 GB add-on",
                storage_limit_bytes: 25 * 1024 * 1024 * 1024,
                monthly_price_cents: 500,
                sort_order: 1,
              },
              {
                id: "storage_100gb",
                display_name: "100 GB add-on",
                storage_limit_bytes: 100 * 1024 * 1024 * 1024,
                monthly_price_cents: 5900,
                sort_order: 2,
              },
              {
                id: "storage_500gb",
                display_name: "500 GB add-on",
                storage_limit_bytes: 500 * 1024 * 1024 * 1024,
                monthly_price_cents: 29900,
                sort_order: 3,
              },
            ],
          }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions?kind=storage") {
        return {
          ok: true,
          json: async () => ({ transactions: [] }),
        };
      }
      throw new Error(`Unexpected fetch ${String(url)}`);
    });
    activeStorageAddonsQueryMock.mockResolvedValue({
      data: [],
      error: null,
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: {
        usedBytes: 0,
        baseLimitBytes: 5 * 1024 * 1024 * 1024,
        addonLimitBytes: 0,
        totalLimitBytes: 5 * 1024 * 1024 * 1024,
        remainingBytes: 5 * 1024 * 1024 * 1024,
        isOverLimit: false,
      },
      loading: false,
      refreshQuotaSummary: refreshQuotaSummaryMock,
    });

    render(<ProfilePage />);

    expect(await screen.findByText("25 GB add-on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 25 GB" })).toBeEnabled();
    expect(screen.queryByText("100 GB add-on")).toBeNull();
    expect(screen.queryByText("500 GB add-on")).toBeNull();
  });

  it("shows the internal-comp empty state for Stripe storage payments", async () => {
    billingProfileState.stripe_customer_id = null;
    billingProfileState.stripe_subscription_id = null;
    billingContractState.value = {
      id: "contract_internal",
      plan_id: "business",
      offer_id: "business__internal_comp",
      stripe_subscription_id: null,
      stripe_price_id: null,
      contract_source: "internal_comp",
      recurring_price_cents: 0,
      monthly_credits_cents: 12000,
      storage_limit_bytes: 161061273600,
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
          json: async () => ({
            plans: [],
            packages: [],
            storageAddons: [
              {
                id: "storage_100gb",
                display_name: "100 GB add-on",
                storage_limit_bytes: 107374182400,
                monthly_price_cents: 5900,
                sort_order: 1,
              },
            ],
          }),
        };
      }
      if (url === "/api/billing/stripe/subscription-transactions?kind=storage") {
        return {
          ok: true,
          json: async () => ({ transactions: [] }),
        };
      }
      throw new Error(`Unexpected fetch ${String(url)}`);
    });

    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Media storage" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "No Stripe storage payments are available for this internally managed account."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Managed internally" })).toBeDisabled();
  });

  it("re-polls storage state after a successful add-on change", async () => {
    render(<ProfilePage />);

    const removeButton = await screen.findByRole("button", { name: "Remove" });
    await act(async () => {
      fireEvent.click(removeButton);
    });

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/storage-addon/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageAddonId: "storage_100gb", action: "remove" }),
      });
    });

    const initialStorageQueryCalls = activeStorageAddonsQueryMock.mock.calls.length;
    const initialQuotaRefreshCalls = refreshQuotaSummaryMock.mock.calls.length;

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
    });

    expect(activeStorageAddonsQueryMock.mock.calls.length).toBeGreaterThan(
      initialStorageQueryCalls
    );
    expect(refreshQuotaSummaryMock.mock.calls.length).toBeGreaterThan(initialQuotaRefreshCalls);
  }, 15000);

  it("automatically clears the storage add-on success notice", async () => {
    render(<ProfilePage />);

    const removeButton = await screen.findByRole("button", { name: "Remove" });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(removeButton);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("Storage add-on update submitted. Your workspace storage is syncing now.")
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(
      screen.queryByText("Storage add-on update submitted. Your workspace storage is syncing now.")
    ).not.toBeInTheDocument();
  });
});

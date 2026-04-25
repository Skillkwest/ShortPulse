/**
 * Profile storage-section tests for recurring storage add-on presentation.
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
  query: { section: "storage" } as Record<string, string>,
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
    recurring_price_cents: 4900,
    monthly_credits_cents: 60000,
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
      throw new Error(`Unexpected table mock: ${table}`);
    },
  }),
}));

describe("Profile storage actions", () => {
  beforeEach(() => {
    routerState.query = { section: "storage" };
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
                id: "addon_100gb",
                display_name: "100 GB add-on",
                storage_limit_bytes: 107374182400,
                monthly_price_cents: 1500,
                sort_order: 1,
              },
            ],
          }),
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
      quotaSummary: {
        usedBytes: 50 * 1024 * 1024 * 1024,
        baseLimitBytes: 500 * 1024 * 1024 * 1024,
        addonLimitBytes: 100 * 1024 * 1024 * 1024,
        totalLimitBytes: 600 * 1024 * 1024 * 1024,
        remainingBytes: 550 * 1024 * 1024 * 1024,
        isOverLimit: false,
      },
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
  });

  it("renders storage usage and recurring add-ons", async () => {
    render(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Media storage" })).toBeInTheDocument();
    expect(screen.getByText("Expand media capacity")).toBeInTheDocument();
    expect(screen.getByText("50.0 GB / 600.0 GB")).toBeInTheDocument();
  });
});

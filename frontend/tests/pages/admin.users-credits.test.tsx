/**
 * Admin support page tests for users and credits workflows.
 * Locks explicit selection, lazy ledger loading, manual adjustments, and destructive user deletion.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "../../pages/admin";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_1_ID = "22222222-2222-4222-8222-222222222222";
const USER_2_ID = "33333333-3333-4333-8333-333333333333";

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

describe("Admin users and credits overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: ADMIN_ID, email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });

    fetchWithAuthMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      const path = String(url);
      if (path.startsWith("/api/admin/users?")) {
        return jsonResponse({
          users: [
            {
              id: USER_1_ID,
              email: "alpha@example.com",
              planId: "studio",
              offerId: "studio__legacy_10",
              stripePriceId: "price_legacy_studio",
              contractSource: "stripe",
              recurringPriceCents: 1000,
              monthlyCreditsCents: 4000,
              billingSource: "subscription_contract",
              spendableCredits: 120,
              availableCredits: 150,
              reservedCredits: 30,
              subscriptionStatus: "active",
              createdAt: "2026-03-01T00:00:00.000Z",
            },
            {
              id: USER_2_ID,
              email: "beta@example.com",
              planId: "business",
              offerId: "business__current",
              stripePriceId: "price_current_business",
              contractSource: "stripe",
              recurringPriceCents: 3000,
              monthlyCreditsCents: 10000,
              billingSource: "subscription_contract",
              spendableCredits: 0,
              availableCredits: 0,
              reservedCredits: 0,
              subscriptionStatus: "inactive",
              createdAt: "2026-03-02T00:00:00.000Z",
            },
            {
              id: ADMIN_ID,
              email: "admin@example.com",
              planId: "business",
              offerId: "business__current",
              stripePriceId: "price_current_business",
              contractSource: "stripe",
              recurringPriceCents: 3000,
              monthlyCreditsCents: 10000,
              billingSource: "subscription_contract",
              spendableCredits: 5000,
              availableCredits: 5000,
              reservedCredits: 0,
              subscriptionStatus: "active",
              createdAt: "2026-03-03T00:00:00.000Z",
            },
          ],
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 3,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
          search: { limited: false },
        });
      }
      if (path.startsWith("/api/admin/credits/ledger?")) {
        const search = new URL(path, "http://localhost").searchParams;
        const userId = search.get("userId");
        return jsonResponse({
          transactions:
            userId === USER_2_ID
              ? [
                  {
                    id: "txn-2",
                    userId: USER_2_ID,
                    changeCents: 500,
                    reason: "Manual adjustment",
                    source: "admin",
                    sourceRef: "ticket-2",
                    pricingBreakdown: null,
                    createdAt: "2026-03-17T00:00:00.000Z",
                  },
                ]
              : [
                  {
                    id: "txn-1",
                    userId: USER_1_ID,
                    changeCents: -20,
                    reason: "Generation charge",
                    source: "generation",
                    sourceRef: "job-1",
                    pricingBreakdown: null,
                    createdAt: "2026-03-16T00:00:00.000Z",
                  },
                ],
        });
      }
      if (path.startsWith("/api/admin/billing-diagnostics?")) {
        const search = new URL(path, "http://localhost").searchParams;
        const userId = search.get("userId");
        return jsonResponse({
          target: {
            userId,
            email: userId === USER_2_ID ? "beta@example.com" : "alpha@example.com",
          },
          billingProfile: {
            planId: userId === USER_2_ID || userId === ADMIN_ID ? "business" : "studio",
            subscriptionStatus: userId === USER_2_ID ? "inactive" : "active",
            stripeCustomerId: "cus_test",
            stripeSubscriptionId: "sub_test",
            currentPeriodEnd: "2026-05-01T00:00:00.000Z",
          },
          currentContract:
            userId === USER_2_ID
              ? {
                  id: "contract-business",
                  planId: "business",
                  offerId: "business__current",
                  stripePriceId: "price_current_business",
                  contractSource: "stripe",
                  stripeSubscriptionId: "sub_test",
                  recurringPriceCents: 3000,
                  monthlyCreditsCents: 10000,
                  storageLimitBytes: 536870912000,
                  status: "inactive",
                  currentPeriodEnd: "2026-05-01T00:00:00.000Z",
                }
              : userId === ADMIN_ID
                ? null
                : {
                    id: "contract-studio-legacy",
                    planId: "studio",
                    offerId: "studio__legacy_10",
                    stripePriceId: "price_legacy_studio",
                    contractSource: "stripe",
                    stripeSubscriptionId: "sub_test",
                    recurringPriceCents: 1000,
                    monthlyCreditsCents: 4000,
                    storageLimitBytes: 107374182400,
                    status: "active",
                    currentPeriodEnd: "2026-05-01T00:00:00.000Z",
                  },
          linkedOffer:
            userId === USER_2_ID || userId === ADMIN_ID
              ? {
                  id: "business__current",
                  planId: "business",
                  offerName: "Business",
                  stripePriceId: "price_current_business",
                  recurringPriceCents: 3000,
                  monthlyCreditsCents: 10000,
                  storageLimitBytes: 536870912000,
                  acquisitionEnabled: true,
                  isActive: true,
                }
              : {
                  id: "studio__legacy_10",
                  planId: "studio",
                  offerName: "Studio Legacy $10",
                  stripePriceId: "price_legacy_studio",
                  recurringPriceCents: 1000,
                  monthlyCreditsCents: 4000,
                  storageLimitBytes: 107374182400,
                  acquisitionEnabled: false,
                  isActive: true,
                },
          currentPublicOffer:
            userId === USER_2_ID || userId === ADMIN_ID
              ? {
                  id: "business__current",
                  planId: "business",
                  offerName: "Business",
                  stripePriceId: "price_current_business",
                  recurringPriceCents: 3000,
                  monthlyCreditsCents: 10000,
                  storageLimitBytes: 536870912000,
                  acquisitionEnabled: true,
                  isActive: true,
                }
              : {
                  id: "studio__current",
                  planId: "studio",
                  offerName: "Studio",
                  stripePriceId: "price_current_studio",
                  recurringPriceCents: 3000,
                  monthlyCreditsCents: 6000,
                  storageLimitBytes: 107374182400,
                  acquisitionEnabled: true,
                  isActive: true,
                },
          activeStorageAddons:
            userId === USER_2_ID
              ? []
              : [
                  {
                    id: "addon-25gb",
                    storageAddonId: "storage_25gb",
                    offerId: "storage_25gb__current",
                    stripeSubscriptionItemId: "si_storage_25",
                    stripePriceId: "price_storage_25",
                    storageLimitBytes: 26843545600,
                    quantity: 1,
                    recurringPriceCents: 500,
                    status: "active",
                  },
                ],
          storageSummary:
            userId === USER_2_ID || userId === ADMIN_ID
              ? {
                  usedBytes: 2147483648,
                  baseLimitBytes: 0,
                  addonLimitBytes: 0,
                  totalLimitBytes: 0,
                  remainingBytes: 0,
                  isOverLimit: false,
                }
              : {
                  usedBytes: 5368709120,
                  baseLimitBytes: 107374182400,
                  addonLimitBytes: 26843545600,
                  totalLimitBytes: 134217728000,
                  remainingBytes: 128849018880,
                  isOverLimit: false,
                },
          stripeSubscription:
            userId === USER_2_ID
              ? {
                  configured: true,
                  customerId: "cus_test",
                  subscriptionId: "sub_test",
                  status: "inactive",
                  priceId: "price_current_business",
                  recurringPriceCents: 3000,
                  currency: "usd",
                  currentPeriodEnd: "2026-05-01T00:00:00.000Z",
                }
              : {
                  configured: true,
                  customerId: "cus_test",
                  subscriptionId: "sub_test",
                  status: "active",
                  priceId: "price_legacy_studio",
                  recurringPriceCents: 1000,
                  currency: "usd",
                  currentPeriodEnd: "2026-05-01T00:00:00.000Z",
                },
          findings:
            userId === USER_2_ID
              ? []
              : [
                  {
                    code: "grandfathered_price_gap",
                    severity: "info",
                    confidence: "high",
                    summary:
                      "Current contract is on a different recurring price than the public offer.",
                    details: "Legacy subscriber remains on the older recurring price.",
                    recommendedActions: [],
                  },
                ],
        });
      }
      if (path === "/api/admin/credits/adjust") {
        expect(options?.method).toBe("POST");
        return jsonResponse({ ok: true });
      }
      if (path === "/api/admin/billing/contracts/update") {
        expect(options?.method).toBe("POST");
        return jsonResponse({ ok: true, creditsGrantedCents: 12000 });
      }
      if (path === `/api/admin/users/${encodeURIComponent(USER_2_ID)}`) {
        expect(options?.method).toBe("DELETE");
        return jsonResponse({ ok: true, userId: USER_2_ID, email: "beta@example.com" });
      }
      if (path.startsWith("/api/admin/errors?")) {
        return jsonResponse({
          errors: [],
          summary: {
            openCount: 0,
            highSeverityOpenCount: 0,
            last24hCount: 0,
            appOpenCount: 0,
            generationOpenCount: 0,
          },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      if (path.startsWith("/api/admin/error-events?")) {
        return jsonResponse({
          events: [],
          summary: {
            last15mCount: 0,
            high15mCount: 0,
            generation15mCount: 0,
            providerRunningTimeout15mCount: 0,
            lastHourCount: 0,
            last24hCount: 0,
            app24hCount: 0,
            generation24hCount: 0,
            high24hCount: 0,
            characterModeReferenceRefreshEmptyLastHourCount: 0,
            characterModeReferenceRefreshEmptyLast24hCount: 0,
            characterModeBundleUnavailableFallbackLastHourCount: 0,
            characterModeBundleUnavailableFallbackLast24hCount: 0,
            total15mThreshold: 40,
            high15mThreshold: 8,
            generation15mThreshold: 20,
            providerRunningTimeout15mThreshold: 2,
            total15mBreached: false,
            high15mBreached: false,
            generation15mBreached: false,
            providerRunningTimeout15mBreached: false,
          },
          health: { eventsTableAvailable: true, degraded: false, reason: null },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({ announcement: null });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("auto-selects the current admin account without preloading the ledger", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select alpha@example.com" })).toBeInTheDocument()
    );

    const selectButtons = screen.getAllByRole("button", { name: /Select / });
    expect(selectButtons[0]).toHaveAttribute("aria-label", "Select admin@example.com");
    expect(screen.getByText("Admin emails")).toBeInTheDocument();
    expect(
      screen.getByText("This account is pinned to the top of the loaded user list.")
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("snapshot-card-storage")).toBeInTheDocument());
    expect(screen.getByTestId("snapshot-card-plan")).toHaveTextContent("Business");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("10,000 credits / month");
    expect(screen.getByTestId("snapshot-status-badge")).toHaveTextContent("Active");
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("500.0 GB");
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("2.0 GB used");
    expect(screen.getByRole("button", { name: "+100" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "+500" })).toBeEnabled();
    expect(fetchWithAuthMock).not.toHaveBeenCalledWith(
      `/api/admin/credits/ledger?userId=${ADMIN_ID}&limit=20`,
      expect.anything()
    );
  });

  it("loads the selected user's ledger only when requested", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select beta@example.com" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Select beta@example.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Show credit log" }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        `/api/admin/credits/ledger?userId=${USER_2_ID}&limit=20`,
        expect.objectContaining({ method: "GET" })
      )
    );
    expect(screen.getByText("ref: ticket-2")).toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-plan")).toHaveTextContent("Business");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("$30.00/mo");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("10,000 credits / month");
    expect(screen.getByTestId("snapshot-status-badge")).toHaveTextContent("Inactive");
    expect(screen.queryByTestId("snapshot-payment-exempt-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("500.0 GB");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("0");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("Spendable");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("available 0");
  });

  it("shows billing diagnostics findings for a grandfathered subscriber", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select alpha@example.com" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Select alpha@example.com" }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        `/api/admin/billing-diagnostics?userId=${USER_1_ID}`,
        expect.objectContaining({ method: "GET" })
      )
    );

    expect(
      screen.getByText("Current contract is on a different recurring price than the public offer.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-plan")).toHaveTextContent("Studio");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("$10.00/mo");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("4,000 credits / month");
    expect(screen.getByTestId("snapshot-status-badge")).toHaveTextContent("Active");
    expect(screen.queryByTestId("snapshot-payment-exempt-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("125.0 GB");
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent(
      "5.0 GB used · 25.0 GB add-ons"
    );
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("120");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("Spendable");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("available 150");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("held 30");
  });

  it("applies a manual credit adjustment for the selected user", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select beta@example.com" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Select beta@example.com" }));
    fireEvent.change(screen.getByPlaceholderText("+500 credits or -100 credits"), {
      target: { value: "+500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save credit change" }));

    await waitFor(() => expect(screen.getByText("Credit adjustment applied.")).toBeInTheDocument());

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/credits/adjust",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          userId: USER_2_ID,
          changeCents: 500,
        }),
      })
    );
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      `/api/admin/credits/ledger?userId=${USER_2_ID}&limit=20`,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("saves payment-exempt access for the selected user", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select beta@example.com" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Select beta@example.com" }));
    fireEvent.change(screen.getByDisplayValue("Business"), {
      target: { value: "business" },
    });
    fireEvent.click(screen.getByLabelText("Payment exempt"));
    fireEvent.change(
      screen.getByPlaceholderText("Why are you overriding billing for this account?"),
      {
        target: { value: "Internal QA" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save access" }));

    await waitFor(() =>
      expect(
        screen.getByText("Payment-exempt access saved and 12,000 credits were seeded.")
      ).toBeInTheDocument()
    );

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/billing/contracts/update",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          userId: USER_2_ID,
          action: "grant_internal_comp",
          planId: "business",
          grantReason: "Internal QA",
          allowStripeTakeover: false,
        }),
      })
    );
  });

  it("requires typed confirmation before deleting a user", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Delete beta@example.com" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete beta@example.com" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Permanently delete this ShortPulse account?")
    ).toBeInTheDocument();

    const confirmButton = within(dialog).getByRole("button", { name: "Delete user permanently" });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(within(dialog).getByPlaceholderText("beta@example.com"), {
      target: { value: "wrong@example.com" },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(within(dialog).getByPlaceholderText("beta@example.com"), {
      target: { value: "beta@example.com" },
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.getByText("User deleted permanently.")).toBeInTheDocument());
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      `/api/admin/users/${encodeURIComponent(USER_2_ID)}`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({
          confirmationText: "beta@example.com",
        }),
      })
    );
  });
});

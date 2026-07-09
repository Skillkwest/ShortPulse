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
const windowOpenMock = vi.hoisted(() => vi.fn());

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
let openedPortalWindow: {
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
  location: { href: string };
};
let scrollIntoViewMock: ReturnType<typeof vi.fn>;

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("Admin users and credits overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openedPortalWindow = {
      closed: false,
      close: vi.fn(),
      location: { href: "" },
    };
    windowOpenMock.mockReset();
    windowOpenMock.mockReturnValue(openedPortalWindow);
    vi.stubGlobal("open", windowOpenMock);
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

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
              billingInterval: "month",
              recurringPriceCents: 1000,
              monthlyCreditsCents: 4000,
              billingSource: "subscription_contract",
              spendableCredits: 120,
              availableCredits: 150,
              reservedCredits: 30,
              currentCycleSpentCredits: 88,
              subscriptionStatus: "active",
              cancelAtPeriodEnd: true,
              planRenewalAt: "2026-04-30T12:00:00.000Z",
              topUpPurchaseCount: 2,
              topUpCreditsPurchased: 2500,
              recurringStorageAddonBytes: 10737418240,
              recurringStorageAddonPriceCents: 500,
              createdAt: "2026-03-01T00:00:00.000Z",
            },
            {
              id: USER_2_ID,
              email: "beta@example.com",
              planId: "business",
              offerId: "business__current",
              stripePriceId: "price_current_business",
              contractSource: "stripe",
              billingInterval: "year",
              recurringPriceCents: 3000,
              monthlyCreditsCents: 10000,
              billingSource: "subscription_contract",
              spendableCredits: 0,
              availableCredits: 0,
              reservedCredits: 0,
              currentCycleSpentCredits: 10400,
              subscriptionStatus: "inactive",
              cancelAtPeriodEnd: false,
              planRenewalAt: "2026-05-15T12:00:00.000Z",
              topUpPurchaseCount: 0,
              topUpCreditsPurchased: 0,
              recurringStorageAddonBytes: 0,
              recurringStorageAddonPriceCents: 0,
              createdAt: "2026-03-02T12:00:00.000Z",
            },
            {
              id: ADMIN_ID,
              email: "admin@example.com",
              planId: "business",
              offerId: "business__current",
              stripePriceId: "price_current_business",
              contractSource: "stripe",
              billingInterval: "month",
              recurringPriceCents: 3000,
              monthlyCreditsCents: 10000,
              billingSource: "subscription_contract",
              spendableCredits: 5000,
              availableCredits: 5000,
              reservedCredits: 0,
              currentCycleSpentCredits: 1200,
              subscriptionStatus: "active",
              cancelAtPeriodEnd: false,
              planRenewalAt: "2026-04-30T12:00:00.000Z",
              topUpPurchaseCount: 1,
              topUpCreditsPurchased: 10000,
              recurringStorageAddonBytes: 53687091200,
              recurringStorageAddonPriceCents: 1500,
              createdAt: "2026-03-02T12:00:00.000Z",
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
            currentPeriodEnd: "2026-04-30T12:00:00.000Z",
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
                  billingInterval: "year",
                  recurringPriceCents: 3000,
                  monthlyCreditsCents: 10000,
                  storageLimitBytes: 536870912000,
                  status: "inactive",
                  currentPeriodEnd: "2026-04-30T12:00:00.000Z",
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
                    billingInterval: "month",
                    recurringPriceCents: 1000,
                    monthlyCreditsCents: 4000,
                    storageLimitBytes: 107374182400,
                    status: "active",
                    cancelAtPeriodEnd: true,
                    currentPeriodEnd: "2026-04-30T12:00:00.000Z",
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
                  billingInterval: "year",
                  recurringPriceCents: 3000,
                  currency: "usd",
                  currentPeriodEnd: "2026-04-30T12:00:00.000Z",
                }
              : {
                  configured: true,
                  customerId: "cus_test",
                  subscriptionId: "sub_test",
                  status: "active",
                  priceId: "price_legacy_studio",
                  billingInterval: "month",
                  recurringPriceCents: 1000,
                  currency: "usd",
                  currentPeriodEnd: "2026-04-30T12:00:00.000Z",
                },
          pricingObservability:
            userId === USER_2_ID || userId === ADMIN_ID
              ? {
                  rowsScanned: {
                    reservations: 0,
                    ledgerEntries: 0,
                  },
                  observedRows: {
                    reservations: 0,
                    ledgerEntries: 0,
                  },
                  mismatchCount: 0,
                  lastObservedAt: null,
                  latestEvents: [],
                }
              : {
                  rowsScanned: {
                    reservations: 2,
                    ledgerEntries: 2,
                  },
                  observedRows: {
                    reservations: 1,
                    ledgerEntries: 1,
                  },
                  mismatchCount: 0,
                  lastObservedAt: "2026-04-15T00:05:00.000Z",
                  latestEvents: [
                    {
                      sourceType: "ledger",
                      sourceId: "ledger-1",
                      sourceRef: "source-ref-1",
                      providerRequestId: null,
                      createdAt: "2026-04-15T00:05:00.000Z",
                      displayedBilledCredits: 10,
                      actualBilledCredits: 10,
                      deltaCredits: 0,
                      mismatch: false,
                      pricingDisplaySource: "shared_adapter",
                      pricingPolicyReady: true,
                    },
                  ],
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
        const body =
          typeof options?.body === "string"
            ? (JSON.parse(options.body) as Record<string, unknown>)
            : {};
        expect(body.idempotencyKey).toEqual(expect.any(String));
        return jsonResponse({ ok: true });
      }
      if (path === "/api/admin/billing/contracts/update") {
        expect(options?.method).toBe("POST");
        return jsonResponse({ ok: true, creditsGrantedCents: 8000 });
      }
      if (path === "/api/admin/billing/portal") {
        expect(options?.method).toBe("POST");
        return jsonResponse({ portalUrl: "https://stripe.test/admin-portal-session" });
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

  it("renders a structured loading shell while auth is unresolved", () => {
    useProtectedRouteMock.mockReturnValue({
      loading: true,
      user: null,
    });

    render(<AdminDashboardPage />);

    expect(screen.getByRole("heading", { name: "Support console" })).toBeInTheDocument();
    expect(screen.getByText("Checking your session")).toBeInTheDocument();
    expect(
      screen.getByText("We need your authenticated session before loading this admin workspace.")
    ).toBeInTheDocument();
  });

  it("shows guided loading states before the first selected account resolves", async () => {
    const usersResponse = deferred<ReturnType<typeof jsonResponse>>();
    const defaultFetchImplementation = fetchWithAuthMock.getMockImplementation();
    if (!defaultFetchImplementation) {
      throw new Error("Expected default fetch mock implementation.");
    }

    fetchWithAuthMock.mockImplementation((url: unknown, options?: RequestInit) => {
      const path = String(url);
      if (path.startsWith("/api/admin/users?")) {
        return usersResponse.promise;
      }
      return defaultFetchImplementation(url, options);
    });

    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("Preparing the selected account workspace")).toBeInTheDocument()
    );
    expect(screen.getByText("Loading users…")).toBeInTheDocument();
    expect(screen.getByText("Loading user index…")).toBeInTheDocument();

    usersResponse.resolve(
      jsonResponse({
        users: [
          {
            id: USER_1_ID,
            email: "alpha@example.com",
            planId: "studio",
            offerId: "studio__legacy_10",
            stripePriceId: "price_legacy_studio",
            contractSource: "stripe",
            billingInterval: "month",
            recurringPriceCents: 1000,
            monthlyCreditsCents: 4000,
            billingSource: "subscription_contract",
            spendableCredits: 120,
            availableCredits: 150,
            reservedCredits: 30,
            currentCycleSpentCredits: 88,
            subscriptionStatus: "active",
            cancelAtPeriodEnd: true,
            planRenewalAt: "2026-04-30T12:00:00.000Z",
            topUpPurchaseCount: 2,
            topUpCreditsPurchased: 2500,
            recurringStorageAddonBytes: 10737418240,
            recurringStorageAddonPriceCents: 500,
            createdAt: "2026-03-01T00:00:00.000Z",
          },
          {
            id: USER_2_ID,
            email: "beta@example.com",
            planId: "business",
            offerId: "business__current",
            stripePriceId: "price_current_business",
            contractSource: "stripe",
            billingInterval: "year",
            recurringPriceCents: 3000,
            monthlyCreditsCents: 10000,
            billingSource: "subscription_contract",
            spendableCredits: 0,
            availableCredits: 0,
            reservedCredits: 0,
            currentCycleSpentCredits: 10400,
            subscriptionStatus: "inactive",
            cancelAtPeriodEnd: false,
            planRenewalAt: "2026-05-15T12:00:00.000Z",
            topUpPurchaseCount: 0,
            topUpCreditsPurchased: 0,
            recurringStorageAddonBytes: 0,
            recurringStorageAddonPriceCents: 0,
            createdAt: "2026-03-02T12:00:00.000Z",
          },
          {
            id: ADMIN_ID,
            email: "admin@example.com",
            planId: "business",
            offerId: "business__current",
            stripePriceId: "price_current_business",
            contractSource: "stripe",
            billingInterval: "month",
            recurringPriceCents: 3000,
            monthlyCreditsCents: 10000,
            billingSource: "subscription_contract",
            spendableCredits: 5000,
            availableCredits: 5000,
            reservedCredits: 0,
            currentCycleSpentCredits: 1200,
            subscriptionStatus: "active",
            cancelAtPeriodEnd: false,
            planRenewalAt: "2026-04-30T12:00:00.000Z",
            topUpPurchaseCount: 1,
            topUpCreditsPurchased: 10000,
            recurringStorageAddonBytes: 53687091200,
            recurringStorageAddonPriceCents: 1500,
            createdAt: "2026-03-02T12:00:00.000Z",
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
      })
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select alpha@example.com" })).toBeInTheDocument()
    );
  });

  it("auto-selects the current admin account without preloading the ledger", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select alpha@example.com" })).toBeInTheDocument()
    );

    expect(screen.getAllByText("Plan").length).toBeGreaterThan(0);
    expect(screen.getByText("Credit flags (1)")).toBeInTheDocument();
    expect(screen.getByText("Cycle spent")).toBeInTheDocument();
    expect(screen.getByText("Top-ups")).toBeInTheDocument();
    expect(screen.getByText("Renews / ends")).toBeInTheDocument();
    const userListSection = screen.getByRole("heading", { name: "User list" }).closest("section");
    expect(userListSection).not.toBeNull();
    const userList = within(userListSection as HTMLElement);
    expect(userList.queryByText("Storage")).not.toBeInTheDocument();
    const alphaRow = screen.getByRole("button", { name: "Select alpha@example.com" }).parentElement;
    expect(alphaRow).toHaveTextContent("Studio");
    expect(alphaRow).toHaveTextContent("88");
    expect(alphaRow).toHaveTextContent("120");
    expect(alphaRow).toHaveTextContent("2,500");
    expect(alphaRow).toHaveTextContent("2 purchases");
    expect(alphaRow).toHaveTextContent("Cancellation scheduled");
    expect(alphaRow).toHaveTextContent("Ends Apr 30, 2026");
    expect(alphaRow).not.toHaveTextContent("10 GB");
    expect(alphaRow).not.toHaveTextContent("$5.00/mo");

    const selectButtons = screen.getAllByRole("button", { name: /Select / });
    expect(selectButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Select alpha@example.com",
      "Select beta@example.com",
      "Select admin@example.com",
    ]);
    await waitFor(() => expect(screen.getByTestId("snapshot-card-storage")).toBeInTheDocument());
    expect(screen.getByTestId("snapshot-card-plan")).toHaveTextContent("Business");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("10,000 credits / month");
    expect(screen.getByTestId("snapshot-status-badge")).toHaveTextContent("Active");
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("500 GB");
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("2 GB used");
    expect(screen.getByTestId("snapshot-card-billing-state")).toHaveTextContent("Active");
    expect(screen.getByTestId("snapshot-card-renewal")).toHaveTextContent("Apr 30, 2026");
    expect(screen.getByTestId("snapshot-card-joined")).toHaveTextContent("Mar 2, 2026");
    expect(screen.getByText("Support findings")).toBeInTheDocument();
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
    await waitFor(() =>
      expect(scrollIntoViewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          block: "start",
          inline: "nearest",
        })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Open full credit log" }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        `/api/admin/credits/ledger?userId=${USER_2_ID}&limit=20`,
        expect.objectContaining({ method: "GET" })
      )
    );
    expect(screen.getByText("ref: ticket-2")).toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-plan")).toHaveTextContent("Business");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("$30.00/yr");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("10,000 credits / month");
    expect(screen.getByTestId("snapshot-status-badge")).toHaveTextContent("Inactive");
    expect(screen.queryByTestId("snapshot-payment-exempt-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("500 GB");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("0");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("Spendable");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("available 0");
    expect(screen.getByTestId("snapshot-card-billing-state")).toHaveTextContent("Inactive");
    expect(screen.getByTestId("snapshot-card-renewal")).toHaveTextContent("Apr 30, 2026");
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
      screen.getAllByText(
        "Current contract is on a different recurring price than the public offer."
      ).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Pricing observability")).not.toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-plan")).toHaveTextContent("Studio");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("$10.00/mo");
    expect(screen.getByTestId("snapshot-card-price")).toHaveTextContent("4,000 credits / month");
    expect(screen.getByTestId("snapshot-status-badge")).toHaveTextContent("Cancellation scheduled");
    expect(screen.queryByTestId("snapshot-payment-exempt-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent("125 GB");
    expect(screen.getByTestId("snapshot-card-storage")).toHaveTextContent(
      "5 GB used · 25 GB add-ons"
    );
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("120");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("Spendable");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("available 150");
    expect(screen.getByTestId("snapshot-card-credits")).toHaveTextContent("held 30");
    expect(screen.getByTestId("snapshot-card-billing-state")).toHaveTextContent(
      "Cancellation scheduled"
    );
    expect(screen.getByTestId("snapshot-card-billing-state")).toHaveTextContent(
      "Access ends Apr 30, 2026."
    );
    expect(screen.getByTestId("snapshot-card-renewal")).toHaveTextContent("Access ends");
    expect(screen.getByTestId("snapshot-card-renewal")).toHaveTextContent("Apr 30, 2026");
    expect(screen.getByTestId("snapshot-card-renewal")).toHaveTextContent(
      "Cancellation takes effect at period end."
    );
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

    const adjustmentCall = fetchWithAuthMock.mock.calls.find(
      ([path]) => path === "/api/admin/credits/adjust"
    );
    expect(adjustmentCall?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    const adjustmentBody =
      typeof adjustmentCall?.[1]?.body === "string"
        ? (JSON.parse(adjustmentCall[1].body) as Record<string, unknown>)
        : {};
    expect(adjustmentBody).toEqual({
      userId: USER_2_ID,
      changeCents: 500,
      idempotencyKey: expect.any(String),
    });
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
    fireEvent.click(screen.getByLabelText("Payment exempt"));

    await waitFor(() =>
      expect(
        screen.getByText("Payment-exempt access saved and 8,000 credits were seeded.")
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
          allowStripeTakeover: true,
        }),
      })
    );
    expect(screen.queryByText("Stripe takeover")).not.toBeInTheDocument();
  });

  it("opens Stripe billing for the selected user", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select beta@example.com" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Select beta@example.com" }));
    const stripeBillingToggle = screen.getByRole("button", { name: /Stripe billing/ });
    expect(stripeBillingToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Billing identity state")).not.toBeInTheDocument();

    fireEvent.click(stripeBillingToggle);
    expect(stripeBillingToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Billing identity state")).toBeInTheDocument();

    fireEvent.click(stripeBillingToggle);
    expect(stripeBillingToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Billing identity state")).not.toBeInTheDocument();

    fireEvent.click(stripeBillingToggle);
    fireEvent.click(screen.getByRole("button", { name: "Open Stripe billing" }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/billing/portal",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: USER_2_ID }),
        })
      )
    );

    expect(windowOpenMock).toHaveBeenCalledWith("", "_blank", "noopener,noreferrer");
    expect(openedPortalWindow.location.href).toBe("https://stripe.test/admin-portal-session");
    expect(screen.getByText("Opened Stripe billing in a new tab.")).toBeInTheDocument();
  });

  it("does not expose row delete actions from the support user list", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select beta@example.com" })).toBeInTheDocument()
    );

    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete / })).not.toBeInTheDocument();
  });
});

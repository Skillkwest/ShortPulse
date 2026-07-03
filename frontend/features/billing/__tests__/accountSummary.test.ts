import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBillingAccountSummary,
  resetBillingAccountSummaryClientStateForTests,
} from "../accountSummary";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

vi.mock("../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const createAccountSummaryPayload = (userId: string) => ({
  userId,
  resolvedPlan: {
    id: "free",
    label: "Baseline access",
    className: "plan-starter",
    monthlyCreditsCents: 0,
  },
  quotaStatus: "available",
  quotaSummary: {
    usedBytes: 10,
    baseLimitBytes: 100,
    addonLimitBytes: 0,
    totalLimitBytes: 100,
    remainingBytes: 90,
    isOverLimit: false,
  },
});

const mockAccountSummaryResponse = (userId: string) =>
  new Response(JSON.stringify(createAccountSummaryPayload(userId)), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });

describe("fetchBillingAccountSummary", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetBillingAccountSummaryClientStateForTests();
    fetchWithAuthMock.mockResolvedValue(mockAccountSummaryResponse("user-1"));
  });

  it("reuses a fresh successful summary for the same expected user", async () => {
    const first = await fetchBillingAccountSummary({ expectedUserId: "user-1" });
    const second = await fetchBillingAccountSummary({ expectedUserId: "user-1" });

    expect(first?.userId).toBe("user-1");
    expect(second?.userId).toBe("user-1");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses the successful-result cache for forced refreshes", async () => {
    await fetchBillingAccountSummary({ expectedUserId: "user-1" });
    await fetchBillingAccountSummary({ expectedUserId: "user-1", force: true });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
  });

  it("does not return one user's cached summary for a different expected user", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(mockAccountSummaryResponse("user-1"))
      .mockResolvedValueOnce(mockAccountSummaryResponse("user-2"));

    const first = await fetchBillingAccountSummary({ expectedUserId: "user-1" });
    const second = await fetchBillingAccountSummary({ expectedUserId: "user-2" });

    expect(first?.userId).toBe("user-1");
    expect(second?.userId).toBe("user-2");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
  });

  it("keeps unavailable quota distinct from an available zero-usage quota", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...createAccountSummaryPayload("user-1"),
          quotaStatus: "unavailable",
          quotaSummary: null,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    );

    const summary = await fetchBillingAccountSummary({ expectedUserId: "user-1" });

    expect(summary?.quotaStatus).toBe("unavailable");
    expect(summary?.quotaSummary).toBeNull();
  });

  it("requests and parses profile state separately from skinny account summaries", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...createAccountSummaryPayload("user-1"),
          profileState: {
            billingProfile: {
              plan_id: "starter",
              subscription_status: "active",
              current_period_end: "2026-07-15T00:00:00.000Z",
              stripe_customer_id: "cus_123",
              stripe_subscription_id: "sub_123",
            },
            billingContract: {
              id: "contract_1",
              plan_id: "starter",
              offer_id: "starter__monthly",
              billing_interval: "month",
              stripe_subscription_id: "sub_123",
              stripe_price_id: "price_starter",
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
            },
            billingActivity: [
              {
                id: "ledger_1",
                change_cents: 2000,
                reason: "credit_purchase",
                source: "stripe_checkout",
                source_ref: "cs_123",
                metadata: { credit_package_id: "growth" },
                created_at: "2026-06-15T00:00:00.000Z",
              },
            ],
            activeStorageAddons: [
              {
                id: "storage_row_1",
                storageAddonId: "storage_10gb",
                offerId: "storage_10gb__monthly",
                stripeSubscriptionItemId: "si_123",
                storageLimitBytes: 10737418240,
                quantity: 1,
                recurringPriceCents: 500,
                status: "active",
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    );

    const summary = await fetchBillingAccountSummary({
      expectedUserId: "user-1",
      includeProfileState: true,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/billing/account-summary?includeProfileState=1",
      expect.objectContaining({ method: "GET" })
    );
    expect(summary?.profileState?.billingProfile?.plan_id).toBe("starter");
    expect(summary?.profileState?.billingContract?.monthly_credits_cents).toBe(350);
    expect(summary?.profileState?.billingActivity[0]?.source).toBe("stripe_checkout");
    expect(summary?.profileState?.activeStorageAddons[0]?.storageAddonId).toBe("storage_10gb");
  });
});

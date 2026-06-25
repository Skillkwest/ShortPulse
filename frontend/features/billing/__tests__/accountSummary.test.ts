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
});

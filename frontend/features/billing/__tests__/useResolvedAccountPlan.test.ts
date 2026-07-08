import type { User } from "@supabase/supabase-js";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSupabaseSessionState } from "../../../lib/supabaseClient";
import { fetchBillingAccountSummary } from "../accountSummary";
import { useResolvedAccountPlan } from "../useResolvedAccountPlan";

vi.mock("../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

vi.mock("../accountSummary", () => ({
  fetchBillingAccountSummary: vi.fn(),
}));

const fetchBillingAccountSummaryMock = vi.mocked(fetchBillingAccountSummary);
const useSupabaseSessionStateMock = vi.mocked(useSupabaseSessionState);

describe("useResolvedAccountPlan", () => {
  beforeEach(() => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: {
        id: "user-1",
        email: "owner@example.com",
        user_metadata: { plan: "free" },
      } as unknown as User,
    });

    fetchBillingAccountSummaryMock.mockResolvedValue({
      userId: "user-1",
      resolvedPlan: {
        id: "free",
        label: "Baseline access",
        className: "plan-starter",
        monthlyCreditsCents: 500,
      },
      pendingSubscriptionChange: null,
      quotaStatus: "unavailable",
      quotaSummary: null,
    });
  });

  it("resolves the active plan from the authenticated account summary route", async () => {
    const { result } = renderHook(() => useResolvedAccountPlan());

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        id: "free",
        label: "Baseline access",
        className: "plan-starter",
        monthlyCreditsCents: 500,
      });
      expect(result.current.status).toBe("ready");
    });
    expect(fetchBillingAccountSummaryMock).toHaveBeenCalledTimes(1);
  });

  it("uses the account summary monthly credits for existing subscribers", async () => {
    fetchBillingAccountSummaryMock.mockResolvedValue({
      userId: "user-1",
      resolvedPlan: {
        id: "free",
        label: "Baseline access",
        className: "plan-starter",
        monthlyCreditsCents: 1200,
      },
      pendingSubscriptionChange: null,
      quotaStatus: "unavailable",
      quotaSummary: null,
    });

    const { result } = renderHook(() => useResolvedAccountPlan());

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        id: "free",
        label: "Baseline access",
        className: "plan-starter",
        monthlyCreditsCents: 1200,
      });
    });
  });

  it("falls back to the explicit default tier when account summary loading fails", async () => {
    fetchBillingAccountSummaryMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useResolvedAccountPlan({ defaultPlanTier: "business" }));

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        id: "business",
        label: "Business",
        className: "plan-business",
        monthlyCreditsCents: 0,
      });
      expect(result.current.status).toBe("unavailable");
    });
  });

  it("uses the plan returned by the account summary route", async () => {
    fetchBillingAccountSummaryMock.mockResolvedValue({
      userId: "user-1",
      resolvedPlan: {
        id: "business",
        label: "Business",
        className: "plan-business",
        monthlyCreditsCents: 0,
      },
      pendingSubscriptionChange: null,
      quotaStatus: "unavailable",
      quotaSummary: null,
    });

    const { result } = renderHook(() => useResolvedAccountPlan());

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        id: "business",
        label: "Business",
        className: "plan-business",
        monthlyCreditsCents: 0,
      });
    });
  });

  it("returns pending subscription changes from the account summary route", async () => {
    fetchBillingAccountSummaryMock.mockResolvedValue({
      userId: "user-1",
      resolvedPlan: {
        id: "media",
        label: "Media",
        className: "plan-media",
        monthlyCreditsCents: 1200,
      },
      pendingSubscriptionChange: {
        kind: "scheduled_downgrade",
        status: "active",
        currentPlanId: "media",
        currentOfferId: "media__monthly",
        currentBillingInterval: "month",
        currentStripePriceId: "price_media",
        targetPlanId: "starter",
        targetOfferId: "starter__monthly",
        targetPlanLabel: "Starter",
        targetBillingInterval: "month",
        targetStripePriceId: "price_starter",
        targetRecurringPriceCents: 1500,
        targetMonthlyCreditsCents: 350,
        targetStorageLimitBytes: 5368709120,
        targetMaxConcurrentGenerations: 1,
        effectiveAt: "2026-08-08T14:59:23.000Z",
        currentBenefitsEndAt: "2026-08-08T14:59:23.000Z",
      },
      quotaStatus: "unavailable",
      quotaSummary: null,
    });

    const { result } = renderHook(() => useResolvedAccountPlan());

    await waitFor(() => {
      expect(result.current.pendingSubscriptionChange?.targetPlanLabel).toBe("Starter");
      expect(result.current.resolvedPlan?.id).toBe("media");
    });
  });
});

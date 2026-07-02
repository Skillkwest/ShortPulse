import { act, renderHook, waitFor } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRouteSessionProvider } from "../../../lib/protectedRouteSessionContext";
import { fetchBillingAccountSummary } from "../accountSummary";
import {
  requestMediaStorageQuotaSummaryRefresh,
  useMediaStorageQuotaSummary,
} from "../useMediaStorageQuotaSummary";

const fetchBillingAccountSummaryMock = vi.mocked(fetchBillingAccountSummary);
const primeSupabaseSessionMock = vi.fn();
const useSupabaseSessionStateMock = vi.fn();

vi.mock("../../../lib/supabaseClient", () => ({
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
  useSupabaseSessionState: () => useSupabaseSessionStateMock(),
}));

vi.mock("../accountSummary", () => ({
  fetchBillingAccountSummary: vi.fn(),
}));

describe("useMediaStorageQuotaSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeSupabaseSessionMock.mockReset();
    useSupabaseSessionStateMock.mockReturnValue({
      user: { id: "user-1" },
      session: null,
      loading: false,
    });
    fetchBillingAccountSummaryMock.mockResolvedValue({
      userId: "user-1",
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
  });

  it("refreshes all active hook instances when a shared quota refresh is requested", async () => {
    renderHook(() => useMediaStorageQuotaSummary({ enabled: true }));
    renderHook(() => useMediaStorageQuotaSummary({ enabled: true }));

    await waitFor(() => expect(fetchBillingAccountSummaryMock).toHaveBeenCalledTimes(2));

    act(() => {
      requestMediaStorageQuotaSummaryRefresh();
    });

    await waitFor(() => expect(fetchBillingAccountSummaryMock).toHaveBeenCalledTimes(4));
  });

  it("primes the resolved protected-route session before loading the account summary", async () => {
    const session = { access_token: "protected-token", user: { id: "user-1" } } as Session;
    const user = { id: "user-1", email: "user@example.com" } as User;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ProtectedRouteSessionProvider, { session, user, children });

    renderHook(() => useMediaStorageQuotaSummary({ enabled: true }), { wrapper });

    await waitFor(() =>
      expect(fetchBillingAccountSummaryMock).toHaveBeenCalledWith({
        force: false,
        expectedUserId: "user-1",
      })
    );
    expect(primeSupabaseSessionMock).toHaveBeenCalledWith(session);
    expect(primeSupabaseSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      fetchBillingAccountSummaryMock.mock.invocationCallOrder[0]
    );
  });

  it("keeps quota unavailable instead of creating a false zero-usage fallback", async () => {
    fetchBillingAccountSummaryMock.mockResolvedValueOnce({
      userId: "user-1",
      resolvedPlan: {
        id: "free",
        label: "Baseline access",
        className: "plan-starter",
        monthlyCreditsCents: 0,
      },
      quotaStatus: "unavailable",
      quotaSummary: null,
    });

    const { result } = renderHook(() =>
      useMediaStorageQuotaSummary({ enabled: true, fallbackPlanId: "free" })
    );

    await waitFor(() => expect(result.current.quotaStatus).toBe("unavailable"));
    expect(result.current.quotaSummary).toBeNull();
  });

  it("can defer automatic focus refresh without blocking initial or requested refreshes", async () => {
    const shouldDeferAutomaticRefresh = vi.fn(() => true);
    renderHook(() =>
      useMediaStorageQuotaSummary({
        enabled: true,
        shouldDeferAutomaticRefresh,
      })
    );

    await waitFor(() => expect(fetchBillingAccountSummaryMock).toHaveBeenCalledTimes(1));
    fetchBillingAccountSummaryMock.mockClear();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(shouldDeferAutomaticRefresh).toHaveBeenCalled();
    expect(fetchBillingAccountSummaryMock).not.toHaveBeenCalled();

    act(() => {
      requestMediaStorageQuotaSummaryRefresh();
    });

    await waitFor(() => expect(fetchBillingAccountSummaryMock).toHaveBeenCalledTimes(1));
  });
});

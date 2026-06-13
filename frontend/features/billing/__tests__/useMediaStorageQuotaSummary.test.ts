import { act, renderHook, waitFor } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRouteSessionProvider } from "../../../lib/protectedRouteSessionContext";
import {
  requestMediaStorageQuotaSummaryRefresh,
  useMediaStorageQuotaSummary,
} from "../useMediaStorageQuotaSummary";

const rpcMock = vi.fn();
const primeSupabaseSessionMock = vi.fn();
const useSupabaseSessionStateMock = vi.fn();

vi.mock("../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
  useSupabaseSessionState: () => useSupabaseSessionStateMock(),
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
    rpcMock.mockResolvedValue({
      data: [
        {
          used_bytes: 10,
          base_limit_bytes: 100,
          addon_limit_bytes: 0,
          total_limit_bytes: 100,
          remaining_bytes: 90,
          is_over_limit: false,
        },
      ],
      error: null,
    });
  });

  it("refreshes all active hook instances when a shared quota refresh is requested", async () => {
    renderHook(() => useMediaStorageQuotaSummary({ enabled: true }));
    renderHook(() => useMediaStorageQuotaSummary({ enabled: true }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    act(() => {
      requestMediaStorageQuotaSummaryRefresh();
    });

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
  });

  it("primes the resolved protected-route session before loading the quota summary", async () => {
    const session = { access_token: "protected-token", user: { id: "user-1" } } as Session;
    const user = { id: "user-1", email: "user@example.com" } as User;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ProtectedRouteSessionProvider, { session, user }, children);

    renderHook(() => useMediaStorageQuotaSummary({ enabled: true }), { wrapper });

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("get_media_storage_quota_summary"));
    expect(primeSupabaseSessionMock).toHaveBeenCalledWith(session);
    expect(primeSupabaseSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      rpcMock.mock.invocationCallOrder[0]
    );
  });
});

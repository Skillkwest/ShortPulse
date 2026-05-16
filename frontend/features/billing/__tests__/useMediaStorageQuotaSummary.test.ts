import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestMediaStorageQuotaSummaryRefresh,
  useMediaStorageQuotaSummary,
} from "../useMediaStorageQuotaSummary";

const rpcMock = vi.fn();
const useSupabaseSessionStateMock = vi.fn();

vi.mock("../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
  useSupabaseSessionState: () => useSupabaseSessionStateMock(),
}));

describe("useMediaStorageQuotaSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

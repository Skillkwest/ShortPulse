import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterQuickSwapTipPreference } from "../useCharacterQuickSwapTipPreference";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);

type SupabaseMockInput = {
  userId: string | null;
  storedPreference: { ai_studio_character_quickswap_tip_hidden: boolean } | null;
};

const createSupabaseMock = ({ userId, storedPreference }: SupabaseMockInput) => {
  const getSession = vi.fn(async () => ({
    data: { session: userId ? { user: { id: userId } } : null },
    error: null,
  }));
  const maybeSingle = vi.fn(async () => ({ data: storedPreference, error: null }));
  type SelectQuery = {
    eq: (column: string, value: string) => SelectQuery;
    maybeSingle: typeof maybeSingle;
  };
  const selectQuery: SelectQuery = {
    eq: vi.fn(() => selectQuery),
    maybeSingle,
  };
  const upsert = vi.fn(async () => ({ error: null }));
  const select = vi.fn(() => selectQuery);
  const from = vi.fn(() => ({
    select,
    upsert,
  }));
  ensureSupabaseClientMock.mockReturnValue({
    auth: { getSession },
    from,
  } as unknown as ReturnType<typeof ensureSupabaseClient>);
  return { getSession, maybeSingle, upsert, from };
};

describe("useCharacterQuickSwapTipPreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("does not inherit legacy unscoped local tip state for authenticated users", async () => {
    window.localStorage.setItem("shortpulse.character_manager.quickswap_tip_hidden", "true");
    createSupabaseMock({
      userId: "user-a",
      storedPreference: { ai_studio_character_quickswap_tip_hidden: false },
    });

    const { result } = renderHook(() => useCharacterQuickSwapTipPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
      expect(result.current.isQuickSwapTipHidden).toBe(false);
    });
  });

  it("writes scoped local state and remote preference when hiding the tip", async () => {
    const { upsert } = createSupabaseMock({
      userId: "user-a",
      storedPreference: { ai_studio_character_quickswap_tip_hidden: false },
    });
    const { result } = renderHook(() => useCharacterQuickSwapTipPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isQuickSwapTipHidden).toBe(false);
    });

    await act(async () => {
      const ok = await result.current.markQuickSwapTipHidden();
      expect(ok).toBe(true);
    });

    expect(result.current.isQuickSwapTipHidden).toBe(true);
    expect(
      window.localStorage.getItem("shortpulse.character_manager.quickswap_tip_hidden.v2:user-a")
    ).toBe("true");
    expect(
      window.localStorage.getItem("shortpulse.character_manager.quickswap_tip_hidden")
    ).toBeNull();
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-a", ai_studio_character_quickswap_tip_hidden: true },
      { onConflict: "user_id" }
    );
  });

  it("keeps tip visibility isolated across account switches", async () => {
    createSupabaseMock({
      userId: "user-a",
      storedPreference: { ai_studio_character_quickswap_tip_hidden: false },
    });
    const firstMount = renderHook(() => useCharacterQuickSwapTipPreference());

    await waitFor(() => {
      expect(firstMount.result.current.loading).toBe(false);
    });
    await act(async () => {
      await firstMount.result.current.markQuickSwapTipHidden();
    });
    firstMount.unmount();

    createSupabaseMock({
      userId: "user-b",
      storedPreference: { ai_studio_character_quickswap_tip_hidden: false },
    });
    const secondMount = renderHook(() => useCharacterQuickSwapTipPreference());

    await waitFor(() => {
      expect(secondMount.result.current.loading).toBe(false);
      expect(secondMount.result.current.isQuickSwapTipHidden).toBe(false);
    });
    expect(
      window.localStorage.getItem("shortpulse.character_manager.quickswap_tip_hidden.v2:user-a")
    ).toBe("true");
    expect(
      window.localStorage.getItem("shortpulse.character_manager.quickswap_tip_hidden.v2:user-b")
    ).toBe("false");
  });
});

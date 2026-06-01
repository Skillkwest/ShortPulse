/**
 * Regression tests for authenticated credit loading.
 * Verifies account-visible balances stay snapshot-backed, user-scoped, and safe under failures.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { resetUseCreditsTestState, useCredits } from "../useCredits";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";

vi.mock("../../../../lib/supabaseClient", async () => {
  const actual = await vi.importActual("../../../../lib/supabaseClient");
  return {
    ...actual,
    ensureSupabaseQueryClient: vi.fn(),
    useSupabaseSessionState: vi.fn(),
  };
});

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const useSupabaseSessionStateMock = vi.mocked(useSupabaseSessionState);

const createSessionState = (userId: string | null) => ({
  initialized: true,
  session: userId
    ? ({
        access_token: `token-${userId}`,
        user: { id: userId } as User,
      } as Session)
    : null,
  user: userId ? ({ id: userId } as User) : null,
});

describe("useCredits", () => {
  let sessionState: ReturnType<typeof createSessionState>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetUseCreditsTestState();
    sessionState = createSessionState("user-123");
    useSupabaseSessionStateMock.mockImplementation(() => sessionState);
  });

  it("loads spendable balance from the authenticated snapshot API without browser balance fallbacks", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });

    expect(result.current.balanceCents).toBe(900);
    expect(result.current.balanceReservedCents).toBe(120);
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
    expect(useSupabaseSessionStateMock).toHaveBeenCalled();
  });

  it("preserves the last known good spendable balance when snapshot refresh fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(900);
    expect(result.current.balanceReservedCents).toBe(120);

    fetchWithAuthMock.mockRejectedValueOnce(new Error("snapshot unavailable"));

    await act(async () => {
      const refreshed = await result.current.refreshBalance({ silent: true });
      expect(refreshed).toBeNull();
    });

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(900);
    expect(result.current.balanceReservedCents).toBe(120);
    expect(result.current.balanceError).toBe("Unable to load spendable credit snapshot.");
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
  });

  it("hides the previous user's balance and reloads when the authenticated user changes", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 900,
          reservedCents: 120,
          updatedAt: "2026-02-15T20:00:00.000Z",
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 450,
          reservedCents: 30,
          updatedAt: "2026-02-16T20:00:00.000Z",
        }),
      } as unknown as Response);

    const { result, rerender } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(900);

    sessionState = createSessionState("user-456");
    rerender();

    expect(result.current.balanceCents).toBeNull();
    expect(result.current.balanceReservedCents).toBeNull();
    expect(result.current.balanceLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(450);
    expect(result.current.balanceReservedCents).toBe(30);
  });

  it("uses the explicit legacy fallback only when preferLedger is requested", async () => {
    let ledgerQueryCount = 0;

    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        spendableCents: 980,
        reservedCents: 20,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: (table: string) => {
        if (table !== "ai_credit_ledger") {
          throw new Error(`Unexpected table query: ${table}`);
        }

        return {
          select: () => ({
            eq: () => ({
              order: async () => {
                ledgerQueryCount += 1;
                return {
                  data: [{ change_cents: 640, created_at: "2026-02-15T20:30:00.000Z" }],
                  error: null,
                };
              },
            }),
          }),
        };
      },
    } as never);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(980);
    expect(result.current.balanceReservedCents).toBe(20);
    const snapshotCallCountBeforePreferLedgerRefresh = fetchWithAuthMock.mock.calls.length;

    await act(async () => {
      const refreshed = await result.current.refreshBalance({
        silent: true,
        preferLedger: true,
        beforeCommit: (snapshot) => {
          expect(snapshot.source).toBe("fallback");
        },
      });
      expect(refreshed).toBe(640);
    });

    expect(ledgerQueryCount).toBe(1);
    expect(result.current.balanceCents).toBe(640);
    expect(result.current.balanceReservedCents).toBeNull();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(snapshotCallCountBeforePreferLedgerRefresh);
  });

  it("dedupes overlapping credit snapshot refreshes into one authenticated request", async () => {
    let resolveSnapshot!: (value: Response) => void;
    fetchWithAuthMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve as (value: Response) => void;
        })
    );

    const first = renderHook(() => useCredits());
    const second = renderHook(() => useCredits());

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    resolveSnapshot({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    await waitFor(() => {
      expect(first.result.current.balanceLoading).toBe(false);
      expect(second.result.current.balanceLoading).toBe(false);
    });

    expect(first.result.current.balanceCents).toBe(900);
    expect(second.result.current.balanceCents).toBe(900);
    expect(first.result.current.balanceReservedCents).toBe(120);
    expect(second.result.current.balanceReservedCents).toBe(120);
  });
});

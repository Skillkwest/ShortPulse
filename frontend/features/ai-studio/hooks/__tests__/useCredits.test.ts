/**
 * Security regression tests for credit-balance loading.
 * Verifies credit reads remain user-scoped and never rely on unscoped balance queries.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetUseCreditsTestState, useCredits } from "../useCredits";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: vi.fn(),
  readSupabaseUserId: vi.fn(),
}));
vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);
const fetchWithAuthMock = vi.mocked(fetchWithAuth);

type QueryError = {
  message: string;
};

const asError = (message: string): QueryError => ({ message });

describe("useCredits isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUseCreditsTestState();
    fetchWithAuthMock.mockRejectedValue(new Error("snapshot unavailable"));
    readSupabaseUserIdMock.mockResolvedValue("user-123");
  });

  it("loads balance via user-scoped ai_credit_balance queries", async () => {
    const balanceFilters: Array<{ column: string; value: string; select: string }> = [];

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: (table: string) => {
        if (table !== "ai_credit_balance") {
          throw new Error(`Unexpected table query: ${table}`);
        }

        return {
          select: (select: string) => ({
            eq: (column: string, value: string) => ({
              limit: () => ({
                maybeSingle: async () => {
                  balanceFilters.push({ column, value, select });
                  if (select.includes("updated_at")) {
                    return {
                      data: null,
                      error: asError('column "updated_at" does not exist'),
                    };
                  }
                  return { data: { balance_cents: 1250 }, error: null };
                },
              }),
            }),
          }),
        };
      },
    } as never);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });

    expect(result.current.balanceCents).toBe(1250);
    expect(result.current.balanceReservedCents).toBeNull();
    expect(balanceFilters.length).toBeGreaterThan(0);
    for (const filter of balanceFilters) {
      expect(filter.column).toBe("user_id");
      expect(filter.value).toBe("user-123");
    }
  });

  it("falls back to user-scoped ledger reads when balance table is incompatible", async () => {
    const ledgerFilters: Array<{ column: string; value: string }> = [];

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: asError('column "user_id" does not exist'),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "ai_credit_ledger") {
          return {
            select: () => ({
              eq: (column: string, value: string) => ({
                order: async () => {
                  ledgerFilters.push({ column, value });
                  return {
                    data: [
                      { change_cents: 700, created_at: "2026-02-01T00:00:00.000Z" },
                      { change_cents: -200, created_at: "2026-01-31T00:00:00.000Z" },
                    ],
                    error: null,
                  };
                },
              }),
            }),
          };
        }

        throw new Error(`Unexpected table query: ${table}`);
      },
    } as never);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });

    expect(result.current.balanceCents).toBe(500);
    expect(result.current.balanceReservedCents).toBeNull();
    expect(ledgerFilters.length).toBeGreaterThan(0);
    for (const filter of ledgerFilters) {
      expect(filter.column).toBe("user_id");
      expect(filter.value).toBe("user-123");
    }
  });

  it("prefers credits snapshot and clears stale reserved holds on fallback refresh", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { balance_cents: 750, updated_at: "2026-02-15T20:10:00.000Z" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "ai_credit_ledger") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ change_cents: 750, created_at: "2026-02-15T20:10:00.000Z" }],
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table query: ${table}`);
      },
    } as never);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(900);
    expect(result.current.balanceReservedCents).toBe(120);

    fetchWithAuthMock.mockRejectedValueOnce(new Error("snapshot timeout"));
    await act(async () => {
      await result.current.refreshBalance({ silent: true });
    });

    await waitFor(() => {
      expect(result.current.balanceCents).toBe(750);
    });
    expect(result.current.balanceReservedCents).toBeNull();
  });

  it("bypasses snapshot reads when preferLedger is requested", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        spendableCents: 980,
        reservedCents: 20,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { balance_cents: 1000, updated_at: "2026-02-15T20:00:00.000Z" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "ai_credit_ledger") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ change_cents: 640, created_at: "2026-02-15T20:30:00.000Z" }],
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table query: ${table}`);
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
      await result.current.refreshBalance({ silent: true, preferLedger: true });
    });

    expect(result.current.balanceCents).toBe(640);
    expect(result.current.balanceReservedCents).toBeNull();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(snapshotCallCountBeforePreferLedgerRefresh);
  });

  it("retries the snapshot API after a transient backoff window instead of disabling it permanently", async () => {
    let now = 1_000;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "temporary outage" }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 820,
          reservedCents: 45,
          updatedAt: "2026-02-15T21:00:00.000Z",
        }),
      } as unknown as Response);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { balance_cents: 700, updated_at: "2026-02-15T20:30:00.000Z" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "ai_credit_ledger") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ change_cents: 700, created_at: "2026-02-15T20:30:00.000Z" }],
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table query: ${table}`);
      },
    } as never);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(700);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refreshBalance({ silent: true });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(result.current.balanceCents).toBe(700);

    now += 31_000;
    await act(async () => {
      await result.current.refreshBalance({ silent: true });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(result.current.balanceCents).toBe(820);
    expect(result.current.balanceReservedCents).toBe(45);

    nowSpy.mockRestore();
  });
});

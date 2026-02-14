/**
 * Security regression tests for credit-balance loading.
 * Verifies credit reads remain user-scoped and never rely on unscoped balance queries.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCredits } from "../useCredits";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);

type QueryError = {
  message: string;
};

const asError = (message: string): QueryError => ({ message });

describe("useCredits isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads balance via user-scoped ai_credit_balance queries", async () => {
    const balanceFilters: Array<{ column: string; value: string; select: string }> = [];

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-123" } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-123" } },
          error: null,
        })),
      },
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
    expect(balanceFilters.length).toBeGreaterThan(0);
    for (const filter of balanceFilters) {
      expect(filter.column).toBe("user_id");
      expect(filter.value).toBe("user-123");
    }
  });

  it("falls back to user-scoped ledger reads when balance table is incompatible", async () => {
    const ledgerFilters: Array<{ column: string; value: string }> = [];

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-123" } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-123" } },
          error: null,
        })),
      },
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
    expect(ledgerFilters.length).toBeGreaterThan(0);
    for (const filter of ledgerFilters) {
      expect(filter.column).toBe("user_id");
      expect(filter.value).toBe("user-123");
    }
  });
});

/**
 * Regression tests for the shared single-account health snapshot loader.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminHealthSnapshot } from "../../lib/server/adminUserHealth/snapshot";

const getSupabaseAdminMock = vi.fn();
const resolveAdminHealthAuthUserMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

vi.mock("../../lib/server/adminUserHealth/targetLookup", () => ({
  resolveAdminHealthAuthUser: (...args: unknown[]) => resolveAdminHealthAuthUserMock(...args),
}));

const buildQuery = (payload: { data: unknown; error: unknown | null }) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(async () => payload);
  chain.limit = vi.fn(async () => payload);
  return chain;
};

describe("loadAdminHealthSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminHealthAuthUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      created_at: "2026-03-01T00:00:00.000Z",
      last_sign_in_at: "2026-03-15T00:00:00.000Z",
    });

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return buildQuery({
            data: [
              {
                user_id: "user-1",
                balance_cents: 500,
                updated_at: "2026-03-17T11:55:00.000Z",
              },
            ],
            error: null,
          });
        }
        if (table === "ai_generations") {
          return buildQuery({
            data: [
              {
                id: "gen-1",
                status: "success",
                recovery_state: null,
                provider: "fal",
                model_id: "model-1",
                request_id: "req-1",
                created_at: "2026-03-17T10:00:00.000Z",
                completed_at: "2026-03-17T10:05:00.000Z",
                failure_reason_code: null,
                next_recovery_at: null,
              },
            ],
            error: null,
          });
        }
        if (table === "ai_credit_reservations") {
          return buildQuery({ data: [], error: null });
        }
        if (table === "ai_generation_submit_queue") {
          return buildQuery({ data: [], error: null });
        }
        if (table === "ai_credit_ledger") {
          return buildQuery({ data: [], error: null });
        }
        if (table === "generation_attempts") {
          return buildQuery({
            data: [
              {
                id: "attempt-1",
                generation_id: "gen-1",
                provider_request_id: "req-1",
                status: "success",
                created_at: "2026-03-17T10:01:00.000Z",
              },
            ],
            error: null,
          });
        }
        if (table === "ai_generation_outputs") {
          return buildQuery({
            data: [
              {
                id: "output-1",
                generation_id: "gen-1",
                media_file_id: "media-1",
                created_at: "2026-03-17T10:06:00.000Z",
              },
            ],
            error: null,
          });
        }
        throw new Error(`unexpected table ${table}`);
      },
    });
  });

  it("loads a healthy account snapshot through the shared read path", async () => {
    const result = await loadAdminHealthSnapshot({
      lookup: "user@example.com",
      lookupMode: "email",
      lookbackDays: 30,
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(resolveAdminHealthAuthUserMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      lookup: "user@example.com",
      lookupMode: "email",
    });
    expect(result.target).toEqual(
      expect.objectContaining({
        userId: "user-1",
        email: "user@example.com",
      })
    );
    expect(result.credits).toEqual(
      expect.objectContaining({
        availableCents: 500,
        reservedCents: 0,
        spendableCents: 500,
      })
    );
    expect(result.generations).toEqual(expect.objectContaining({ total: 1 }));
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "HEALTHY_BASELINE" })])
    );
    expect(result.compatibility.warnings).toEqual([]);
  });
});

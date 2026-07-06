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
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            spendable_cents: 500,
            reserved_cents: 0,
            expiring_cents: 500,
            non_expiring_cents: 0,
            next_expiring_cents: 500,
            next_expires_at: "2026-05-16T12:00:00.000Z",
          },
        ],
        error: null,
      }),
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
        if (table === "project_generation_items") {
          return buildQuery({ data: [], error: null });
        }
        if (table === "generation_projection") {
          return buildQuery({
            data: [
              {
                project_id: "project-1",
                generation_id: "gen-1",
                user_id: "user-1",
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

  it("uses credit grant summary spendability when grant lots are available", async () => {
    const baseClient = getSupabaseAdminMock();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          spendable_cents: 300,
          reserved_cents: 50,
          expiring_cents: 300,
          non_expiring_cents: 0,
          next_expiring_cents: 300,
          next_expires_at: "2026-05-16T12:00:00.000Z",
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      ...baseClient,
      rpc,
      from: (table: string) => {
        if (table === "ai_credit_reservations") {
          return buildQuery({
            data: [
              {
                id: "reservation-1",
                status: "reserved",
                source_ref: "source-ref-1",
                provider_request_id: null,
                model_id: "model-1",
                amount_cents: 400,
                metadata: null,
                created_at: "2026-03-17T11:00:00.000Z",
                released_at: null,
                captured_at: null,
              },
            ],
            error: null,
          });
        }
        return baseClient.from(table);
      },
    });

    const result = await loadAdminHealthSnapshot({
      lookup: "user@example.com",
      lookupMode: "email",
      lookbackDays: 30,
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.credits).toEqual(
      expect.objectContaining({
        availableCents: 500,
        reservedCents: 50,
        spendableCents: 300,
      })
    );
    expect(rpc).toHaveBeenCalledWith("get_credit_grant_summary", {
      p_user_id: "user-1",
    });
  });

  it("fails closed when the grant summary RPC returns no row for the requested user", async () => {
    const baseClient = getSupabaseAdminMock();
    getSupabaseAdminMock.mockReturnValue({
      ...baseClient,
      rpc: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    await expect(
      loadAdminHealthSnapshot({
        lookup: "user@example.com",
        lookupMode: "email",
        lookbackDays: 30,
        nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
      })
    ).rejects.toThrow("Credit grant summary missing for requested user.");
  });
});

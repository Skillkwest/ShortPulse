import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/credits/snapshot";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/credits/snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns a safe snapshot failure when auth verification throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "credits/snapshot.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load credit snapshot.",
    });
  });

  it("returns grant-lot authoritative reserved and spendable credits", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            spendable_cents: 1170,
            reserved_cents: 30,
            expiring_cents: 670,
            non_expiring_cents: 500,
            next_expiring_cents: 300,
            next_expires_at: "2026-04-15T20:00:00.000Z",
          },
        ],
        error: null,
      }),
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { balance_cents: 1200, updated_at: "2026-02-15T20:00:00.000Z" },
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: "user-1",
      availableCents: 1200,
      reservedCents: 30,
      spendableCents: 1170,
      balanceUpdatedAt: "2026-02-15T20:00:00.000Z",
      reservationsUpdatedAt: null,
      updatedAt: "2026-02-15T20:00:00.000Z",
      reservationsSupported: true,
      grantsSupported: true,
      expiringCents: 670,
      nonExpiringCents: 500,
      nextExpiringCents: 300,
      nextExpiresAt: "2026-04-15T20:00:00.000Z",
      source: "balance_table",
    });
  });

  it("uses grant-lot summary fields when supported", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            spendable_cents: 900,
            reserved_cents: 75,
            expiring_cents: 400,
            non_expiring_cents: 500,
            next_expiring_cents: 125,
            next_expires_at: "2026-04-15T20:00:00.000Z",
          },
        ],
        error: null,
      }),
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { balance_cents: 975, updated_at: "2026-02-15T20:00:00.000Z" },
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        availableCents: 975,
        reservedCents: 75,
        spendableCents: 900,
        expiringCents: 400,
        nonExpiringCents: 500,
        nextExpiringCents: 125,
        nextExpiresAt: "2026-04-15T20:00:00.000Z",
        grantsSupported: true,
      })
    );
  });

  it("fails closed when the grant-lot summary RPC is unavailable", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "function get_credit_grant_summary does not exist" },
      }),
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { message: 'column "balance_cents" does not exist' },
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load credit snapshot.",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the balance projection is unavailable", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            spendable_cents: 900,
            reserved_cents: 0,
            expiring_cents: 900,
            non_expiring_cents: 0,
            next_expiring_cents: 900,
            next_expires_at: "2026-04-15T20:00:00.000Z",
          },
        ],
        error: null,
      }),
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { message: 'column "balance_cents" does not exist' },
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load credit snapshot.",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("clamps negative grant-summary values to zero", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            spendable_cents: -25,
            reserved_cents: -10,
            expiring_cents: 0,
            non_expiring_cents: 0,
            next_expiring_cents: 0,
            next_expires_at: null,
          },
        ],
        error: null,
      }),
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { balance_cents: 80, updated_at: "2026-02-17T01:00:00.000Z" },
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: "user-1",
      availableCents: 80,
      reservedCents: 0,
      spendableCents: 0,
      balanceUpdatedAt: "2026-02-17T01:00:00.000Z",
      reservationsUpdatedAt: null,
      updatedAt: "2026-02-17T01:00:00.000Z",
      reservationsSupported: true,
      grantsSupported: true,
      expiringCents: 0,
      nonExpiringCents: 0,
      nextExpiringCents: 0,
      nextExpiresAt: null,
      source: "balance_table",
    });
  });

  it("scopes balance reads and grant-summary RPCs to the authenticated user id", async () => {
    const userFilters: Array<{ table: string; column: string; value: string }> = [];
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          spendable_cents: 1200,
          reserved_cents: 0,
          expiring_cents: 1200,
          non_expiring_cents: 0,
          next_expiring_cents: 1200,
          next_expires_at: "2026-04-15T20:00:00.000Z",
        },
      ],
      error: null,
    });

    getSupabaseAdminMock.mockReturnValue({
      rpc,
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: (column: string, value: string) => {
                userFilters.push({ table, column, value });
                return {
                  maybeSingle: async () => ({
                    data: { balance_cents: 1200, updated_at: "2026-02-15T20:00:00.000Z" },
                    error: null,
                  }),
                };
              },
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(userFilters).toContainEqual({
      table: "ai_credit_balance",
      column: "user_id",
      value: "user-1",
    });
    expect(rpc).toHaveBeenCalledWith("get_credit_grant_summary", {
      p_user_id: "user-1",
    });
  });
});

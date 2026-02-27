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

type SelectResult = {
  data: unknown;
  error: { message: string } | null;
};

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

  it("returns available, reserved, and spendable credits", async () => {
    getSupabaseAdminMock.mockReturnValue({
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

        if (table === "ai_credit_reservations") {
          const chain = {
            eq: vi.fn(),
            order: vi.fn(
              async () =>
                ({
                  data: [
                    { amount_cents: 25, updated_at: "2026-02-15T20:00:10.000Z" },
                    { amount_cents: 5, updated_at: "2026-02-15T19:59:10.000Z" },
                  ],
                  error: null,
                }) as SelectResult
            ),
          };
          chain.eq.mockReturnValue(chain);
          return { select: () => chain };
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
      reservationsUpdatedAt: "2026-02-15T20:00:10.000Z",
      updatedAt: "2026-02-15T20:00:10.000Z",
      reservationsSupported: true,
      source: "balance_table",
    });
  });

  it("falls back to ledger and marks reservations unsupported when schemas are missing", async () => {
    getSupabaseAdminMock.mockReturnValue({
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

        if (table === "ai_credit_ledger") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    { change_cents: 300, created_at: "2026-02-15T20:00:00.000Z" },
                    { change_cents: -50, created_at: "2026-02-15T19:00:00.000Z" },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "ai_credit_reservations") {
          const chain = {
            eq: vi.fn(),
            order: vi.fn(
              async () =>
                ({
                  data: null,
                  error: { message: "relation ai_credit_reservations does not exist" },
                }) as SelectResult
            ),
          };
          chain.eq.mockReturnValue(chain);
          return { select: () => chain };
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
      availableCents: 250,
      reservedCents: 0,
      spendableCents: 250,
      balanceUpdatedAt: "2026-02-15T20:00:00.000Z",
      reservationsUpdatedAt: null,
      updatedAt: "2026-02-15T20:00:00.000Z",
      reservationsSupported: false,
      source: "ledger_fallback",
    });
  });

  it("degrades reservation support when reservation query returns an unexpected backend error", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { balance_cents: 900, updated_at: "2026-02-16T20:41:20.000Z" },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "ai_credit_reservations") {
          const chain = {
            eq: vi.fn(),
            order: vi.fn(
              async () =>
                ({
                  data: null,
                  error: { message: "Internal server error." },
                }) as SelectResult
            ),
          };
          chain.eq.mockReturnValue(chain);
          return { select: () => chain };
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
      availableCents: 900,
      reservedCents: 0,
      spendableCents: 900,
      balanceUpdatedAt: "2026-02-16T20:41:20.000Z",
      reservationsUpdatedAt: null,
      updatedAt: "2026-02-16T20:41:20.000Z",
      reservationsSupported: false,
      source: "balance_table",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("clamps spendable credits to zero when active reservations exceed available balance", async () => {
    getSupabaseAdminMock.mockReturnValue({
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

        if (table === "ai_credit_reservations") {
          const chain = {
            eq: vi.fn(),
            order: vi.fn(
              async () =>
                ({
                  data: [
                    { amount_cents: 60, updated_at: "2026-02-17T01:02:00.000Z" },
                    { amount_cents: -70, updated_at: "2026-02-17T01:01:00.000Z" },
                  ],
                  error: null,
                }) as SelectResult
            ),
          };
          chain.eq.mockReturnValue(chain);
          return { select: () => chain };
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
      reservedCents: 130,
      spendableCents: 0,
      balanceUpdatedAt: "2026-02-17T01:00:00.000Z",
      reservationsUpdatedAt: "2026-02-17T01:02:00.000Z",
      updatedAt: "2026-02-17T01:02:00.000Z",
      reservationsSupported: true,
      source: "balance_table",
    });
  });
});

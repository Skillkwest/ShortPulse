import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/users";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
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

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns empty users list when no users are present", async () => {
    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [], total: 0, nextPage: null },
            error: null,
          }),
        },
      },
    });

    const req = { method: "GET", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        users: [],
        pagination: expect.objectContaining({
          totalCount: 0,
        }),
      })
    );
  });

  it("returns spendable credits with reservation hold breakdown", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            email: "user-1@example.com",
            created_at: "2026-02-20T00:00:00.000Z",
          },
        ],
        total: 1,
        nextPage: null,
      },
      error: null,
    });

    const createInQuery = (rows: unknown[]) => ({
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    });

    const reservationsQuery = {
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: "user-1", amount_cents: 100 }],
          error: null,
        }),
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          listUsers,
        },
      },
      from: vi.fn((table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: vi
              .fn()
              .mockReturnValue(createInQuery([{ user_id: "user-1", balance_cents: 106 }])),
          };
        }
        if (table === "billing_profiles") {
          return {
            select: vi
              .fn()
              .mockReturnValue(
                createInQuery([
                  { user_id: "user-1", plan_id: "free", subscription_status: "active" },
                ])
              ),
          };
        }
        if (table === "ai_credit_reservations") {
          return {
            select: vi.fn().mockReturnValue(reservationsQuery),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const req = { method: "GET", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        users: [
          expect.objectContaining({
            id: "user-1",
            credits: 6,
            spendableCredits: 6,
            availableCredits: 106,
            reservedCredits: 100,
          }),
        ],
        reservationsSupported: true,
      })
    );
  });
});

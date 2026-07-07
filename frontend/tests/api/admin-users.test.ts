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

type ChainableQuery = {
  in: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise<unknown>;
};

const createChainableQuery = (rows: unknown[]) => {
  const query = {} as ChainableQuery;
  Object.assign(query, {
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    gt: vi.fn(() => query),
    lt: vi.fn(() => query),
    gte: vi.fn(() => query),
    is: vi.fn(() => query),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  });
  return query;
};

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

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = { method: "GET", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/users.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load admin users." });
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

    const contractsQuery = {
      in: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: "user-1",
              plan_id: "studio",
              offer_id: "studio__legacy_10",
              stripe_price_id: "price_legacy_studio",
              contract_source: "stripe",
              billing_interval: "year",
              recurring_price_cents: 1000,
              monthly_credits_cents: 4000,
              status: "active",
              current_period_start: "2026-02-01T00:00:00.000Z",
              current_period_end: "2026-03-01T00:00:00.000Z",
            },
          ],
          error: null,
        }),
      }),
    };

    const cycleSpendQuery = createChainableQuery([
      {
        user_id: "user-1",
        change_cents: -31,
        created_at: "2026-01-31T23:59:59.000Z",
      },
      {
        user_id: "user-1",
        change_cents: -42,
        created_at: "2026-02-10T00:00:00.000Z",
      },
      {
        user_id: "user-1",
        change_cents: -7,
        created_at: "2026-03-01T00:00:00.000Z",
      },
    ]);
    const topUpsQuery = createChainableQuery([
      { user_id: "user-1", change_cents: 2000 },
      { user_id: "user-1", change_cents: 500 },
    ]);
    const storageAddonsQuery = createChainableQuery([
      {
        user_id: "user-1",
        storage_limit_bytes: 10737418240,
        quantity: 1,
        recurring_price_cents: 500,
      },
    ]);
    let ledgerQueryCount = 0;

    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          spendable_cents: 75,
          reserved_cents: 25,
          expiring_cents: 75,
          non_expiring_cents: 0,
          next_expiring_cents: 75,
          next_expires_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          listUsers,
        },
      },
      rpc,
      from: vi.fn((table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: vi
              .fn()
              .mockReturnValue(createInQuery([{ user_id: "user-1", balance_cents: 106 }])),
          };
        }
        if (table === "billing_subscription_contracts") {
          return {
            select: vi.fn().mockReturnValue(contractsQuery),
          };
        }
        if (table === "billing_profiles") {
          return {
            select: vi.fn().mockReturnValue(
              createInQuery([
                {
                  user_id: "user-1",
                  plan_id: "free",
                  subscription_status: "active",
                  current_period_end: "2026-04-01T00:00:00.000Z",
                },
              ])
            ),
          };
        }
        if (table === "ai_credit_ledger") {
          return {
            select: vi.fn(() => {
              ledgerQueryCount += 1;
              return ledgerQueryCount === 1 ? topUpsQuery : cycleSpendQuery;
            }),
          };
        }
        if (table === "billing_subscription_storage_addons") {
          return {
            select: vi.fn().mockReturnValue(storageAddonsQuery),
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
            planId: "studio",
            offerId: "studio__legacy_10",
            stripePriceId: "price_legacy_studio",
            contractSource: "stripe",
            billingInterval: "year",
            recurringPriceCents: 1000,
            monthlyCreditsCents: 4000,
            billingSource: "subscription_contract",
            subscriptionStatus: "active",
            planRenewalAt: "2026-03-01T00:00:00.000Z",
            credits: 75,
            spendableCredits: 75,
            availableCredits: 106,
            reservedCredits: 25,
            currentCycleSpentCredits: 42,
            topUpPurchaseCount: 2,
            topUpCreditsPurchased: 2500,
            recurringStorageAddonBytes: 10737418240,
            recurringStorageAddonPriceCents: 500,
          }),
        ],
        reservationsSupported: true,
      })
    );
    expect(rpc).toHaveBeenCalledWith("get_credit_grant_summary", {
      p_user_id: "user-1",
    });
  });

  it("uses the bulk grant summary RPC for multi-user admin pages", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          { id: "user-1", email: "user-1@example.com", created_at: "2026-02-20T00:00:00.000Z" },
          { id: "user-2", email: "user-2@example.com", created_at: "2026-02-21T00:00:00.000Z" },
        ],
        total: 2,
        nextPage: null,
      },
      error: null,
    });
    const createInQuery = (rows: unknown[]) => ({
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { user_id: "user-1", spendable_cents: 75, reserved_cents: 25 },
        { user_id: "user-2", spendable_cents: 120, reserved_cents: 0 },
      ],
      error: null,
    });
    const topUpsQuery = createChainableQuery([
      { user_id: "user-1", change_cents: 1000 },
      { user_id: "user-2", change_cents: 2000 },
      { user_id: "user-2", change_cents: 3000 },
    ]);
    const cycleSpendQuery = createChainableQuery([
      {
        user_id: "user-1",
        change_cents: -33,
        created_at: "2026-02-05T00:00:00.000Z",
      },
      {
        user_id: "user-2",
        change_cents: -44,
        created_at: "2026-02-16T00:00:00.000Z",
      },
    ]);
    const storageAddonsQuery = createChainableQuery([
      {
        user_id: "user-1",
        storage_limit_bytes: 53687091200,
        quantity: 1,
        recurring_price_cents: 1500,
      },
      {
        user_id: "user-2",
        storage_limit_bytes: 107374182400,
        quantity: 1,
        recurring_price_cents: 2500,
      },
    ]);
    let ledgerQueryCount = 0;

    getSupabaseAdminMock.mockReturnValue({
      auth: { admin: { listUsers } },
      rpc,
      from: vi.fn((table: string) => {
        if (table === "ai_credit_balance") {
          return {
            select: vi.fn().mockReturnValue(
              createInQuery([
                { user_id: "user-1", balance_cents: 100 },
                { user_id: "user-2", balance_cents: 120 },
              ])
            ),
          };
        }
        if (table === "billing_subscription_contracts") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [
                    {
                      user_id: "user-1",
                      plan_id: "studio",
                      offer_id: null,
                      stripe_price_id: null,
                      contract_source: "stripe",
                      billing_interval: "month",
                      recurring_price_cents: 3000,
                      monthly_credits_cents: 6000,
                      status: "active",
                      current_period_start: "2026-02-01T00:00:00.000Z",
                      current_period_end: "2026-03-01T00:00:00.000Z",
                    },
                    {
                      user_id: "user-2",
                      plan_id: "business",
                      offer_id: null,
                      stripe_price_id: null,
                      contract_source: "stripe",
                      billing_interval: "month",
                      recurring_price_cents: 3000,
                      monthly_credits_cents: 10000,
                      status: "active",
                      current_period_start: "2026-02-15T00:00:00.000Z",
                      current_period_end: "2026-03-15T00:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "billing_profiles") {
          return {
            select: vi.fn().mockReturnValue(
              createInQuery([
                {
                  user_id: "user-1",
                  plan_id: "studio",
                  subscription_status: "active",
                  current_period_end: "2026-04-01T00:00:00.000Z",
                },
                {
                  user_id: "user-2",
                  plan_id: "business",
                  subscription_status: "active",
                  current_period_end: "2026-04-15T00:00:00.000Z",
                },
              ])
            ),
          };
        }
        if (table === "ai_credit_ledger") {
          return {
            select: vi.fn(() => {
              ledgerQueryCount += 1;
              return ledgerQueryCount === 1 ? topUpsQuery : cycleSpendQuery;
            }),
          };
        }
        if (table === "billing_subscription_storage_addons") {
          return {
            select: vi.fn().mockReturnValue(storageAddonsQuery),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const req = { method: "GET", query: { perPage: "50" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_credit_grant_summaries", {
      p_user_ids: ["user-1", "user-2"],
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        users: [
          expect.objectContaining({
            id: "user-1",
            spendableCredits: 75,
            reservedCredits: 25,
            currentCycleSpentCredits: 33,
            planRenewalAt: "2026-03-01T00:00:00.000Z",
            topUpPurchaseCount: 1,
            topUpCreditsPurchased: 1000,
            recurringStorageAddonBytes: 53687091200,
            recurringStorageAddonPriceCents: 1500,
          }),
          expect.objectContaining({
            id: "user-2",
            spendableCredits: 120,
            reservedCredits: 0,
            currentCycleSpentCredits: 44,
            planRenewalAt: "2026-03-15T00:00:00.000Z",
            topUpPurchaseCount: 2,
            topUpCreditsPurchased: 5000,
            recurringStorageAddonBytes: 107374182400,
            recurringStorageAddonPriceCents: 2500,
          }),
        ],
      })
    );
  });
});

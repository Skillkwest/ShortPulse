import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/billing-contract-renewals/run";

const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const grantAccountCreditsMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/creditLedger", () => ({
  grantAccountCredits: (...args: unknown[]) => grantAccountCreditsMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/internal/billing-contract-renewals/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));
    process.env.SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED = "true";
    process.env.SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET = "secret";
    grantAccountCreditsMock.mockResolvedValue({ error: null, mode: "rich" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "GET", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns not found when renewals are disabled", async () => {
    process.env.SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED = "false";
    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });

  it("requires cron-secret auth", async () => {
    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("renews a due internal comp contract and advances the period", async () => {
    const contractUpdate = vi.fn();
    contractUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const profileUpsert = vi.fn().mockResolvedValue({ error: null });
    const dueContractsResult = {
      data: [
        {
          id: "contract-1",
          user_id: "user-1",
          plan_id: "business",
          stripe_customer_id: "cus_123",
          monthly_credits_cents: 8000,
          current_period_start: "2026-03-01T00:00:00.000Z",
          current_period_end: "2026-04-01T00:00:00.000Z",
          status: "active",
          contract_source: "internal_comp",
        },
      ],
      error: null,
    };
    const emptyAnnualResult = { data: [], error: null };
    const annualAfterIsResult = {
      not: vi.fn().mockReturnValue({
        lte: () => ({
          order: () => ({
            limit: async () => emptyAnnualResult,
          }),
        }),
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "billing_subscription_contracts") {
          const annualQueryResult = {
            is: vi.fn().mockReturnValue(annualAfterIsResult),
          };
          const dueQueryResult = {
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(dueContractsResult),
            }),
          };
          const secondEqResult = {
            eq: vi.fn().mockReturnValue(annualQueryResult),
            is: vi.fn().mockReturnValue(dueQueryResult),
          };
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(secondEqResult),
              }),
            }),
            update: contractUpdate,
          };
        }
        if (table === "billing_profiles") {
          return {
            upsert: profileUpsert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "secret",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        amountCents: 8000,
        source: "internal_contract_renewal",
        creditKind: "subscription_allocation",
        expiresAt: "2026-06-01T00:00:00.000Z",
      })
    );
    expect(contractUpdate).toHaveBeenCalled();
    expect(profileUpsert).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        dueContracts: 1,
        advancedContracts: 1,
        grantsInserted: 1,
      })
    );
  });

  it("treats duplicate renewal grants as safe and still advances the period", async () => {
    grantAccountCreditsMock.mockResolvedValue({
      error: null,
      mode: "rich",
      status: "duplicate",
    });

    const contractUpdate = vi.fn();
    contractUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const dueContractsResult = {
      data: [
        {
          id: "contract-1",
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: null,
          monthly_credits_cents: 3000,
          current_period_start: "2026-03-01T00:00:00.000Z",
          current_period_end: "2026-04-01T00:00:00.000Z",
          status: "active",
          contract_source: "internal_comp",
        },
      ],
      error: null,
    };
    const emptyAnnualResult = { data: [], error: null };
    const annualAfterIsResult = {
      not: vi.fn().mockReturnValue({
        lte: () => ({
          order: () => ({
            limit: async () => emptyAnnualResult,
          }),
        }),
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "billing_subscription_contracts") {
          const annualQueryResult = {
            is: vi.fn().mockReturnValue(annualAfterIsResult),
          };
          const dueQueryResult = {
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(dueContractsResult),
            }),
          };
          const secondEqResult = {
            eq: vi.fn().mockReturnValue(annualQueryResult),
            is: vi.fn().mockReturnValue(dueQueryResult),
          };
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(secondEqResult),
              }),
            }),
            update: contractUpdate,
          };
        }
        if (table === "billing_profiles") {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const req = {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(contractUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        duplicateGrants: 1,
        grantsInserted: 0,
        advancedContracts: 1,
      })
    );
  });

  it("allocates monthly credits for due annual Stripe contracts and advances the cursor", async () => {
    const contractUpdate = vi.fn();
    contractUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const emptyDueContractsResult = {
      data: [],
      error: null,
    };
    const dueQueryResult = {
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(emptyDueContractsResult),
      }),
    };
    const annualContractsResult = {
      data: [
        {
          id: "annual-contract-1",
          user_id: "user-annual",
          plan_id: "studio",
          stripe_customer_id: "cus_annual",
          monthly_credits_cents: 3000,
          billing_interval: "year",
          current_period_start: "2026-03-01T00:00:00.000Z",
          current_period_end: "2027-03-01T00:00:00.000Z",
          last_credit_grant_at: "2026-03-01T00:00:00.000Z",
          next_credit_grant_at: "2026-04-01T00:00:00.000Z",
          status: "active",
          contract_source: "stripe",
        },
      ],
      error: null,
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "billing_subscription_contracts") {
          const annualQueryResult = {
            is: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                lte: () => ({
                  order: () => ({
                    limit: async () => annualContractsResult,
                  }),
                }),
              }),
            }),
          };
          const secondEqResult = {
            eq: vi.fn().mockReturnValue(annualQueryResult),
            is: vi.fn().mockReturnValue(dueQueryResult),
          };
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(secondEqResult),
              }),
            }),
            update: contractUpdate,
          };
        }
        if (table === "billing_profiles") {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const req = {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-annual",
        amountCents: 3000,
        source: "annual_contract_monthly_allocation",
        creditKind: "subscription_allocation",
        expiresAt: "2026-06-01T00:00:00.000Z",
      })
    );
    expect(contractUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        last_credit_grant_at: "2026-04-01T00:00:00.000Z",
        next_credit_grant_at: "2026-05-01T00:00:00.000Z",
        updated_by_user_id: null,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        scannedContracts: 0,
        scannedAnnualContracts: 1,
        annualDueContracts: 1,
        annualAdvancedContracts: 1,
        grantsInserted: 1,
      })
    );
  });
});

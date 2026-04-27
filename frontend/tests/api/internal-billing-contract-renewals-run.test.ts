import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/billing-contract-renewals/run";

const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const insertCreditLedgerEntryMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/creditLedger", () => ({
  insertCreditLedgerEntry: (...args: unknown[]) => insertCreditLedgerEntryMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/internal/billing-contract-renewals/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED = "true";
    process.env.SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET = "secret";
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null, mode: "rich" });
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
          monthly_credits_cents: 12000,
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

    expect(insertCreditLedgerEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        changeCents: 12000,
        source: "internal_contract_renewal",
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
    insertCreditLedgerEntryMock.mockResolvedValue({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
      mode: "rich",
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
        advancedContracts: 1,
      })
    );
  });
});

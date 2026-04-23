import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/billing/contracts/update";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const insertCreditLedgerEntryMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

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

describe("POST /api/admin/billing/contracts/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null, mode: "rich" });
  });

  it("grants internal comp access and seeds the current period credits", async () => {
    const profileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: "user-1",
            plan_id: "free",
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_status: "inactive",
            current_period_end: null,
          },
          error: null,
        }),
      }),
    };
    const contractQuery = {
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const offerQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "business__internal_comp",
            plan_id: "business",
            recurring_price_cents: 0,
            monthly_credits_cents: 12000,
          },
          error: null,
        }),
      }),
    };
    const contractsInsert = vi.fn().mockResolvedValue({ error: null });
    const billingProfilesUpsert = vi.fn().mockResolvedValue({ error: null });

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1", email: "user@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "billing_profiles") {
          return {
            select: vi.fn().mockReturnValue(profileQuery),
            upsert: billingProfilesUpsert,
          };
        }
        if (table === "billing_subscription_contracts") {
          return {
            select: vi.fn().mockReturnValue(contractQuery),
            insert: contractsInsert,
          };
        }
        if (table === "billing_plan_offers") {
          return {
            select: vi.fn().mockReturnValue(offerQuery),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const req = {
      method: "POST",
      body: {
        userId: "user-1",
        action: "grant_internal_comp",
        planId: "business",
        grantReason: "Internal QA",
        allowStripeTakeover: false,
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(contractsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        plan_id: "business",
        offer_id: "business__internal_comp",
        contract_source: "internal_comp",
        recurring_price_cents: 0,
        monthly_credits_cents: 12000,
      })
    );
    expect(insertCreditLedgerEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        changeCents: 12000,
        source: "internal_contract_initial",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        action: "granted_internal_comp",
        planId: "business",
        creditsGrantedCents: 12000,
      })
    );
  });

  it("revokes internal comp access back to free", async () => {
    const profileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: "user-1",
            plan_id: "business",
            stripe_customer_id: "cus_123",
            stripe_subscription_id: null,
            subscription_status: "active",
            current_period_end: "2026-05-01T00:00:00.000Z",
          },
          error: null,
        }),
      }),
    };
    const contractUpdate = vi.fn().mockResolvedValue({ error: null });
    const contractQuery = {
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "contract-1",
                  plan_id: "business",
                  offer_id: "business__internal_comp",
                  stripe_customer_id: "cus_123",
                  stripe_subscription_id: null,
                  recurring_price_cents: 0,
                  monthly_credits_cents: 12000,
                  status: "active",
                  current_period_start: "2026-04-01T00:00:00.000Z",
                  current_period_end: "2026-05-01T00:00:00.000Z",
                  contract_source: "internal_comp",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const billingProfilesUpsert = vi.fn().mockResolvedValue({ error: null });

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1", email: "user@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "billing_profiles") {
          return {
            select: vi.fn().mockReturnValue(profileQuery),
            upsert: billingProfilesUpsert,
          };
        }
        if (table === "billing_subscription_contracts") {
          return {
            select: vi.fn().mockReturnValue(contractQuery),
            update: contractUpdate,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });
    contractUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = {
      method: "POST",
      body: {
        userId: "user-1",
        action: "revoke_internal_comp",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        action: "revoked_internal_comp",
        planId: "free",
      })
    );
  });

  it("requires explicit takeover confirmation before clearing a Stripe-linked account", async () => {
    const profileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: "user-1",
            plan_id: "business",
            stripe_customer_id: "cus_123",
            stripe_subscription_id: "sub_123",
            subscription_status: "active",
            current_period_end: "2026-05-01T00:00:00.000Z",
          },
          error: null,
        }),
      }),
    };
    const contractQuery = {
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "contract-1",
                  plan_id: "business",
                  offer_id: "business__current",
                  stripe_customer_id: "cus_123",
                  stripe_subscription_id: "sub_123",
                  recurring_price_cents: 12900,
                  monthly_credits_cents: 12000,
                  status: "active",
                  current_period_start: "2026-04-01T00:00:00.000Z",
                  current_period_end: "2026-05-01T00:00:00.000Z",
                  contract_source: "stripe",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1", email: "user@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "billing_profiles") {
          return {
            select: vi.fn().mockReturnValue(profileQuery),
          };
        }
        if (table === "billing_subscription_contracts") {
          return {
            select: vi.fn().mockReturnValue(contractQuery),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const req = {
      method: "POST",
      body: {
        userId: "user-1",
        action: "grant_internal_comp",
        planId: "business",
        allowStripeTakeover: false,
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "stripe_takeover_required",
      })
    );
  });
});

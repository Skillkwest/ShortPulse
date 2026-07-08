import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/account-summary";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const loadBillingCatalogSnapshotMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/billingCatalog", () => ({
  loadBillingCatalogSnapshot: (...args: unknown[]) => loadBillingCatalogSnapshotMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../features/billing/catalog", () => ({
  normalizePlanId: (value: string | null | undefined) => value ?? "free",
  buildPlanView: ({ planId }: { planId: string }) => ({
    id: planId === "starter" ? "starter" : "business",
    displayName: planId === "starter" ? "Starter" : "Business",
    className: planId === "starter" ? "plan-starter" : "plan-business",
    monthlyCreditsCents: planId === "starter" ? 350 : 60000,
    storageLimitBytes: planId === "starter" ? 5_000_000_000 : 500_000_000,
  }),
}));

type SupabaseResult<T> = {
  data: T | null;
  error: { message?: string | null } | null;
};

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

const ok = <T>(data: T | null): SupabaseResult<T> => ({ data, error: null });

const createMockResponse = () => {
  const response: NextApiResponse & {
    body?: unknown;
  } = {
    statusCode: 200,
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  } as unknown as NextApiResponse & { body?: unknown };
  return response;
};

const createQueryBuilder = <T>(
  result: SupabaseResult<T>,
  terminal?: "limit" | "in"
): QueryBuilder => {
  const query = {} as QueryBuilder;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => (terminal === "limit" ? Promise.resolve(result) : query));
  query.in = vi.fn(() => (terminal === "in" ? Promise.resolve(result) : query));
  query.maybeSingle = vi.fn(async () => result);
  return query;
};

const createSupabaseAdminMock = (params?: {
  billingContract?: Record<string, unknown> | null;
  pendingSubscriptionChange?: Record<string, unknown> | null;
}) => {
  const queries: Record<string, QueryBuilder[]> = {};
  const billingContract = params?.billingContract ?? {
    id: "contract-business",
    plan_id: "business",
    offer_id: "business__monthly",
    billing_interval: "month",
    stripe_subscription_id: "sub_123",
    stripe_price_id: "price_123",
    contract_source: "stripe",
    recurring_price_cents: 2500,
    monthly_credits_cents: 45000,
    storage_limit_bytes: 500_000_000,
    max_concurrent_generations: 8,
    status: "active",
    current_period_start: "2026-07-01T00:00:00Z",
    current_period_end: "2026-08-01T00:00:00Z",
    cancel_at_period_end: false,
    started_at: "2026-07-01T00:00:00Z",
    ended_at: null,
  };
  const from = vi.fn((table: string) => {
    const query =
      table === "billing_subscription_contracts"
        ? createQueryBuilder(ok(billingContract))
        : table === "billing_profiles"
          ? createQueryBuilder(
              ok({
                plan_id: "business",
                subscription_status: "active",
                current_period_end: "2026-08-01T00:00:00Z",
                stripe_customer_id: "cus_123",
                stripe_subscription_id: "sub_123",
              })
            )
          : table === "ai_credit_ledger"
            ? createQueryBuilder(
                ok([
                  {
                    id: "ledger-1",
                    change_cents: 1000,
                    reason: "subscription_renewal",
                    source: "stripe_subscription_renewal",
                    source_ref: "sub_123",
                    metadata: null,
                    created_at: "2026-07-01T00:00:00Z",
                  },
                ]),
                "limit"
              )
            : table === "billing_subscription_storage_addons"
              ? createQueryBuilder(
                  ok([
                    {
                      id: "addon-1",
                      storage_addon_id: "storage_10gb",
                      offer_id: "storage_10gb__monthly",
                      stripe_subscription_item_id: "si_123",
                      storage_limit_bytes: 10_000_000_000,
                      quantity: 1,
                      recurring_price_cents: 500,
                      status: "active",
                    },
                  ]),
                  "in"
                )
              : table === "billing_subscription_scheduled_changes"
                ? createQueryBuilder(ok(params?.pendingSubscriptionChange ?? null))
                : createQueryBuilder(ok(null));
    queries[table] = [...(queries[table] ?? []), query];
    return query;
  });

  return {
    client: { from },
    from,
    queries,
  };
};

const createRequest = (query: NextApiRequest["query"]): NextApiRequest =>
  ({
    method: "GET",
    query,
    headers: {},
  }) as NextApiRequest;

describe("/api/billing/account-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    loadBillingCatalogSnapshotMock.mockResolvedValue({ plans: [] });
  });

  it("reuses the initial profile and contract reads for profile-state responses", async () => {
    const supabase = createSupabaseAdminMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);
    const res = createMockResponse();

    await handler(createRequest({ includeProfileState: "1" }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(supabase.from).toHaveBeenCalledTimes(5);
    expect(supabase.from).toHaveBeenCalledWith("billing_subscription_contracts");
    expect(supabase.from).toHaveBeenCalledWith("billing_profiles");
    expect(supabase.queries.billing_subscription_contracts).toHaveLength(1);
    expect(supabase.queries.billing_profiles).toHaveLength(1);
    expect(supabase.queries.billing_subscription_contracts[0]?.select).toHaveBeenCalledWith(
      expect.stringContaining("recurring_price_cents")
    );
    expect(supabase.queries.billing_profiles[0]?.select).toHaveBeenCalledWith(
      expect.stringContaining("stripe_subscription_id")
    );
    expect(res.body).toMatchObject({
      resolvedPlan: {
        id: "business",
        monthlyCreditsCents: 45000,
      },
      profileState: {
        billingProfile: {
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          recurring_price_cents: 2500,
        },
        activeStorageAddons: [
          {
            recurringPriceCents: 500,
          },
        ],
      },
    });
  });

  it("returns scheduled cancellation state from the active subscription contract", async () => {
    const supabase = createSupabaseAdminMock({
      billingContract: {
        id: "contract-business",
        plan_id: "business",
        offer_id: "business__monthly",
        billing_interval: "month",
        stripe_subscription_id: "sub_123",
        stripe_price_id: "price_123",
        contract_source: "stripe",
        recurring_price_cents: 2500,
        monthly_credits_cents: 45000,
        storage_limit_bytes: 500_000_000,
        max_concurrent_generations: 8,
        status: "active",
        current_period_start: "2026-07-01T00:00:00Z",
        current_period_end: "2026-08-01T00:00:00Z",
        cancel_at_period_end: true,
        started_at: "2026-07-01T00:00:00Z",
        ended_at: null,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);
    const res = createMockResponse();

    await handler(createRequest({ includeProfileState: "1" }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      profileState: {
        billingContract: {
          current_period_end: "2026-08-01T00:00:00Z",
          cancel_at_period_end: true,
          ended_at: null,
        },
      },
    });
  });

  it("keeps the default account summary path on skinny billing reads", async () => {
    const supabase = createSupabaseAdminMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);
    const res = createMockResponse();

    await handler(createRequest({}), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(supabase.queries.billing_subscription_contracts).toHaveLength(1);
    expect(supabase.queries.billing_profiles).toHaveLength(1);
    expect(supabase.queries.billing_subscription_contracts[0]?.select).toHaveBeenCalledWith(
      "plan_id, monthly_credits_cents"
    );
    expect(supabase.queries.billing_profiles[0]?.select).toHaveBeenCalledWith("plan_id");
    expect(res.body).toMatchObject({
      profileState: null,
      pendingSubscriptionChange: null,
      resolvedPlan: {
        monthlyCreditsCents: 45000,
      },
    });
  });

  it("returns pending scheduled subscription changes without changing the active plan", async () => {
    const supabase = createSupabaseAdminMock({
      pendingSubscriptionChange: {
        change_kind: "scheduled_downgrade",
        status: "active",
        current_plan_id: "media",
        current_offer_id: "media__monthly",
        current_billing_interval: "month",
        current_stripe_price_id: "price_media",
        target_plan_id: "starter",
        target_offer_id: "starter__monthly",
        target_billing_interval: "month",
        target_stripe_price_id: "price_starter",
        target_recurring_price_cents: 1500,
        target_monthly_credits_cents: 350,
        target_storage_limit_bytes: 5_000_000_000,
        target_max_concurrent_generations: 1,
        effective_at: "2026-08-08T14:59:23.000Z",
        current_benefits_end_at: "2026-08-08T14:59:23.000Z",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);
    const res = createMockResponse();

    await handler(createRequest({ includeProfileState: "1" }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      resolvedPlan: {
        id: "business",
      },
      pendingSubscriptionChange: {
        kind: "scheduled_downgrade",
        targetPlanId: "starter",
        targetPlanLabel: "Starter",
        effectiveAt: "2026-08-08T14:59:23.000Z",
      },
      profileState: {
        pendingSubscriptionChange: {
          targetPlanId: "starter",
          targetPlanLabel: "Starter",
        },
      },
    });
  });
});

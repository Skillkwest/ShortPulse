import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/subscription/change";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const stripeGetMock = vi.fn();
const stripePostFormMock = vi.fn();
const getCanonicalAppBaseUrlMock = vi.fn();
const ensureStripeCustomerForUserMock = vi.fn();
const readVerifiedStripeSubscriptionForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  stripeGet: (...args: unknown[]) => stripeGetMock(...args),
  stripePostForm: (...args: unknown[]) => stripePostFormMock(...args),
  getCanonicalAppBaseUrl: (...args: unknown[]) => getCanonicalAppBaseUrlMock(...args),
}));

vi.mock("../../lib/server/api/stripeCustomer", () => ({
  ensureStripeCustomerForUser: (...args: unknown[]) => ensureStripeCustomerForUserMock(...args),
  readVerifiedStripeSubscriptionForUser: (...args: unknown[]) =>
    readVerifiedStripeSubscriptionForUserMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createOfferQueryMock = (rows: Record<string, unknown>[]) => ({
  data: rows,
  error: null,
  eq: (column: string, value: unknown) =>
    createOfferQueryMock(rows.filter((row) => row[column] === value)),
  maybeSingle: async () => ({
    data: rows[0] ?? null,
    error: null,
  }),
});

const createSupabaseAdminMock = (params: {
  billingProfile?: Record<string, unknown> | null;
  billingContract?: Record<string, unknown> | null;
  billingPlan?: Record<string, unknown> | null;
  billingPlans?: Record<string, unknown>[];
  billingOffers?: Record<string, unknown>[];
  activeStorageAddonRows?: Record<string, unknown>[];
  intentInsertError?: { message?: string; code?: string } | null;
  intentUpdateError?: { message?: string; code?: string } | null;
  onCloseContract?: (payload: unknown) => void;
  onCloseStorageAddons?: (payload: unknown) => void;
  onUpsertProfile?: (payload: unknown) => void;
  onIntentInsert?: (payload: unknown) => void;
  onIntentUpdate?: (payload: unknown) => void;
}) => ({
  from: (table: string) => {
    if (table === "billing_profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params.billingProfile ?? null,
              error: null,
            }),
          }),
        }),
        upsert: async (payload: unknown) => {
          params.onUpsertProfile?.(payload);
          return { error: null };
        },
      };
    }

    if (table === "billing_subscription_contracts") {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: params.billingContract ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: async () => {
            params.onCloseContract?.(payload);
            return { error: null };
          },
        }),
      };
    }

    if (table === "billing_plans") {
      const rows = params.billingPlans ?? (params.billingPlan ? [params.billingPlan] : []);
      return {
        select: () => ({
          eq: (column: string, value: unknown) => ({
            maybeSingle: async () => {
              return {
                data: rows.find((row) => row[column] === value) ?? null,
                error: null,
              };
            },
          }),
        }),
      };
    }

    if (table === "billing_plan_offers") {
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            if (
              column === "plan_id" ||
              column === "billing_interval" ||
              column === "is_active" ||
              column === "acquisition_enabled" ||
              column === "stripe_price_id"
            ) {
              return createOfferQueryMock(
                (params.billingOffers ?? []).filter((offer) => offer[column] === value)
              );
            }

            throw new Error(`Unexpected billing_plan_offers select eq column ${column}`);
          },
        }),
      };
    }

    if (table === "billing_subscription_storage_addons") {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              in: async () => ({
                data: params.activeStorageAddonRows ?? [],
                error: null,
              }),
            }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: () => ({
            is: async () => {
              params.onCloseStorageAddons?.(payload);
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "billing_subscription_change_intents") {
      return {
        insert: async (payload: unknown) => {
          params.onIntentInsert?.(payload);
          return { error: params.intentInsertError ?? null };
        },
        update: (payload: unknown) => {
          const updateChain = {
            eq: (column: string) => {
              if (column === "id") {
                params.onIntentUpdate?.(payload);
                return Promise.resolve({ error: params.intentUpdateError ?? null });
              }
              return updateChain;
            },
            in: async () => {
              params.onIntentUpdate?.(payload);
              return { error: params.intentUpdateError ?? null };
            },
          };
          return updateChain;
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  },
});

const createMultiItemUpgradeSupabaseMock = (
  overrides: Partial<Parameters<typeof createSupabaseAdminMock>[0]> = {}
) =>
  createSupabaseAdminMock({
    billingProfile: {
      user_id: "user-1",
      plan_id: "media",
      stripe_customer_id: null,
      stripe_subscription_id: "sub_123",
    },
    billingContract: {
      id: "contract_1",
      plan_id: "media",
      stripe_subscription_id: "sub_123",
      stripe_price_id: "price_media",
      contract_source: "stripe",
    },
    billingPlans: [
      {
        id: "media",
        display_name: "Media",
        sort_order: 20,
        is_active: true,
      },
      {
        id: "business",
        display_name: "Business",
        sort_order: 40,
        is_active: true,
      },
    ],
    billingOffers: [
      {
        id: "business__current",
        plan_id: "business",
        stripe_price_id: "price_business",
        billing_interval: "month",
        recurring_price_cents: 12900,
        acquisition_enabled: true,
        is_active: true,
        effective_start_at: "2026-04-01T00:00:00.000Z",
        created_at: "2026-04-01T00:00:00.000Z",
      },
    ],
    activeStorageAddonRows: [
      {
        id: "storage_row_1",
        storage_addon_id: "storage_100gb",
        stripe_subscription_item_id: "si_addon",
        quantity: 1,
        status: "active",
      },
    ],
    ...overrides,
  });

describe("POST /api/billing/subscription/change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.STRIPE_BILLING_PORTAL_FULL_PRICE_UPGRADE_CONFIG_ID = "bpc_full_price_upgrade_test";
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      user_metadata: {},
    });
    ensureStripeCustomerForUserMock.mockResolvedValue("cus_123");
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_media" } }],
      },
    });
    stripeGetMock.mockResolvedValue({
      id: "price_business",
      active: true,
      currency: "usd",
      unit_amount: 12900,
      recurring: { interval: "month" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "business",
      },
      product: null,
    });
    getCanonicalAppBaseUrlMock.mockReturnValue("https://app.shortpulse.test");
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns a safe subscription-change failure when auth verification throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: { targetPlanId: "business", billingInterval: "month" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(ensureStripeCustomerForUserMock).not.toHaveBeenCalled();
    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "billing/subscription/change.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to start the subscription change.",
    });
  });

  it("creates a targeted portal update flow for a Stripe-managed paid plan", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_media" } }],
      },
    });
    stripePostFormMock.mockResolvedValue({
      id: "bps_123",
      url: "https://stripe.test/portal_update",
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        "flow_data[type]": "subscription_update_confirm",
        "flow_data[subscription_update_confirm][subscription]": "sub_123",
        "flow_data[subscription_update_confirm][items][0][id]": "si_base",
        "flow_data[subscription_update_confirm][items][0][price]": "price_business",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("opens Stripe confirmation for a same-interval higher-plan subscription upgrade", async () => {
    const insertedIntents: unknown[] = [];
    const updatedIntents: unknown[] = [];
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlans: [
          {
            id: "media",
            display_name: "Media",
            sort_order: 20,
            is_active: true,
          },
          {
            id: "business",
            display_name: "Business",
            sort_order: 40,
            is_active: true,
          },
        ],
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            max_concurrent_generations: 8,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        onIntentInsert: (payload) => insertedIntents.push(payload),
        onIntentUpdate: (payload) => updatedIntents.push(payload),
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_media" } }],
      },
    });
    stripePostFormMock.mockResolvedValue({
      id: "bps_123",
      url: "https://stripe.test/portal_upgrade",
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        "flow_data[type]": "subscription_update_confirm",
        "flow_data[subscription_update_confirm][subscription]": "sub_123",
        "flow_data[subscription_update_confirm][items][0][id]": "si_base",
        "flow_data[subscription_update_confirm][items][0][price]": "price_business",
        "flow_data[subscription_update_confirm][items][0][quantity]": 1,
        configuration: "bpc_full_price_upgrade_test",
      })
    );
    expect(stripePostFormMock).not.toHaveBeenCalledWith(
      "/subscriptions/sub_123",
      expect.any(Object)
    );
    expect(insertedIntents).toHaveLength(1);
    expect(insertedIntents[0]).toEqual(
      expect.objectContaining({
        user_id: "user-1",
        intent_kind: "full_price_upgrade",
        status: "pending",
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_123",
        active_plan_id: "media",
        active_offer_id: null,
        active_billing_interval: "month",
        active_stripe_price_id: "price_media",
        target_plan_id: "business",
        target_offer_id: "business__current",
        target_billing_interval: "month",
        target_stripe_price_id: "price_business",
        expires_at: expect.any(String),
      })
    );
    expect(updatedIntents).toEqual([
      expect.objectContaining({ status: "expired" }),
      expect.objectContaining({
        status: "portal_created",
        stripe_portal_session_id: "bps_123",
      }),
    ]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      redirectUrl: "https://stripe.test/portal_upgrade",
      mode: "portal",
    });
  });

  it("fails closed before Stripe when a higher-plan upgrade has no full-price Portal configuration", async () => {
    delete process.env.STRIPE_BILLING_PORTAL_FULL_PRICE_UPGRADE_CONFIG_ID;
    const intentInsertSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlans: [
          {
            id: "media",
            display_name: "Media",
            sort_order: 20,
            is_active: true,
          },
          {
            id: "business",
            display_name: "Business",
            sort_order: 40,
            is_active: true,
          },
        ],
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            max_concurrent_generations: 8,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        onIntentInsert: intentInsertSpy,
      })
    );
    stripePostFormMock.mockResolvedValue({
      id: "bps_123",
      url: "https://stripe.test/portal_upgrade",
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(intentInsertSpy).not.toHaveBeenCalled();
    expect(stripePostFormMock).not.toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.any(Object)
    );
    expect(res.status).toHaveBeenCalledWith(501);
    expect(res.json).toHaveBeenCalledWith({
      error: "This plan change is temporarily unavailable. Try again later.",
    });
  });

  it("opens Stripe confirmation for a single-item monthly-to-annual higher-plan upgrade", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlans: [
          {
            id: "media",
            display_name: "Media",
            sort_order: 20,
            is_active: true,
          },
          {
            id: "business",
            display_name: "Business",
            sort_order: 40,
            is_active: true,
          },
        ],
        billingOffers: [
          {
            id: "business__year_current",
            plan_id: "business",
            stripe_price_id: "price_business_year",
            billing_interval: "year",
            recurring_price_cents: 274800,
            max_concurrent_generations: 8,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_media" } }],
      },
    });
    stripeGetMock.mockResolvedValueOnce({
      id: "price_business_year",
      active: true,
      currency: "usd",
      unit_amount: 274800,
      recurring: { interval: "year" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "business",
      },
      product: null,
    });
    stripePostFormMock.mockResolvedValue({
      id: "bps_123",
      url: "https://stripe.test/portal_upgrade_annual",
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business", billingInterval: "year" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        "flow_data[type]": "subscription_update_confirm",
        "flow_data[subscription_update_confirm][subscription]": "sub_123",
        "flow_data[subscription_update_confirm][items][0][id]": "si_base",
        "flow_data[subscription_update_confirm][items][0][price]": "price_business_year",
        "flow_data[subscription_update_confirm][items][0][quantity]": 1,
      })
    );
    expect(stripePostFormMock).not.toHaveBeenCalledWith(
      "/subscriptions/sub_123",
      expect.any(Object)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      redirectUrl: "https://stripe.test/portal_upgrade_annual",
      mode: "portal",
    });
  });

  it("does not open a hosted invoice fallback for higher-plan upgrades", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlans: [
          {
            id: "media",
            display_name: "Media",
            sort_order: 20,
            is_active: true,
          },
          {
            id: "business",
            display_name: "Business",
            sort_order: 40,
            is_active: true,
          },
        ],
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            max_concurrent_generations: 8,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    stripePostFormMock.mockResolvedValue({
      id: "bps_123",
      url: "https://stripe.test/portal_upgrade",
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        "flow_data[type]": "subscription_update_confirm",
      })
    );
    expect(stripePostFormMock).not.toHaveBeenCalledWith(
      "/subscriptions/sub_123",
      expect.any(Object)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      redirectUrl: "https://stripe.test/portal_upgrade",
      mode: "portal",
    });
  });

  it("returns a controlled unavailable response when Stripe Portal subscription updates are disabled", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_media" } }],
      },
    });
    stripePostFormMock.mockRejectedValueOnce(
      new Error(
        "This subscription cannot be updated because the subscription update feature in the portal configuration is disabled."
      )
    );

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "This plan change is temporarily unavailable. Try again later.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("fails closed when Stripe does not return a base subscription item", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [],
      },
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "This plan change is temporarily unavailable. Try again later.",
    });
  });

  it("uses the portal update flow for a legacy Stripe paid profile without a contract row", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "starter",
          stripe_customer_id: null,
          stripe_subscription_id: "sub_legacy",
        },
        billingContract: null,
        billingPlan: {
          id: "starter",
          display_name: "Starter",
          is_active: true,
        },
        billingOffers: [
          {
            id: "starter__year_current",
            plan_id: "starter",
            stripe_price_id: "price_starter_year",
            billing_interval: "year",
            recurring_price_cents: 18000,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_legacy",
      customer: "cus_123",
      items: {
        data: [{ id: "si_starter", quantity: 1, price: { id: "price_starter_month" } }],
      },
    });
    stripeGetMock.mockResolvedValueOnce({
      id: "price_starter_year",
      active: true,
      currency: "usd",
      unit_amount: 18000,
      recurring: { interval: "year" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "starter",
      },
      product: null,
    });
    stripePostFormMock.mockResolvedValue({
      id: "bps_legacy",
      url: "https://stripe.test/portal_update_starter_year",
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "starter", billingInterval: "year" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(readVerifiedStripeSubscriptionForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      stripeSubscriptionId: "sub_legacy",
    });
    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        customer: "cus_123",
        "flow_data[type]": "subscription_update_confirm",
        "flow_data[subscription_update_confirm][subscription]": "sub_legacy",
        "flow_data[subscription_update_confirm][items][0][id]": "si_starter",
        "flow_data[subscription_update_confirm][items][0][price]": "price_starter_year",
      })
    );
    expect(ensureStripeCustomerForUserMock).not.toHaveBeenCalled();
    expect(stripePostFormMock).not.toHaveBeenCalledWith("/checkout/sessions", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("blocks plan changes that cannot carry a current billable storage add-on", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "starter",
          display_name: "Starter",
          is_active: true,
        },
        billingOffers: [
          {
            id: "starter__current",
            plan_id: "starter",
            stripe_price_id: "price_starter",
            billing_interval: "month",
            recurring_price_cents: 1500,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        activeStorageAddonRows: [
          {
            id: "storage_row_1",
            storage_addon_id: "storage_100gb",
            quantity: 1,
            status: "past_due",
          },
        ],
      })
    );

    const req = {
      method: "POST",
      body: { targetPlanId: "starter" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(readVerifiedStripeSubscriptionForUserMock).not.toHaveBeenCalled();
    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Remove or change your active storage add-on before switching to this subscription plan.",
    });
  });

  it("starts subscription checkout when an internal-comp account selects a paid public plan", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "business",
          stripe_customer_id: null,
          stripe_subscription_id: null,
        },
        billingContract: {
          id: "contract_internal",
          plan_id: "business",
          stripe_subscription_id: null,
          stripe_price_id: null,
          billing_interval: "month",
          contract_source: "internal_comp",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    stripePostFormMock.mockResolvedValue({
      id: "cs_123",
      url: "https://stripe.test/checkout_business",
    });

    const req = {
      method: "POST",
      body: {
        targetPlanId: "business",
        checkoutCancelPath: "/pricing?intent=create-project&plan=business&interval=month",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/checkout/sessions",
      expect.objectContaining({
        mode: "subscription",
        "line_items[0][price]": "price_business",
        success_url:
          "https://app.shortpulse.test/ai-studio?checkout=subscription_success&project=new&checkout_session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          "https://app.shortpulse.test/pricing?intent=create-project&plan=business&interval=month",
        "metadata[billing_interval]": "month",
        "subscription_data[metadata][billing_interval]": "month",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("keeps profile as the checkout cancel fallback when the requested cancel path is not pricing", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "free",
          stripe_customer_id: null,
          stripe_subscription_id: null,
        },
        billingContract: null,
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    stripePostFormMock.mockResolvedValue({
      id: "cs_124",
      url: "https://stripe.test/checkout_business",
    });

    const req = {
      method: "POST",
      body: {
        targetPlanId: "business",
        checkoutCancelPath: "https://evil.example/pricing",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/checkout/sessions",
      expect.objectContaining({
        cancel_url:
          "https://app.shortpulse.test/profile?section=subscription&plan_change=checkout_cancel",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed before checkout when the Stripe price interval does not match the selected interval", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "free",
          stripe_customer_id: null,
          stripe_subscription_id: null,
        },
        billingContract: null,
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__year",
            plan_id: "business",
            stripe_price_id: "price_business_year",
            billing_interval: "year",
            recurring_price_cents: 274800,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    stripeGetMock.mockResolvedValueOnce({
      id: "price_business_year",
      active: true,
      currency: "usd",
      unit_amount: 274800,
      recurring: { interval: "month" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "business",
      },
      product: null,
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business", billingInterval: "year" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "This plan change is temporarily unavailable. Try again later.",
    });
    expect(stripePostFormMock).not.toHaveBeenCalled();
  });

  it("fails closed before portal update when the target Stripe price does not match the selected interval", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "starter",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "starter",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_starter_month",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "starter",
          display_name: "Starter",
          is_active: true,
        },
        billingOffers: [
          {
            id: "starter__year",
            plan_id: "starter",
            stripe_price_id: "price_starter_year",
            billing_interval: "year",
            recurring_price_cents: 18000,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    stripeGetMock.mockResolvedValueOnce({
      id: "price_starter_year",
      active: true,
      currency: "usd",
      unit_amount: 18000,
      recurring: { interval: "month" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "starter",
      },
      product: null,
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "starter", billingInterval: "year" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "This plan change is temporarily unavailable. Try again later.",
    });
    expect(stripePostFormMock).not.toHaveBeenCalled();
  });

  it("blocks compatible multi-item subscription upgrades instead of mutating Stripe directly", async () => {
    getSupabaseAdminMock.mockReturnValue(createMultiItemUpgradeSupabaseMock());
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [
          { id: "si_base", quantity: 1, price: { id: "price_media" } },
          { id: "si_addon", quantity: 1, price: { id: "price_storage_100" } },
        ],
      },
    });
    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Remove or change your active storage add-on before downgrading or changing billing intervals.",
    });
  });

  it("blocks multi-item subscription upgrades when the extra Stripe item is not the projected active storage add-on", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createMultiItemUpgradeSupabaseMock({
        activeStorageAddonRows: [
          {
            id: "storage_row_1",
            storage_addon_id: "storage_100gb",
            stripe_subscription_item_id: "si_different_addon",
            quantity: 1,
            status: "active",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [
          { id: "si_base", quantity: 1, price: { id: "price_media" } },
          { id: "si_addon", quantity: 1, price: { id: "price_storage_100" } },
        ],
      },
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).not.toHaveBeenCalledWith(
      "/subscriptions/sub_123",
      expect.any(Object)
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Remove or change your active storage add-on before downgrading or changing billing intervals.",
    });
  });

  it("blocks multi-item subscription interval changes instead of directly mutating mixed intervals", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: null,
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          billing_interval: "month",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__annual",
            plan_id: "business",
            stripe_price_id: "price_business_year",
            billing_interval: "year",
            recurring_price_cents: 129000,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [
          { id: "si_base", quantity: 1, price: { id: "price_media" } },
          { id: "si_addon", quantity: 1, price: { id: "price_storage_100" } },
        ],
      },
    });
    stripeGetMock.mockResolvedValueOnce({
      id: "price_business_year",
      active: true,
      currency: "usd",
      unit_amount: 129000,
      recurring: { interval: "year" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "business",
      },
      product: null,
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "business", billingInterval: "year" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Remove or change your active storage add-on before downgrading or changing billing intervals.",
    });
  });

  it("fails closed when the stored Stripe subscription belongs to another user", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_foreign",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_foreign",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockRejectedValueOnce(
      new Error("Stripe subscription ownership mismatch detected.")
    );

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to start the subscription change.",
    });
    expect(stripePostFormMock).not.toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        "flow_data[subscription_update_confirm][subscription]": "sub_foreign",
      })
    );
  });

  it("creates a cancellation flow when switching a Stripe subscription to free", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
      })
    );
    stripePostFormMock.mockResolvedValue({
      id: "bps_cancel_1",
      url: "https://stripe.test/portal_cancel",
    });

    const req = {
      method: "POST",
      body: { targetPlanId: "free" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(readVerifiedStripeSubscriptionForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      stripeSubscriptionId: "sub_123",
    });
    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        customer: "cus_123",
        "flow_data[type]": "subscription_cancel",
        "flow_data[subscription_cancel][subscription]": "sub_123",
      })
    );
    expect(ensureStripeCustomerForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed when the stored Stripe subscription for cancellation belongs to another user", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_foreign",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_foreign",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockRejectedValueOnce(
      new Error("Stripe subscription ownership mismatch detected.")
    );

    const req = {
      method: "POST",
      body: { targetPlanId: "free" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to start the subscription change.",
    });
    expect(stripePostFormMock).not.toHaveBeenCalled();
  });

  it("switches an internal-comp plan to free immediately in-app", async () => {
    const closeContractSpy = vi.fn();
    const closeStorageAddonsSpy = vi.fn();
    const upsertProfileSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "business",
          stripe_customer_id: "cus_existing",
          stripe_subscription_id: null,
        },
        billingContract: {
          id: "contract_internal",
          plan_id: "business",
          stripe_customer_id: "cus_existing",
          stripe_subscription_id: null,
          stripe_price_id: null,
          contract_source: "internal_comp",
        },
        onCloseContract: closeContractSpy,
        onCloseStorageAddons: closeStorageAddonsSpy,
        onUpsertProfile: upsertProfileSpy,
      })
    );

    const req = {
      method: "POST",
      body: { targetPlanId: "free" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(closeContractSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "canceled",
        ended_at: expect.any(String),
      })
    );
    expect(closeStorageAddonsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "canceled",
        ended_at: expect.any(String),
        current_period_end: expect.any(String),
      })
    );
    expect(upsertProfileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        plan_id: "free",
        stripe_customer_id: "cus_existing",
        stripe_subscription_id: null,
      })
    );
    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns a sanitized 500 when portal session creation fails", async () => {
    stripePostFormMock.mockRejectedValueOnce(new Error("portal exploded"));
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    const req = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to start the subscription change.",
    });
  });

  it("rate limits repeated subscription change attempts for the same authenticated user", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "media",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "media",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          billing_interval: "month",
          contract_source: "stripe",
        },
        billingPlan: {
          id: "business",
          display_name: "Business",
          is_active: true,
        },
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            stripe_price_id: "price_business",
            billing_interval: "month",
            recurring_price_cents: 12900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_media" } }],
      },
    });
    stripePostFormMock.mockResolvedValue({
      id: "bps_123",
      url: "https://stripe.test/portal_update",
    });

    for (let index = 0; index < 8; index += 1) {
      const req = {
        method: "POST",
        body: { targetPlanId: "business" },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();
      await handler(req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      body: { targetPlanId: "business" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const blockedRes = createMockResponse();

    await handler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});

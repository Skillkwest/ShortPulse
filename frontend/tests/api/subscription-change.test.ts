import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/subscription/change";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const stripeGetMock = vi.fn();
const stripePostFormMock = vi.fn();
const getCanonicalAppBaseUrlMock = vi.fn();
const ensureStripeCustomerForUserMock = vi.fn();

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
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createSupabaseAdminMock = (params: {
  billingProfile?: Record<string, unknown> | null;
  billingContract?: Record<string, unknown> | null;
  billingPlan?: Record<string, unknown> | null;
  billingOffers?: Record<string, unknown>[];
  onCloseContract?: (payload: unknown) => void;
  onCloseStorageAddons?: (payload: unknown) => void;
  onUpsertProfile?: (payload: unknown) => void;
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
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              return {
                data: params.billingPlan ?? null,
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
            if (column === "plan_id") {
              const result = {
                data: params.billingOffers ?? [],
                error: null,
                eq: () => result,
              };
              return result;
            }

            if (column === "stripe_price_id") {
              return {
                maybeSingle: async () => ({
                  data:
                    (params.billingOffers ?? []).find((offer) => offer.stripe_price_id === value) ??
                    null,
                  error: null,
                }),
              };
            }

            throw new Error(`Unexpected billing_plan_offers select eq column ${column}`);
          },
        }),
      };
    }

    if (table === "billing_subscription_storage_addons") {
      return {
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

    throw new Error(`Unexpected table ${table}`);
  },
});

describe("POST /api/billing/subscription/change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      user_metadata: {},
    });
    ensureStripeCustomerForUserMock.mockResolvedValue("cus_123");
    getCanonicalAppBaseUrlMock.mockReturnValue("https://app.shortpulse.test");
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
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
    stripeGetMock.mockResolvedValue({
      id: "sub_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_media" } }],
      },
    });
    stripePostFormMock.mockResolvedValue({
      id: "bps_123",
      url: "https://stripe.test/portal_update",
    });

    const req = { method: "POST", body: { targetPlanId: "business" } };
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

    const req = { method: "POST", body: { targetPlanId: "business" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/checkout/sessions",
      expect.objectContaining({
        mode: "subscription",
        "line_items[0][price]": "price_business",
        success_url:
          "https://app.shortpulse.test/profile?section=subscription&plan_change=checkout_success",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("falls back to the generic subscription-update portal flow for multi-item subscriptions", async () => {
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
          {
            id: "media_storage_100__current",
            plan_id: "media_storage_100",
            stripe_price_id: "price_storage_100",
            billing_interval: "month",
            recurring_price_cents: 1000,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );
    stripeGetMock.mockResolvedValue({
      id: "sub_123",
      items: {
        data: [
          { id: "si_base", quantity: 1, price: { id: "price_media" } },
          { id: "si_addon", quantity: 1, price: { id: "price_storage_100" } },
        ],
      },
    });
    stripePostFormMock.mockResolvedValue({
      id: "bps_124",
      url: "https://stripe.test/portal_update_generic",
    });

    const req = { method: "POST", body: { targetPlanId: "business" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        "flow_data[type]": "subscription_update",
        "flow_data[subscription_update][subscription]": "sub_123",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
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

    const req = { method: "POST", body: { targetPlanId: "free" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        "flow_data[type]": "subscription_cancel",
        "flow_data[subscription_cancel][subscription]": "sub_123",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
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

    const req = { method: "POST", body: { targetPlanId: "free" } };
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
});

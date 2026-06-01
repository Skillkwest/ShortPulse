import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/storage-addon/change";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const stripeGetMock = vi.fn();
const stripePostFormMock = vi.fn();
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
}));

vi.mock("../../lib/server/api/stripeCustomer", () => ({
  readVerifiedStripeSubscriptionForUser: (...args: unknown[]) =>
    readVerifiedStripeSubscriptionForUserMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createSupabaseAdminMock = (params: {
  billingProfile?: Record<string, unknown> | null;
  billingContract?: Record<string, unknown> | null;
  storageAddon?: Record<string, unknown> | null;
  storageAddonOffers?: Record<string, unknown>[];
  activeStorageAddonRows?: Record<string, unknown>[];
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
      };
    }

    if (table === "billing_storage_addons") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params.storageAddon ?? null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "billing_storage_addon_offers") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: async () => ({
                data: params.storageAddonOffers ?? [],
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === "billing_subscription_storage_addons") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                eq: async () => ({
                  data: params.activeStorageAddonRows ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  },
});

describe("POST /api/billing/storage-addon/change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      user_metadata: {},
    });
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_studio" } }],
      },
    });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("adds a recurring storage add-on for a Stripe-managed paid subscriber", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
          subscription_status: "active",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "studio",
          stripe_subscription_id: "sub_123",
          contract_source: "stripe",
          status: "active",
        },
        storageAddon: {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          is_active: true,
        },
        storageAddonOffers: [
          {
            id: "storage_100gb__current",
            storage_addon_id: "storage_100gb",
            stripe_price_id: "price_storage_100",
            recurring_price_cents: 1500,
            storage_limit_bytes: 107374182400,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        activeStorageAddonRows: [],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_studio" } }],
      },
    });
    stripePostFormMock.mockResolvedValue({ id: "sub_123" });

    const req = {
      method: "POST",
      body: { storageAddonId: "storage_100gb", action: "add" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith("/subscriptions/sub_123", {
      proration_behavior: "create_prorations",
      payment_behavior: "error_if_incomplete",
      "items[0][price]": "price_storage_100",
      "items[0][quantity]": 1,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      message: "Extra 100 GB added. Stripe is syncing your workspace storage now.",
    });
  });

  it("removes an active recurring storage add-on using the live Stripe subscription item", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
          subscription_status: "active",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "studio",
          stripe_subscription_id: "sub_123",
          contract_source: "stripe",
          status: "active",
        },
        storageAddon: {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          is_active: true,
        },
        storageAddonOffers: [
          {
            id: "storage_100gb__current",
            storage_addon_id: "storage_100gb",
            stripe_price_id: "price_storage_100",
            recurring_price_cents: 1500,
            storage_limit_bytes: 107374182400,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        activeStorageAddonRows: [
          {
            id: "addon_row_1",
            storage_addon_id: "storage_100gb",
            offer_id: "storage_100gb__current",
            stripe_subscription_item_id: "si_storage_100",
            stripe_price_id: "price_storage_100",
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
          { id: "si_base", quantity: 1, price: { id: "price_studio" } },
          { id: "si_storage_100", quantity: 1, price: { id: "price_storage_100" } },
        ],
      },
    });
    stripePostFormMock.mockResolvedValue({ id: "sub_123" });

    const req = {
      method: "POST",
      body: { storageAddonId: "storage_100gb", action: "remove" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith("/subscriptions/sub_123", {
      proration_behavior: "create_prorations",
      "items[0][id]": "si_storage_100",
      "items[0][deleted]": true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed when the stored Stripe subscription belongs to another user", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_foreign",
          subscription_status: "active",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "studio",
          stripe_subscription_id: "sub_foreign",
          contract_source: "stripe",
          status: "active",
        },
        storageAddon: {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          is_active: true,
        },
        storageAddonOffers: [
          {
            id: "storage_100gb__current",
            storage_addon_id: "storage_100gb",
            stripe_price_id: "price_storage_100",
            recurring_price_cents: 1500,
            storage_limit_bytes: 107374182400,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        activeStorageAddonRows: [],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockRejectedValueOnce(
      new Error("Stripe subscription ownership mismatch detected.")
    );

    const req = {
      method: "POST",
      body: { storageAddonId: "storage_100gb", action: "add" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to update recurring storage right now.",
    });
    expect(stripePostFormMock).not.toHaveBeenCalled();
  });

  it("blocks add-on changes for internal-comp billing", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_status: "active",
        },
        billingContract: {
          id: "contract_internal",
          plan_id: "studio",
          stripe_subscription_id: null,
          contract_source: "internal_comp",
          status: "active",
        },
        storageAddon: {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          is_active: true,
        },
        storageAddonOffers: [],
        activeStorageAddonRows: [],
      })
    );

    const req = {
      method: "POST",
      body: { storageAddonId: "storage_100gb", action: "add" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("blocks duplicate add-on purchases when Stripe already has the item but local sync is stale", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
          subscription_status: "active",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "studio",
          stripe_subscription_id: "sub_123",
          contract_source: "stripe",
          status: "active",
        },
        storageAddon: {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          is_active: true,
        },
        storageAddonOffers: [
          {
            id: "storage_100gb__current",
            storage_addon_id: "storage_100gb",
            stripe_price_id: "price_storage_100",
            recurring_price_cents: 1500,
            storage_limit_bytes: 107374182400,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        activeStorageAddonRows: [],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [
          { id: "si_base", quantity: 1, price: { id: "price_studio" } },
          { id: "si_storage_100", quantity: 1, price: { id: "price_storage_100" } },
        ],
      },
    });

    const req = {
      method: "POST",
      body: { storageAddonId: "storage_100gb", action: "add" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Extra 100 GB is already active on this workspace.",
    });
  });

  it("fails closed when Stripe cannot complete the storage add-on charge immediately", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
          subscription_status: "active",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "studio",
          stripe_subscription_id: "sub_123",
          contract_source: "stripe",
          status: "active",
        },
        storageAddon: {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          is_active: true,
        },
        storageAddonOffers: [
          {
            id: "storage_100gb__current",
            storage_addon_id: "storage_100gb",
            stripe_price_id: "price_storage_100",
            recurring_price_cents: 1500,
            storage_limit_bytes: 107374182400,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        activeStorageAddonRows: [],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_studio" } }],
      },
    });
    stripePostFormMock.mockRejectedValueOnce(
      new Error("This payment requires additional customer action.")
    );

    const req = {
      method: "POST",
      body: { storageAddonId: "storage_100gb", action: "add" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to update recurring storage right now.",
    });
  });

  it("rate limits repeated storage add-on mutations for the same authenticated user", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        billingProfile: {
          user_id: "user-1",
          plan_id: "studio",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
          subscription_status: "active",
        },
        billingContract: {
          id: "contract_1",
          plan_id: "studio",
          stripe_subscription_id: "sub_123",
          contract_source: "stripe",
          status: "active",
        },
        storageAddon: {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          is_active: true,
        },
        storageAddonOffers: [
          {
            id: "storage_100gb__current",
            storage_addon_id: "storage_100gb",
            stripe_price_id: "price_storage_100",
            recurring_price_cents: 1500,
            storage_limit_bytes: 107374182400,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-04-01T00:00:00.000Z",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        activeStorageAddonRows: [],
      })
    );
    readVerifiedStripeSubscriptionForUserMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [{ id: "si_base", quantity: 1, price: { id: "price_studio" } }],
      },
    });
    stripePostFormMock.mockResolvedValue({ id: "sub_123" });

    for (let index = 0; index < 10; index += 1) {
      const req = {
        method: "POST",
        body: { storageAddonId: "storage_100gb", action: "add" },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      body: { storageAddonId: "storage_100gb", action: "add" },
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

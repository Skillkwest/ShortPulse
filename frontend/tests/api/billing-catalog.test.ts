import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/catalog";

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

describe("GET /api/billing/catalog", () => {
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

  it("returns active plans and credit packages from one backend payload", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: () => ({
              eq: () => ({
                data: [
                  {
                    id: "free",
                    display_name: "Free",
                    is_active: true,
                    sort_order: 0,
                  },
                  {
                    id: "studio",
                    display_name: "Studio",
                    is_active: true,
                    sort_order: 20,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "billing_plan_offers") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    order: () => ({
                      order: async () => ({
                        data: [
                          {
                            id: "free__current",
                            plan_id: "free",
                            billing_interval: "month",
                            recurring_price_cents: 0,
                            monthly_credits_cents: 100,
                            storage_limit_bytes: 1073741824,
                            acquisition_enabled: true,
                            is_active: true,
                            effective_start_at: "2026-04-01T00:00:00.000Z",
                            created_at: "2026-04-01T00:00:00.000Z",
                          },
                          {
                            id: "studio__spring_promo",
                            plan_id: "studio",
                            billing_interval: "month",
                            recurring_price_cents: 3900,
                            monthly_credits_cents: 3000,
                            storage_limit_bytes: 107374182400,
                            acquisition_enabled: true,
                            is_active: true,
                            effective_start_at: "2026-04-15T00:00:00.000Z",
                            created_at: "2026-04-15T00:00:00.000Z",
                          },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "billing_credit_packages") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: "growth_2000",
                      display_name: "Growth 2,000",
                      credit_amount_cents: 2000,
                      price_cents: 2600,
                      sort_order: 20,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "billing_storage_addons") {
          return {
            select: () => ({
              eq: () => ({
                data: [
                  {
                    id: "storage_25gb",
                    display_name: "Extra 25 GB",
                    sort_order: 10,
                    is_active: true,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "billing_storage_addon_offers") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    order: () => ({
                      order: async () => ({
                        data: [
                          {
                            id: "storage_25gb__spring",
                            storage_addon_id: "storage_25gb",
                            storage_limit_bytes: 26843545600,
                            recurring_price_cents: 500,
                            acquisition_enabled: true,
                            is_active: true,
                            effective_start_at: "2026-04-15T00:00:00.000Z",
                            created_at: "2026-04-15T00:00:00.000Z",
                          },
                        ],
                        error: null,
                      }),
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

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      plans: [
        {
          id: "free",
          display_name: "Free",
          sort_order: 0,
          monthly_price_cents: 0,
          monthly_credits_cents: 100,
          storage_limit_bytes: 1073741824,
          is_active: true,
          offers: {
            month: {
              id: "free__current",
              billing_interval: "month",
              recurring_price_cents: 0,
              monthly_credits_cents: 100,
              storage_limit_bytes: 1073741824,
              stripe_price_id: undefined,
              acquisition_enabled: true,
              is_active: true,
              effective_start_at: "2026-04-01T00:00:00.000Z",
            },
          },
        },
        {
          id: "studio",
          display_name: "Studio",
          sort_order: 20,
          monthly_price_cents: 3900,
          monthly_credits_cents: 3000,
          storage_limit_bytes: 107374182400,
          is_active: true,
          offers: {
            month: {
              id: "studio__spring_promo",
              billing_interval: "month",
              recurring_price_cents: 3900,
              monthly_credits_cents: 3000,
              storage_limit_bytes: 107374182400,
              stripe_price_id: undefined,
              acquisition_enabled: true,
              is_active: true,
              effective_start_at: "2026-04-15T00:00:00.000Z",
            },
          },
        },
      ],
      packages: [
        {
          id: "growth_2000",
          display_name: "Growth 2,000",
          credit_amount_cents: 2000,
          price_cents: 2600,
          sort_order: 20,
        },
      ],
      storageAddons: [
        {
          id: "storage_25gb",
          display_name: "Extra 25 GB",
          storage_limit_bytes: 26843545600,
          monthly_price_cents: 500,
          sort_order: 10,
        },
      ],
    });
  });
});

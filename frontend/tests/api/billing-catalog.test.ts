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

  it("returns a safe catalog failure when auth verification throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "billing/catalog.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load billing catalog.",
    });
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
                    display_name: "Baseline access",
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
                            monthly_credits_cents: 0,
                            storage_limit_bytes: 0,
                            acquisition_enabled: false,
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
                      id: "2500",
                      display_name: "2,500 credits",
                      credit_amount_cents: 2500,
                      price_cents: 9900,
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
                    sort_order: 5,
                    is_active: true,
                  },
                  {
                    id: "storage_1tb",
                    display_name: "Extra 1 TB",
                    sort_order: 10,
                    is_active: true,
                  },
                  {
                    id: "storage_100gb",
                    display_name: "Extra 100 GB",
                    sort_order: 20,
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
                          {
                            id: "storage_1tb__spring",
                            storage_addon_id: "storage_1tb",
                            storage_limit_bytes: 1099511627776,
                            recurring_price_cents: 8900,
                            acquisition_enabled: true,
                            is_active: true,
                            effective_start_at: "2026-04-15T00:00:00.000Z",
                            created_at: "2026-04-15T00:00:00.000Z",
                          },
                          {
                            id: "storage_100gb__spring",
                            storage_addon_id: "storage_100gb",
                            storage_limit_bytes: 107374182400,
                            recurring_price_cents: 2000,
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
          display_name: "Baseline access",
          sort_order: 0,
          monthly_price_cents: 0,
          monthly_credits_cents: 0,
          storage_limit_bytes: 0,
          max_concurrent_generations: 0,
          is_active: true,
          offers: {
            month: {
              id: "free__current",
              billing_interval: "month",
              recurring_price_cents: 0,
              monthly_credits_cents: 0,
              storage_limit_bytes: 0,
              max_concurrent_generations: 0,
              stripe_price_id: undefined,
              acquisition_enabled: false,
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
          max_concurrent_generations: 4,
          is_active: true,
          offers: {
            month: {
              id: "studio__spring_promo",
              billing_interval: "month",
              recurring_price_cents: 3900,
              monthly_credits_cents: 3000,
              storage_limit_bytes: 107374182400,
              max_concurrent_generations: 4,
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
          id: "2500",
          display_name: "2,500 credits",
          credit_amount_cents: 2500,
          price_cents: 9900,
          sort_order: 20,
        },
      ],
      storageAddons: [
        {
          id: "storage_1tb",
          display_name: "Extra 1 TB",
          storage_limit_bytes: 1099511627776,
          monthly_price_cents: 8900,
          sort_order: 10,
        },
        {
          id: "storage_100gb",
          display_name: "Extra 100 GB",
          storage_limit_bytes: 107374182400,
          monthly_price_cents: 2000,
          sort_order: 20,
        },
      ],
    });
  });

  it("falls back to default concurrency when the hosted plan-offer column is missing", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: () => ({
              eq: () => ({
                data: [
                  {
                    id: "business",
                    display_name: "Business",
                    is_active: true,
                    sort_order: 40,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "billing_plan_offers") {
          return {
            select: (columns: string) => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    order: () => ({
                      order: async () =>
                        columns.includes("max_concurrent_generations")
                          ? {
                              data: null,
                              error: {
                                code: "42703",
                                message:
                                  "column billing_plan_offers.max_concurrent_generations does not exist",
                              },
                            }
                          : {
                              data: [
                                {
                                  id: "business__current",
                                  plan_id: "business",
                                  billing_interval: "month",
                                  recurring_price_cents: 24900,
                                  monthly_credits_cents: 15000,
                                  storage_limit_bytes: 536870912000,
                                  stripe_price_id: "price_business",
                                  acquisition_enabled: true,
                                  is_active: true,
                                  effective_start_at: "2026-04-15T00:00:00.000Z",
                                  created_at: "2026-04-15T00:00:00.000Z",
                                },
                              ],
                              error: null,
                            },
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
                  data: [],
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
                data: [],
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
                        data: [],
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

    const res = createMockResponse();

    await handler({ method: "GET" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        plans: [
          expect.objectContaining({
            id: "business",
            max_concurrent_generations: 8,
            offers: {
              month: expect.objectContaining({
                max_concurrent_generations: 8,
              }),
            },
          }),
        ],
      })
    );
  });

  it("logs and sanitizes backend catalog failures", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: () => ({
              eq: () => ({
                data: [],
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
                        data: null,
                        error: { message: "billing_plan_offers missing from schema cache" },
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
                  data: [],
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
                data: [],
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
                        data: [],
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

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "billing/catalog",
        user: expect.objectContaining({ id: "user-1" }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load billing catalog.",
    });
  });
});

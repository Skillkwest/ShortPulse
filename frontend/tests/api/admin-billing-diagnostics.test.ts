import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/billing-diagnostics";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const stripeGetMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  stripeGet: (...args: unknown[]) => stripeGetMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/admin/billing-diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    process.env.STRIPE_SECRET_KEY = "sk_test_admin";
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns billing diagnostics and grandfathered-price findings", async () => {
    const billingProfileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            plan_id: "studio",
            subscription_status: "active",
            stripe_customer_id: "cus_123",
            stripe_subscription_id: "sub_123",
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
                  plan_id: "studio",
                  offer_id: "studio__legacy_10",
                  stripe_price_id: "price_legacy_studio",
                  stripe_subscription_id: "sub_123",
                  contract_source: "stripe",
                  recurring_price_cents: 1000,
                  monthly_credits_cents: 4000,
                  storage_limit_bytes: 107374182400,
                  status: "active",
                  current_period_end: "2026-05-01T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const linkedOfferQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "studio__legacy_10",
            plan_id: "studio",
            offer_name: "Studio Legacy $10",
            stripe_price_id: "price_legacy_studio",
            recurring_price_cents: 1000,
            monthly_credits_cents: 4000,
            storage_limit_bytes: 107374182400,
            acquisition_enabled: false,
            is_active: true,
          },
          error: null,
        }),
      }),
    };
    const publicOfferQuery = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "studio__current",
                    plan_id: "studio",
                    offer_name: "Studio",
                    stripe_price_id: "price_current_studio",
                    recurring_price_cents: 3000,
                    monthly_credits_cents: 6000,
                    storage_limit_bytes: 107374182400,
                    acquisition_enabled: true,
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };
    const billingOfferSelectMock = vi
      .fn()
      .mockReturnValueOnce(linkedOfferQuery)
      .mockReturnValueOnce(publicOfferQuery);
    const storageAddonsQuery = {
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "addon-contract-1",
                storage_addon_id: "storage_25gb",
                offer_id: "storage_25gb__current",
                stripe_subscription_item_id: "si_123",
                stripe_price_id: "price_storage_25",
                storage_limit_bytes: 26843545600,
                quantity: 1,
                recurring_price_cents: 500,
                status: "active",
              },
            ],
            error: null,
          }),
        }),
      }),
    };
    const mediaFilesQuery = {
      eq: vi.fn().mockResolvedValue({
        data: [{ file_size: 5368709120 }],
        error: null,
      }),
    };
    const reservationsQuery = {
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "reservation-1",
                user_id: "11111111-1111-4111-8111-111111111111",
                source_ref: "source-ref-1",
                provider_request_id: "provider-req-1",
                created_at: "2026-04-15T00:00:00.000Z",
                metadata: {
                  pricing_observability: {
                    displayed_billed_credits: 10,
                    actual_billed_credits: 10,
                    delta_credits: 0,
                    mismatch: false,
                    pricing_display_source: "shared_adapter",
                    pricing_policy_ready: true,
                  },
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    };
    const ledgerQuery = {
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "ledger-1",
                user_id: "11111111-1111-4111-8111-111111111111",
                source_ref: "source-ref-1",
                created_at: "2026-04-15T00:05:00.000Z",
                metadata: {
                  pricing_observability: {
                    displayed_billed_credits: 10,
                    actual_billed_credits: 10,
                    delta_credits: 0,
                    mismatch: false,
                    pricing_display_source: "shared_adapter",
                    pricing_policy_ready: true,
                  },
                },
              },
            ],
            error: null,
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
          return { select: vi.fn().mockReturnValue(billingProfileQuery) };
        }
        if (table === "billing_subscription_contracts") {
          return { select: vi.fn().mockReturnValue(contractQuery) };
        }
        if (table === "billing_plan_offers") {
          return {
            select: billingOfferSelectMock,
          };
        }
        if (table === "billing_subscription_storage_addons") {
          return {
            select: vi.fn().mockReturnValue(storageAddonsQuery),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn().mockReturnValue(mediaFilesQuery),
          };
        }
        if (table === "ai_credit_reservations") {
          return {
            select: vi.fn().mockReturnValue(reservationsQuery),
          };
        }
        if (table === "ai_credit_ledger") {
          return {
            select: vi.fn().mockReturnValue(ledgerQuery),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
    stripeGetMock
      .mockResolvedValueOnce({
        id: "cus_123",
        email: "user@example.com",
        name: "User Example",
      })
      .mockResolvedValueOnce({
        id: "sub_123",
        status: "active",
        current_period_end: 1777593600,
        items: {
          data: [
            {
              price: {
                id: "price_legacy_studio",
                unit_amount: 1000,
                currency: "usd",
              },
            },
          ],
        },
      });

    const req = {
      method: "GET",
      query: { userId: "11111111-1111-4111-8111-111111111111" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          userId: "11111111-1111-4111-8111-111111111111",
          email: "user@example.com",
        },
        authIdentity: expect.objectContaining({
          userId: "11111111-1111-4111-8111-111111111111",
          email: "user@example.com",
        }),
        currentContract: expect.objectContaining({
          offerId: "studio__legacy_10",
          contractSource: "stripe",
          recurringPriceCents: 1000,
          storageLimitBytes: 107374182400,
        }),
        stripeCustomer: expect.objectContaining({
          configured: true,
          customerId: "cus_123",
          email: "user@example.com",
          name: "User Example",
        }),
        currentPublicOffer: expect.objectContaining({
          id: "studio__current",
          recurringPriceCents: 3000,
          storageLimitBytes: 107374182400,
        }),
        activeStorageAddons: expect.arrayContaining([
          expect.objectContaining({
            storageAddonId: "storage_25gb",
            storageLimitBytes: 26843545600,
            quantity: 1,
          }),
        ]),
        storageSummary: expect.objectContaining({
          usedBytes: 5368709120,
          baseLimitBytes: 107374182400,
          addonLimitBytes: 26843545600,
          totalLimitBytes: 134217728000,
          isOverLimit: false,
        }),
        stripeSubscription: expect.objectContaining({
          configured: true,
          subscriptionId: "sub_123",
          priceId: "price_legacy_studio",
          recurringPriceCents: 1000,
        }),
        pricingObservability: expect.objectContaining({
          rowsScanned: {
            reservations: 1,
            ledgerEntries: 1,
          },
          observedRows: {
            reservations: 1,
            ledgerEntries: 1,
          },
          mismatchCount: 0,
        }),
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "grandfathered_price_gap",
            severity: "info",
          }),
        ]),
      })
    );
  });

  it("returns mode-mismatch finding when Stripe returns test/live customer mismatch", async () => {
    type MockOfferQuery = {
      eq: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };

    const createOfferQuery = (data: Record<string, unknown> | null) => {
      const chain: MockOfferQuery = {
        eq: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn(),
      };
      const terminalResult = {
        data,
        error: null,
      };
      chain.eq.mockReturnValue(chain);
      chain.is.mockReturnValue(chain);
      chain.order.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.maybeSingle.mockResolvedValue(terminalResult);
      return chain;
    };

    const billingProfileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            plan_id: "studio",
            subscription_status: "active",
            stripe_customer_id: "cus_UOCazcmcfKm1nM",
            stripe_subscription_id: null,
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
                  id: "contract-mismatch",
                  plan_id: "studio",
                  offer_id: "studio__internal",
                  stripe_price_id: "price_live_studio",
                  stripe_subscription_id: null,
                  contract_source: "stripe",
                  recurring_price_cents: 1000,
                  monthly_credits_cents: 2000,
                  storage_limit_bytes: 10737418240,
                  status: "active",
                  current_period_end: "2026-05-01T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const linkedOfferQuery = {
      ...createOfferQuery({
        id: "studio__internal",
        plan_id: "studio",
        offer_name: "Studio",
        stripe_price_id: "price_live_studio",
        recurring_price_cents: 1000,
        monthly_credits_cents: 2000,
        storage_limit_bytes: 10737418240,
        acquisition_enabled: true,
        is_active: true,
      }),
    };
    const publicOfferQuery = {
      ...createOfferQuery({
        id: "studio__current",
        plan_id: "studio",
        offer_name: "Studio",
        stripe_price_id: "price_current_studio",
        recurring_price_cents: 3000,
        monthly_credits_cents: 4000,
        storage_limit_bytes: 10737418240,
        acquisition_enabled: true,
        is_active: true,
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-4", email: "mode-mismatch@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "billing_profiles") {
          return { select: vi.fn().mockReturnValue(billingProfileQuery) };
        }
        if (table === "billing_subscription_contracts") {
          return { select: vi.fn().mockReturnValue(contractQuery) };
        }
        if (table === "billing_plan_offers") {
          return {
            select: vi
              .fn()
              .mockReturnValueOnce(linkedOfferQuery)
              .mockReturnValueOnce(publicOfferQuery),
          };
        }
        if (table === "billing_subscription_storage_addons") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === "ai_credit_reservations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "ai_credit_ledger") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    stripeGetMock
      .mockRejectedValueOnce(
        new Error(
          "No such customer: 'cus_UOCazcmcfKm1nM'; a similar object exists in test mode, but a live mode key was used to make this request."
        )
      )
      .mockResolvedValueOnce({ data: [] });

    const req = {
      method: "GET",
      query: { userId: "44444444-4444-4444-8444-444444444444" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "stripe_customer_mode_mismatch",
          severity: "warning",
        }),
      ])
    );
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("treats internal-comp accounts with stale Stripe ids as non-fatal and warns", async () => {
    const createOfferQuery = (data: Record<string, unknown> | null) => {
      const chain: any = {};
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
      return chain;
    };

    const billingProfileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            plan_id: "business",
            subscription_status: "active",
            stripe_customer_id: "cus_UOCazcmcfKm1nM",
            stripe_subscription_id: null,
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
                  id: "contract-internal-comp",
                  plan_id: "business",
                  offer_id: "business__internal_comp",
                  stripe_price_id: null,
                  stripe_subscription_id: null,
                  contract_source: "internal_comp",
                  recurring_price_cents: 0,
                  monthly_credits_cents: 12000,
                  storage_limit_bytes: 536870912000,
                  status: "active",
                  current_period_end: "2026-05-01T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const linkedOfferQuery = createOfferQuery({
      id: "business__internal_comp",
      plan_id: "business",
      offer_name: "Business Internal Comp",
      stripe_price_id: null,
      recurring_price_cents: 0,
      monthly_credits_cents: 12000,
      storage_limit_bytes: 536870912000,
      acquisition_enabled: false,
      is_active: true,
    });
    const publicOfferQuery = createOfferQuery({
      id: "business__current",
      plan_id: "business",
      offer_name: "Business",
      stripe_price_id: "price_business",
      recurring_price_cents: 12900,
      monthly_credits_cents: 12000,
      storage_limit_bytes: 536870912000,
      acquisition_enabled: true,
      is_active: true,
    });
    const billingOfferSelectMock = vi
      .fn()
      .mockReturnValueOnce(linkedOfferQuery)
      .mockReturnValueOnce(publicOfferQuery);
    const storageAddonsQuery = {
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
    const mediaFilesQuery = {
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-5", email: "internal-mismatch@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "billing_profiles") {
          return { select: vi.fn().mockReturnValue(billingProfileQuery) };
        }
        if (table === "billing_subscription_contracts") {
          return { select: vi.fn().mockReturnValue(contractQuery) };
        }
        if (table === "billing_plan_offers") {
          return {
            select: billingOfferSelectMock,
          };
        }
        if (table === "billing_subscription_storage_addons") {
          return {
            select: vi.fn().mockReturnValue(storageAddonsQuery),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn().mockReturnValue(mediaFilesQuery),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
    stripeGetMock.mockRejectedValue(
      new Error(
        "No such customer: 'cus_UOCazcmcfKm1nM'; a similar object exists in test mode, but a live mode key was used to make this request."
      )
    );

    const req = {
      method: "GET",
      query: { userId: "55555555-5555-4555-8555-555555555555" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload.currentContract).toMatchObject({ contractSource: "internal_comp" });
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "stripe_customer_mode_mismatch",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "internal_comp_contract",
          severity: "info",
        }),
      ])
    );
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "stripe_subscription_not_found" })])
    );
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: "critical" })])
    );
  });

  it("treats internal comp contracts as valid non-Stripe access", async () => {
    const billingProfileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            plan_id: "business",
            subscription_status: "active",
            stripe_customer_id: null,
            stripe_subscription_id: null,
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
                  id: "contract-2",
                  plan_id: "business",
                  offer_id: "business__internal_comp",
                  stripe_price_id: null,
                  stripe_subscription_id: null,
                  contract_source: "internal_comp",
                  recurring_price_cents: 0,
                  monthly_credits_cents: 12000,
                  storage_limit_bytes: 536870912000,
                  status: "active",
                  current_period_end: "2026-05-01T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const linkedOfferQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "business__internal_comp",
            plan_id: "business",
            offer_name: "Business Internal Comp",
            stripe_price_id: null,
            recurring_price_cents: 0,
            monthly_credits_cents: 12000,
            storage_limit_bytes: 536870912000,
            acquisition_enabled: false,
            is_active: true,
          },
          error: null,
        }),
      }),
    };
    const publicOfferQuery = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "business__current",
                    plan_id: "business",
                    offer_name: "Business",
                    stripe_price_id: "price_business",
                    recurring_price_cents: 12900,
                    monthly_credits_cents: 12000,
                    storage_limit_bytes: 536870912000,
                    acquisition_enabled: true,
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };
    const billingOfferSelectMock = vi
      .fn()
      .mockReturnValueOnce(linkedOfferQuery)
      .mockReturnValueOnce(publicOfferQuery);
    const storageAddonsQuery = {
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
    const mediaFilesQuery = {
      eq: vi.fn().mockResolvedValue({
        data: [{ file_size: 2147483648 }],
        error: null,
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-2", email: "internal@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "billing_profiles") {
          return { select: vi.fn().mockReturnValue(billingProfileQuery) };
        }
        if (table === "billing_subscription_contracts") {
          return { select: vi.fn().mockReturnValue(contractQuery) };
        }
        if (table === "billing_plan_offers") {
          return {
            select: billingOfferSelectMock,
          };
        }
        if (table === "billing_subscription_storage_addons") {
          return {
            select: vi.fn().mockReturnValue(storageAddonsQuery),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn().mockReturnValue(mediaFilesQuery),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
    stripeGetMock.mockResolvedValue({ data: [] });

    const req = {
      method: "GET",
      query: { userId: "22222222-2222-4222-8222-222222222222" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        currentContract: expect.objectContaining({
          contractSource: "internal_comp",
          recurringPriceCents: 0,
          storageLimitBytes: 536870912000,
        }),
        storageSummary: expect.objectContaining({
          usedBytes: 2147483648,
          totalLimitBytes: 536870912000,
          isOverLimit: false,
        }),
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "internal_comp_contract",
            severity: "info",
          }),
        ]),
      })
    );
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_contract_price_id" })])
    );
  });

  it("falls back to plan storage entitlement when an internal comp contract snapshot stores zero", async () => {
    const billingProfileQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            plan_id: "business",
            subscription_status: "active",
            stripe_customer_id: null,
            stripe_subscription_id: null,
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
                  id: "contract-3",
                  plan_id: "business",
                  offer_id: "business__internal_comp",
                  stripe_price_id: null,
                  stripe_subscription_id: null,
                  contract_source: "internal_comp",
                  recurring_price_cents: 0,
                  monthly_credits_cents: 12000,
                  storage_limit_bytes: 0,
                  status: "active",
                  current_period_end: "2026-05-01T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const linkedOfferQuery = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "business__internal_comp",
            plan_id: "business",
            offer_name: "Business Internal Comp",
            stripe_price_id: null,
            recurring_price_cents: 0,
            monthly_credits_cents: 12000,
            storage_limit_bytes: 536870912000,
            acquisition_enabled: false,
            is_active: true,
          },
          error: null,
        }),
      }),
    };
    const publicOfferQuery = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "business__current",
                    plan_id: "business",
                    offer_name: "Business",
                    stripe_price_id: "price_business",
                    recurring_price_cents: 12900,
                    monthly_credits_cents: 12000,
                    storage_limit_bytes: 536870912000,
                    acquisition_enabled: true,
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };
    const billingOfferSelectMock = vi
      .fn()
      .mockReturnValueOnce(linkedOfferQuery)
      .mockReturnValueOnce(publicOfferQuery);
    const storageAddonsQuery = {
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
    const mediaFilesQuery = {
      eq: vi.fn().mockResolvedValue({
        data: [{ file_size: 6657199308 }],
        error: null,
      }),
    };

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-3", email: "repair@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "billing_profiles") {
          return { select: vi.fn().mockReturnValue(billingProfileQuery) };
        }
        if (table === "billing_subscription_contracts") {
          return { select: vi.fn().mockReturnValue(contractQuery) };
        }
        if (table === "billing_plan_offers") {
          return {
            select: billingOfferSelectMock,
          };
        }
        if (table === "billing_subscription_storage_addons") {
          return {
            select: vi.fn().mockReturnValue(storageAddonsQuery),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn().mockReturnValue(mediaFilesQuery),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
    stripeGetMock.mockResolvedValue({ data: [] });

    const req = {
      method: "GET",
      query: { userId: "33333333-3333-4333-8333-333333333333" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        currentContract: expect.objectContaining({
          contractSource: "internal_comp",
          storageLimitBytes: 0,
        }),
        linkedOffer: expect.objectContaining({
          storageLimitBytes: 536870912000,
        }),
        storageSummary: expect.objectContaining({
          usedBytes: 6657199308,
          baseLimitBytes: 536870912000,
          totalLimitBytes: 536870912000,
          isOverLimit: false,
        }),
      })
    );
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "storage_over_limit" })])
    );
  });
});

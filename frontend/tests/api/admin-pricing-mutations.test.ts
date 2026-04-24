import { beforeEach, describe, expect, it, vi } from "vitest";
import updateCreditPackageHandler from "../../pages/api/admin/pricing/credit-packages/update";
import createPlanOfferHandler from "../../pages/api/admin/pricing/plan-offers/create";
import createStorageOfferHandler from "../../pages/api/admin/pricing/storage-offers/create";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const isUniqueViolationErrorMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/billingContracts", () => ({
  isUniqueViolationError: (...args: unknown[]) => isUniqueViolationErrorMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("admin pricing mutation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    isUniqueViolationErrorMock.mockReturnValue(false);
  });

  it("updates a credit package", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_credit_packages") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "growth_2000" },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({
                error: null,
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const req = {
      method: "POST",
      body: {
        id: "growth_2000",
        displayName: "Growth 2,000",
        creditAmountCents: 2000,
        priceCents: 2600,
        stripePriceId: "price_growth_2000",
        isActive: true,
        sortOrder: 20,
      },
    };
    const res = createMockResponse();

    await updateCreditPackageHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      id: "growth_2000",
      message: "Credit package updated.",
    });
  });

  it("creates and activates the next plan offer", async () => {
    const disableCurrentOffer = vi.fn().mockResolvedValue({ error: null });
    const insertPlanOffer = vi.fn().mockResolvedValue({ error: null });

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "studio" },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "billing_plan_offers") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    is: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: {
                            id: "studio__current",
                            recurring_price_cents: 3900,
                            monthly_credits_cents: 3000,
                            storage_limit_bytes: 107374182400,
                            stripe_price_id: "price_studio_current",
                          },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: disableCurrentOffer,
            }),
            insert: insertPlanOffer,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    const req = {
      method: "POST",
      body: {
        planId: "studio",
        offerName: "Studio Admin Offer",
        recurringPriceCents: 4900,
        monthlyCreditsCents: 3500,
        storageLimitBytes: 107374182400,
        stripePriceId: "price_studio_admin",
      },
    };
    const res = createMockResponse();

    await createPlanOfferHandler(req as never, res as never);

    expect(disableCurrentOffer).toHaveBeenCalled();
    expect(insertPlanOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "studio",
        offer_name: "Studio Admin Offer",
        recurring_price_cents: 4900,
        monthly_credits_cents: 3500,
        stripe_price_id: "price_studio_admin",
        acquisition_enabled: true,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: "Plan offer created and activated.",
        id: expect.any(String),
      })
    );
  });

  it("creates and activates the next storage add-on offer", async () => {
    const disableCurrentOffer = vi.fn().mockResolvedValue({ error: null });
    const insertStorageOffer = vi.fn().mockResolvedValue({ error: null });

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_storage_addons") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "storage_25gb" },
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
                  eq: () => ({
                    is: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: {
                            id: "storage_25gb__current",
                            storage_limit_bytes: 26843545600,
                            recurring_price_cents: 500,
                            stripe_price_id: "price_storage_current",
                          },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: disableCurrentOffer,
            }),
            insert: insertStorageOffer,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    const req = {
      method: "POST",
      body: {
        storageAddonId: "storage_25gb",
        offerName: "Extra 25 GB Admin Offer",
        storageLimitBytes: 26843545600,
        recurringPriceCents: 700,
        stripePriceId: "price_storage_admin",
      },
    };
    const res = createMockResponse();

    await createStorageOfferHandler(req as never, res as never);

    expect(disableCurrentOffer).toHaveBeenCalled();
    expect(insertStorageOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_addon_id: "storage_25gb",
        offer_name: "Extra 25 GB Admin Offer",
        recurring_price_cents: 700,
        stripe_price_id: "price_storage_admin",
        acquisition_enabled: true,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: "Storage add-on offer created and activated.",
        id: expect.any(String),
      })
    );
  });
});

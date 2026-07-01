import { beforeEach, describe, expect, it, vi } from "vitest";
import updateCreditPackageHandler from "../../pages/api/admin/pricing/credit-packages/update";
import createPlanHandler from "../../pages/api/admin/pricing/plans/create";
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

const stripePostFormMock = vi.fn();
const stripeGetMock = vi.fn();

vi.mock("../../lib/server/api/stripe", () => ({
  stripePostForm: (...args: unknown[]) => stripePostFormMock(...args),
  stripeGet: (...args: unknown[]) => stripeGetMock(...args),
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
    stripePostFormMock.mockReset();
    stripeGetMock.mockResolvedValue({
      id: "price_valid",
      active: true,
      currency: "usd",
      unit_amount: 2600,
      recurring: null,
      metadata: {},
      product: { id: "prod_valid", metadata: {} },
    });
  });

  it("does not mutate credit packages when admin auth verification throws unexpectedly", async () => {
    requireAdminUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
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

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/pricing/credit-packages/update.auth",
      metadata: {
        source: "api.admin.pricing.credit-packages.update",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to update the credit package.",
    });
  });

  it("does not create plan offers when admin auth verification throws unexpectedly", async () => {
    requireAdminUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        planId: "studio",
        offerName: "Studio Admin Offer",
        recurringPriceCents: 4900,
        monthlyCreditsCents: 3500,
        storageLimitBytes: 107374182400,
        maxConcurrentGenerations: 4,
        stripePriceId: "price_studio_admin",
      },
    };
    const res = createMockResponse();

    await createPlanOfferHandler(req as never, res as never);

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/pricing/plan-offers/create.auth",
      metadata: {
        source: "api.admin.pricing.plan-offers.create",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to create the next plan offer.",
    });
  });

  it("does not create plans when admin auth verification throws unexpectedly", async () => {
    requireAdminUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        planId: "creator",
        displayName: "Creator",
        recurringPriceCents: 5900,
        annualRecurringPriceCents: 59000,
        monthlyCreditsCents: 4500,
        storageLimitBytes: 214748364800,
        maxConcurrentGenerations: 6,
        sortOrder: 40,
      },
    };
    const res = createMockResponse();

    await createPlanHandler(req as never, res as never);

    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/pricing/plans/create.auth",
      metadata: {
        source: "api.admin.pricing.plans.create",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to create the plan.",
    });
  });

  it("does not create storage offers when admin auth verification throws unexpectedly", async () => {
    requireAdminUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        storageAddonId: "storage_10gb",
        offerName: "Extra 10 GB Admin Offer",
        storageLimitBytes: 10737418240,
        recurringPriceCents: 700,
        stripePriceId: "price_storage_admin",
      },
    };
    const res = createMockResponse();

    await createStorageOfferHandler(req as never, res as never);

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/pricing/storage-offers/create.auth",
      metadata: {
        source: "api.admin.pricing.storage-offers.create",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to create the next storage add-on offer.",
    });
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
    stripeGetMock.mockResolvedValueOnce({
      id: "price_growth_2000",
      active: true,
      currency: "usd",
      unit_amount: 2600,
      recurring: null,
      metadata: {
        shortpulse_catalog_type: "credit_package",
        shortpulse_credit_package_id: "growth_2000",
      },
      product: { id: "prod_growth", metadata: {} },
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
    const activateOffer = vi.fn().mockResolvedValue({
      data: [
        {
          status: "activated",
          offer_id: "studio__month__studio_admin_offer__abc",
          message: "Plan offer created and activated.",
        },
      ],
      error: null,
    });
    stripeGetMock.mockResolvedValueOnce({
      id: "price_studio_admin",
      active: true,
      currency: "usd",
      unit_amount: 4900,
      recurring: { interval: "month" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "studio",
      },
      product: { id: "prod_studio", metadata: {} },
    });

    getSupabaseAdminMock.mockReturnValue({
      rpc: activateOffer,
    });

    const req = {
      method: "POST",
      body: {
        planId: "studio",
        offerName: "Studio Admin Offer",
        recurringPriceCents: 4900,
        monthlyCreditsCents: 3500,
        storageLimitBytes: 107374182400,
        maxConcurrentGenerations: 4,
        stripePriceId: "price_studio_admin",
        expectedCurrentOfferId: "studio__current",
      },
    };
    const res = createMockResponse();

    await createPlanOfferHandler(req as never, res as never);

    expect(stripeGetMock).toHaveBeenCalledWith("/prices/price_studio_admin", {
      "expand[]": "product",
    });
    expect(activateOffer).toHaveBeenCalledWith(
      "activate_billing_plan_offer",
      expect.objectContaining({
        p_plan_id: "studio",
        p_offer_name: "Studio Admin Offer",
        p_recurring_price_cents: 4900,
        p_monthly_credits_cents: 3500,
        p_max_concurrent_generations: 4,
        p_stripe_price_id: "price_studio_admin",
        p_expected_current_offer_id: "studio__current",
        p_expected_current_offer_absent: false,
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

  it("rejects zero-price paid-plan offers before activation", async () => {
    const req = {
      method: "POST",
      body: {
        planId: "studio",
        offerName: "Studio Zero-Price Admin Offer",
        recurringPriceCents: 0,
        monthlyCreditsCents: 3500,
        storageLimitBytes: 107374182400,
        maxConcurrentGenerations: 4,
        stripePriceId: "",
      },
    };
    const res = createMockResponse();

    await createPlanOfferHandler(req as never, res as never);

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Paid public plan offers must be greater than $0.",
    });
  });

  it("creates a new plan with initial offer and Stripe linkage", async () => {
    const insertPlan = vi.fn().mockResolvedValue({ error: null });
    const insertOffer = vi.fn().mockResolvedValue({ error: null });

    stripePostFormMock
      .mockResolvedValueOnce({ id: "prod_plan_creator" })
      .mockResolvedValueOnce({ id: "price_plan_creator_month" })
      .mockResolvedValueOnce({ id: "price_plan_creator_year" });

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: () => ({
              or: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
            insert: insertPlan,
          };
        }

        if (table === "billing_plan_offers") {
          return {
            insert: insertOffer,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    const req = {
      method: "POST",
      body: {
        planId: "creator",
        displayName: "Creator",
        recurringPriceCents: 5900,
        annualRecurringPriceCents: 59000,
        monthlyCreditsCents: 4500,
        storageLimitBytes: 214748364800,
        maxConcurrentGenerations: 6,
        sortOrder: 40,
      },
    };
    const res = createMockResponse();

    await createPlanHandler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenNthCalledWith(
      1,
      "/products",
      expect.objectContaining({
        name: "Plan - Creator",
        "metadata[shortpulse_plan_id]": "creator",
      })
    );
    expect(stripePostFormMock).toHaveBeenNthCalledWith(
      2,
      "/prices",
      expect.objectContaining({
        product: "prod_plan_creator",
        unit_amount: 5900,
        "recurring[interval]": "month",
      })
    );
    expect(stripePostFormMock).toHaveBeenNthCalledWith(
      3,
      "/prices",
      expect.objectContaining({
        product: "prod_plan_creator",
        unit_amount: 59000,
        "recurring[interval]": "year",
      })
    );
    expect(insertPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "creator",
        display_name: "Creator",
        sort_order: 40,
        stripe_product_id: "prod_plan_creator",
        stripe_price_id: "price_plan_creator_month",
      })
    );
    expect(insertOffer).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "creator__current",
        plan_id: "creator",
        offer_name: "Creator Monthly Current Offer",
        billing_interval: "month",
        max_concurrent_generations: 6,
        stripe_price_id: "price_plan_creator_month",
      }),
      expect.objectContaining({
        id: "creator__year_current",
        plan_id: "creator",
        offer_name: "Creator Annual Current Offer",
        billing_interval: "year",
        recurring_price_cents: 59000,
        max_concurrent_generations: 6,
        stripe_price_id: "price_plan_creator_year",
      }),
    ]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        planId: "creator",
        offerId: "creator__current",
        annualOfferId: "creator__year_current",
        stripeProductId: "prod_plan_creator",
        stripePriceId: "price_plan_creator_month",
        annualStripePriceId: "price_plan_creator_year",
      })
    );
  });

  it("rejects zero-price paid-plan creation before creating Stripe artifacts", async () => {
    const req = {
      method: "POST",
      body: {
        planId: "creator",
        displayName: "Creator",
        recurringPriceCents: 0,
        annualRecurringPriceCents: 0,
        monthlyCreditsCents: 4500,
        storageLimitBytes: 214748364800,
        maxConcurrentGenerations: 6,
        sortOrder: 40,
      },
    };
    const res = createMockResponse();

    await createPlanHandler(req as never, res as never);

    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Paid public plans require monthly and annual prices greater than $0.",
    });
  });

  it("passes expected-empty state for first annual plan offer creation", async () => {
    const activateOffer = vi.fn().mockResolvedValue({
      data: [
        {
          status: "activated",
          offer_id: "creator__year__creator_annual_admin_offer__abc",
          message: "Plan offer created and activated.",
        },
      ],
      error: null,
    });
    stripeGetMock.mockResolvedValueOnce({
      id: "price_creator_annual",
      active: true,
      currency: "usd",
      unit_amount: 59000,
      recurring: { interval: "year" },
      metadata: {
        shortpulse_catalog_type: "plan",
        shortpulse_plan_id: "creator",
      },
      product: { id: "prod_creator", metadata: {} },
    });
    getSupabaseAdminMock.mockReturnValue({
      rpc: activateOffer,
    });

    const req = {
      method: "POST",
      body: {
        planId: "creator",
        offerName: "Creator Annual Admin Offer",
        billingInterval: "year",
        recurringPriceCents: 59000,
        monthlyCreditsCents: 4500,
        storageLimitBytes: 214748364800,
        maxConcurrentGenerations: 6,
        stripePriceId: "price_creator_annual",
        expectedCurrentOfferId: null,
        expectedCurrentOfferAbsent: true,
      },
    };
    const res = createMockResponse();

    await createPlanOfferHandler(req as never, res as never);

    expect(activateOffer).toHaveBeenCalledWith(
      "activate_billing_plan_offer",
      expect.objectContaining({
        p_billing_interval: "year",
        p_max_concurrent_generations: 6,
        p_expected_current_offer_id: null,
        p_expected_current_offer_absent: true,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("creates and activates the next storage add-on offer", async () => {
    const activateStorageOffer = vi.fn().mockResolvedValue({
      data: [
        {
          status: "activated",
          offer_id: "storage_10gb__month__extra_10_gb_admin_offer__abc",
          message: "Storage add-on offer created and activated.",
        },
      ],
      error: null,
    });
    stripeGetMock.mockResolvedValueOnce({
      id: "price_storage_admin",
      active: true,
      currency: "usd",
      unit_amount: 700,
      recurring: { interval: "month" },
      metadata: {
        shortpulse_catalog_type: "storage_addon",
        shortpulse_storage_addon_id: "storage_10gb",
      },
      product: { id: "prod_storage", metadata: {} },
    });

    getSupabaseAdminMock.mockReturnValue({
      rpc: activateStorageOffer,
    });

    const req = {
      method: "POST",
      body: {
        storageAddonId: "storage_10gb",
        offerName: "Extra 10 GB Admin Offer",
        storageLimitBytes: 10737418240,
        recurringPriceCents: 700,
        stripePriceId: "price_storage_admin",
        expectedCurrentOfferId: "storage_10gb__current",
      },
    };
    const res = createMockResponse();

    await createStorageOfferHandler(req as never, res as never);

    expect(stripeGetMock).toHaveBeenCalledWith("/prices/price_storage_admin", {
      "expand[]": "product",
    });
    expect(activateStorageOffer).toHaveBeenCalledWith(
      "activate_billing_storage_addon_offer",
      expect.objectContaining({
        p_storage_addon_id: "storage_10gb",
        p_offer_name: "Extra 10 GB Admin Offer",
        p_recurring_price_cents: 700,
        p_stripe_price_id: "price_storage_admin",
        p_expected_current_offer_id: "storage_10gb__current",
        p_expected_current_offer_absent: false,
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

  it("rejects manual-review storage add-ons before public offer activation", async () => {
    const req = {
      method: "POST",
      body: {
        storageAddonId: "storage_500gb",
        offerName: "Extra 500 GB Admin Offer",
        storageLimitBytes: 536870912000,
        recurringPriceCents: 29900,
        stripePriceId: "price_storage_500",
      },
    };
    const res = createMockResponse();

    await createStorageOfferHandler(req as never, res as never);

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Manual-review storage add-ons cannot be activated as public self-serve offers.",
    });
  });
});

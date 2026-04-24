import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/pricing/state";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const listModelConfigsMock = vi.fn();
const buildDefaultPricingParamsMock = vi.fn();
const computeCostForModelMock = vi.fn();
const getModelPricingPolicySnapshotMock = vi.fn();
const resolveModelCreditRoundingModeMock = vi.fn();
const resolveRuntimeModelPricingPolicyMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/modelPricingControlPlane", () => ({
  resolveRuntimeModelPricingPolicy: (...args: unknown[]) =>
    resolveRuntimeModelPricingPolicyMock(...args),
}));

vi.mock("../../lib/model-runtime/pricing", () => ({
  listModelConfigs: (...args: unknown[]) => listModelConfigsMock(...args),
  buildDefaultPricingParams: (...args: unknown[]) => buildDefaultPricingParamsMock(...args),
  computeCostForModel: (...args: unknown[]) => computeCostForModelMock(...args),
}));

vi.mock("../../lib/model-runtime/pricingPolicy", () => ({
  getModelPricingPolicySnapshot: (...args: unknown[]) => getModelPricingPolicySnapshotMock(...args),
}));

vi.mock("../../lib/model-runtime/pricingCredits", () => ({
  resolveModelCreditRoundingMode: (...args: unknown[]) =>
    resolveModelCreditRoundingModeMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/admin/pricing/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    listModelConfigsMock.mockReturnValue([
      {
        id: "fal-ai/flux-2/klein/9b",
        label: "FLUX.2 Lite",
        provider: "fal",
        mediaType: "image",
        pricingStrategy: "fal-economy-image-per-mp",
        defaultAspect: "4:3",
        defaultResolution: "model_default",
        defaultDurationSeconds: undefined,
      },
    ]);
    buildDefaultPricingParamsMock.mockReturnValue({ aspect: "4:3" });
    computeCostForModelMock.mockReturnValue({
      credits: 10,
      usd: 0.1,
      rawCredits: 8,
      usdRaw: 0.08,
      megapixels: 1,
      width: 1024,
      height: 768,
    });
    resolveRuntimeModelPricingPolicyMock.mockResolvedValue({
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          markupBps: 300,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
          exceptionRoundingModelIds: ["fal-ai/flux-2/klein/9b"],
        },
        perModel: {},
      },
      activePolicyVersion: 3,
      activePolicyVersionId: 33,
      source: "control_plane",
      updatedAt: "2026-04-24T12:00:00.000Z",
      updatedByEmail: "admin@example.com",
    });
    getModelPricingPolicySnapshotMock.mockReturnValue({
      version: "policy-v3",
      activePolicyVersion: 3,
      policySource: "control_plane",
      updatedAt: "2026-04-24T12:00:00.000Z",
      updatedByEmail: "admin@example.com",
      creditUsdScale: 100,
      creditValueUsd: 0.01,
      markupBps: 300,
      markupPercent: 3,
      defaultRoundingMode: "nearest-5",
      defaultRoundingIncrement: 5,
      exceptionRoundingModelIds: ["fal-ai/flux-2/klein/9b"],
      overrideCount: 0,
      document: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          markupBps: 300,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
          exceptionRoundingModelIds: ["fal-ai/flux-2/klein/9b"],
        },
        perModel: {},
      },
    });
    resolveModelCreditRoundingModeMock.mockReturnValue("ceil");
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns current model pricing policy and active catalog rows", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ id: "studio", display_name: "Studio", is_active: true }],
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
                            id: "studio__current",
                            plan_id: "studio",
                            recurring_price_cents: 3900,
                            monthly_credits_cents: 3000,
                            storage_limit_bytes: 107374182400,
                            stripe_price_id: "price_plan_studio",
                            acquisition_enabled: true,
                            is_active: true,
                            effective_start_at: "2026-04-01T00:00:00.000Z",
                            created_at: "2026-04-01T00:00:00.000Z",
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
                      stripe_price_id: null,
                      sort_order: 20,
                      is_active: true,
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
              eq: async () => ({
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
                            id: "storage_25gb__current",
                            storage_addon_id: "storage_25gb",
                            storage_limit_bytes: 26843545600,
                            recurring_price_cents: 500,
                            stripe_price_id: "price_storage_25",
                            acquisition_enabled: true,
                            is_active: true,
                            effective_start_at: "2026-04-01T00:00:00.000Z",
                            created_at: "2026-04-01T00:00:00.000Z",
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
    expect(resolveRuntimeModelPricingPolicyMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPolicy: expect.objectContaining({
          markupPercent: 3,
          creditUsdScale: 100,
          policySource: "control_plane",
        }),
        models: [
          expect.objectContaining({
            id: "fal-ai/flux-2/klein/9b",
            roundingMode: "ceil",
            pricingPreview: expect.objectContaining({
              billedCredits: 10,
              usdRaw: 0.08,
            }),
          }),
        ],
        plans: [
          expect.objectContaining({
            planId: "studio",
            stripePriceId: "price_plan_studio",
          }),
        ],
        creditPackages: [
          expect.objectContaining({
            id: "growth_2000",
            stripePriceId: null,
          }),
        ],
        storageAddons: [
          expect.objectContaining({
            storageAddonId: "storage_25gb",
            stripePriceId: "price_storage_25",
          }),
        ],
        health: expect.objectContaining({
          creditPackagesMissingStripePriceIds: 1,
          totalWarnings: 1,
        }),
      })
    );
  });
});

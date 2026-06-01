import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/pricing/state";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const listModelConfigsMock = vi.fn();
const listPricingModelConfigsMock = vi.fn();
const buildDefaultPricingParamsMock = vi.fn();
const computeCostForModelMock = vi.fn();
const getModelPricingPolicySnapshotMock = vi.fn();
const resolveModelPricingForModelMock = vi.fn();
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
  buildDefaultPricingParams: (...args: unknown[]) => buildDefaultPricingParamsMock(...args),
  computeCostForModel: (...args: unknown[]) => computeCostForModelMock(...args),
}));

vi.mock("../../lib/model-runtime/modelRegistry", () => ({
  listModelConfigs: (...args: unknown[]) => listModelConfigsMock(...args),
  listPricingModelConfigs: (...args: unknown[]) => listPricingModelConfigsMock(...args),
}));

vi.mock("../../lib/model-runtime/pricingPolicy", () => ({
  getModelPricingPolicySnapshot: (...args: unknown[]) => getModelPricingPolicySnapshotMock(...args),
  resolveModelPricingForModel: (...args: unknown[]) => resolveModelPricingForModelMock(...args),
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
        id: "gpt-image-2",
        label: "GPT Image 2",
        provider: "openai",
        sourceUrl: "https://developers.openai.com/api/docs/models/gpt-image-2",
        mediaType: "image",
        supportsTextToImage: true,
        supportsImageToImage: true,
        pricingStrategy: "gpt-image-2-per-image",
        defaultAspect: "1:1",
        defaultResolution: "medium",
        defaultDurationSeconds: undefined,
      },
    ]);
    listPricingModelConfigsMock.mockImplementation(() => listModelConfigsMock());
    buildDefaultPricingParamsMock.mockImplementation((modelId: string, overrides = {}) => ({
      aspect: "1:1",
      resolution: "medium",
      ...overrides,
      modelId,
    }));
    computeCostForModelMock.mockImplementation(
      (_modelId: string, params: Record<string, unknown>) =>
        params.inputImageCount
          ? {
              credits: 15,
              usd: 0.15,
              rawCredits: 12,
              usdRaw: 0.12,
            }
          : {
              credits: 10,
              usd: 0.1,
              rawCredits: 8,
              usdRaw: 0.08,
            }
    );
    resolveRuntimeModelPricingPolicyMock.mockResolvedValue({
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
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
      defaultRoundingMode: "ceil",
      defaultRoundingIncrement: 1,
      overrideCount: 0,
      document: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {},
      },
    });
    resolveModelPricingForModelMock.mockReturnValue({
      creditUsdScale: 100,
      roundingMode: "ceil",
      roundingIncrement: 1,
    });
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
    listModelConfigsMock.mockReturnValue([
      {
        id: "kie-kling-3",
        label: "Kling 3.0",
        provider: "kie",
        sourceUrl: "https://docs.kie.ai/",
        mediaType: "video",
        supportsTextToImage: true,
        supportsImageToImage: false,
        pricingStrategy: "kie-video-per-second",
        defaultAspect: "16:9",
        defaultResolution: "720",
        defaultDurationSeconds: 5,
      },
      {
        id: "bria-background-remove",
        label: "Bria Background Remove",
        provider: "fal",
        sourceUrl: "https://fal.ai/models/fal-ai/bria/background/remove/api",
        mediaType: "image",
        supportsTextToImage: false,
        supportsImageToImage: true,
        pricingStrategy: "fal-economy-image-per-mp",
        defaultAspect: "1:1",
        defaultResolution: "model_default",
        defaultDurationSeconds: undefined,
      },
      {
        id: "gpt-image-2",
        label: "GPT Image 2",
        provider: "openai",
        sourceUrl: "https://developers.openai.com/api/docs/models/gpt-image-2",
        mediaType: "image",
        supportsTextToImage: true,
        supportsImageToImage: true,
        pricingStrategy: "gpt-image-2-per-image",
        defaultAspect: "1:1",
        defaultResolution: "medium",
        defaultDurationSeconds: undefined,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: async () => ({
              data: [
                {
                  id: "studio",
                  display_name: "Studio",
                  is_active: true,
                  monthly_price_cents: 3900,
                  monthly_credits_cents: 3000,
                  storage_limit_bytes: 107374182400,
                  stripe_price_id: "price_plan_studio",
                  sort_order: 20,
                  stripe_product_id: "prod_plan_studio",
                },
              ],
              error: null,
            }),
          };
        }

        if (table === "billing_plan_offers") {
          return {
            select: () => ({
              order: () => ({
                order: async () => ({
                  data: [
                    {
                      id: "studio__current",
                      plan_id: "studio",
                      billing_interval: "month",
                      recurring_price_cents: 3900,
                      monthly_credits_cents: 3000,
                      storage_limit_bytes: 107374182400,
                      stripe_price_id: "price_plan_studio",
                      acquisition_enabled: true,
                      is_active: true,
                      effective_start_at: "2026-04-01T00:00:00.000Z",
                      created_at: "2026-04-01T00:00:00.000Z",
                    },
                    {
                      id: "studio__year_current",
                      plan_id: "studio",
                      billing_interval: "year",
                      recurring_price_cents: 39000,
                      monthly_credits_cents: 3000,
                      storage_limit_bytes: 107374182400,
                      stripe_price_id: null,
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
          };
        }

        if (table === "billing_credit_packages") {
          return {
            select: () => ({
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
                  {
                    id: "starter_500",
                    display_name: "Starter 500",
                    credit_amount_cents: 500,
                    price_cents: 900,
                    stripe_price_id: null,
                    sort_order: 30,
                    is_active: false,
                  },
                ],
                error: null,
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

        if (table === "billing_subscription_contracts") {
          return {
            select: () => ({
              is: async () => ({
                data: [
                  {
                    user_id: "user-1",
                    plan_id: "studio",
                    recurring_price_cents: 3900,
                  },
                  {
                    user_id: "user-2",
                    plan_id: "studio",
                    recurring_price_cents: 3900,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "billing_profiles") {
          return {
            select: async () => ({
              data: [
                {
                  user_id: "user-3",
                  plan_id: "studio",
                },
              ],
              error: null,
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
    expect(resolveRuntimeModelPricingPolicyMock).toHaveBeenCalledWith({ bypassCache: true });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPolicy: expect.objectContaining({
          creditUsdScale: 100,
          policySource: "control_plane",
        }),
        models: expect.arrayContaining([
          expect.objectContaining({
            id: "gpt-image-2",
            workflowType: "Text + image edit",
            pricingStrategyLabel: "Per image",
            roundingIncrement: 1,
            pricingPreview: expect.objectContaining({
              billedCredits: 10,
              usdRaw: 0.08,
            }),
            pricingPreviewVariants: [
              expect.objectContaining({
                id: "create",
                label: "Create",
                breakdown: expect.objectContaining({
                  billedCredits: 10,
                }),
              }),
              expect.objectContaining({
                id: "edit",
                label: "Edit",
                breakdown: expect.objectContaining({
                  billedCredits: 15,
                }),
              }),
            ],
          }),
        ]),
        plans: [
          expect.objectContaining({
            planId: "studio",
            accountCount: 3,
            status: "active",
            sortOrder: 20,
            stripeProductId: "prod_plan_studio",
            stripePriceId: "price_plan_studio",
          }),
        ],
        creditPackages: [
          expect.objectContaining({
            id: "growth_2000",
            stripePriceId: null,
          }),
          expect.objectContaining({
            id: "starter_500",
            isActive: false,
          }),
        ],
        storageAddons: [
          expect.objectContaining({
            storageAddonId: "storage_25gb",
            stripePriceId: "price_storage_25",
          }),
          expect.objectContaining({
            storageAddonId: "storage_100gb",
            offerId: null,
            stripePriceId: null,
          }),
        ],
        health: expect.objectContaining({
          planOffersMissingStripePriceIds: 1,
          creditPackagesMissingStripePriceIds: 1,
          storageOffersMissingStripePriceIds: 0,
          totalWarnings: 3,
        }),
      })
    );
    const payload = res.json.mock.calls[0]?.[0] as {
      models: Array<{ id: string }>;
      health: { warnings: string[] };
    };
    expect(payload.models.map((model) => model.id)).toEqual([
      "kie-kling-3",
      "bria-background-remove",
      "gpt-image-2",
    ]);
    expect(payload.health.warnings).toContain(
      "1 active storage add-on missing a current public offer."
    );
  });
});

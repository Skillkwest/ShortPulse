import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/pricing/state";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "../../lib/model-runtime/falModelIds";
import {
  KIE_KLING_30_MOTION_CONTROL_LABEL,
  KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
} from "../../lib/model-runtime/klingMotionControlPricing";
import {
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_LABEL,
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_LABEL,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
} from "../../lib/model-runtime/elevenLabsModels";
import { KIE_KLING_30_MODEL_ID } from "../../lib/model-runtime/providerModelIds";

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
  getModelConfig: (modelId: string) =>
    listModelConfigsMock().find((model: { id: string }) => model.id === modelId) ?? null,
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
        id: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
        label: "Sound Effects",
        provider: "elevenlabs",
        sourceUrl: "https://elevenlabs.io/docs/overview/models",
        mediaType: "audio",
        supportsTextToImage: false,
        supportsImageToImage: false,
        pricingStrategy: "elevenlabs-sound-effect",
        defaultAspect: "audio",
        defaultResolution: null,
        defaultDurationSeconds: undefined,
        defaultGenerationCount: 1,
      },
      {
        id: "kie-ai/gpt-image-2-text-to-image",
        label: "GPT Image 2 (Kie)",
        provider: "kie",
        sourceUrl: "https://docs.kie.ai/",
        mediaType: "image",
        supportsTextToImage: true,
        supportsImageToImage: false,
        pricingStrategy: "kie-gpt-image-2-per-image",
        defaultAspect: "1:1",
        defaultResolution: "1K",
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

  it("returns a safe pricing-state failure when admin auth verification throws unexpectedly", async () => {
    requireAdminUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(resolveRuntimeModelPricingPolicyMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/pricing/state.auth",
      metadata: {
        source: "api.admin.pricing.state",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load pricing state." });
  });

  it("returns current model pricing policy and active catalog rows", async () => {
    listModelConfigsMock.mockReturnValue([
      {
        id: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0",
        provider: "kie",
        sourceUrl: "https://docs.kie.ai/",
        mediaType: "video",
        supportsTextToImage: true,
        supportsImageToImage: false,
        pricingStrategy: "kling-3-per-second",
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
        id: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
        label: "Sound Effects",
        provider: "elevenlabs",
        sourceUrl: "https://elevenlabs.io/docs/overview/models",
        mediaType: "audio",
        supportsTextToImage: false,
        supportsImageToImage: false,
        pricingStrategy: "elevenlabs-sound-effect",
        defaultAspect: "audio",
        defaultResolution: null,
        defaultDurationSeconds: undefined,
        defaultGenerationCount: 1,
      },
      {
        id: "kie-ai/gpt-image-2-text-to-image",
        label: "GPT Image 2 (Kie)",
        provider: "kie",
        sourceUrl: "https://docs.kie.ai/",
        mediaType: "image",
        supportsTextToImage: true,
        supportsImageToImage: false,
        pricingStrategy: "kie-gpt-image-2-per-image",
        defaultAspect: "1:1",
        defaultResolution: "1K",
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
                  max_concurrent_generations: 4,
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
                      max_concurrent_generations: 4,
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
                      max_concurrent_generations: 4,
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
                    id: "1200",
                    display_name: "1,200 credits",
                    credit_amount_cents: 1200,
                    price_cents: 4900,
                    stripe_price_id: null,
                    sort_order: 20,
                    is_active: true,
                  },
                  {
                    id: "100",
                    display_name: "100 credits",
                    credit_amount_cents: 100,
                    price_cents: 500,
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
        plans: [
          expect.objectContaining({
            planId: "studio",
            accountCount: 3,
            status: "active",
            sortOrder: 20,
            stripeProductId: "prod_plan_studio",
            stripePriceId: "price_plan_studio",
            maxConcurrentGenerations: 4,
          }),
        ],
        creditPackages: [
          expect.objectContaining({
            id: "1200",
            stripePriceId: null,
          }),
          expect.objectContaining({
            id: "100",
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
      models: Array<{
        id: string;
        pricingPreviewVariants?: Array<{ id: string; label: string }>;
      }>;
      customRows: {
        rowsByModel: Record<
          string,
          Array<{ displayRowId: string; label: string | null; variantId: string }>
        >;
      };
      health: { warnings: string[] };
    };
    expect(payload.models).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "gpt-image-2" })])
    );
    expect(payload.models.map((model) => model.id)).toEqual([
      KIE_KLING_30_MODEL_ID,
      "bria-background-remove",
      ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
      "kie-ai/gpt-image-2-text-to-image",
    ]);
    expect(
      payload.models.find((model) => model.id === KIE_KLING_30_MODEL_ID)?.pricingPreviewVariants
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "default", label: "Standard" }),
        expect.objectContaining({
          id: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
          label: KIE_KLING_30_MOTION_CONTROL_LABEL,
        }),
      ])
    );
    expect(
      payload.models.find((model) => model.id === ELEVENLABS_SOUND_EFFECTS_MODEL_ID)
        ?.pricingPreviewVariants
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `${ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID}|aspect:audio`,
          label: ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_LABEL,
        }),
        expect.objectContaining({
          id: `${ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID}|aspect:audio`,
          label: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_LABEL,
        }),
      ])
    );
    expect(payload.customRows.rowsByModel[FAL_FLUX_2_KLEIN_9B_MODEL_ID]).toEqual([
      expect.objectContaining({
        displayRowId: "builtin:flux-2-klein-audio-companion-art",
        label: "Sound reference background companion art",
        variantId: `${FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
      }),
      expect.objectContaining({
        displayRowId: "builtin:flux-2-klein-style-preview",
        label: "Text-only style creation generation",
        variantId: `${FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
      }),
    ]);
    expect(payload.health.warnings).toContain(
      "1 active storage add-on missing a current public offer."
    );
  });
});

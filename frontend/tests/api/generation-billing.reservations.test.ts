import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeCostForModel } from "../../lib/model-runtime/pricing";
import {
  getDefaultModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import { resolveCreateImageBilledCreditLookup } from "../../lib/model-runtime/createImageBilledCredits";
import { resolveEditImageBilledCreditLookup } from "../../lib/model-runtime/editImageBilledCredits";
import { resolvePricingGridCostBreakdown } from "../../lib/model-runtime/pricingGridBilledCredits";
import { resolveVideoBilledCreditLookup } from "../../lib/model-runtime/videoBilledCredits";
import { materializeImageBilledCreditPolicy } from "../../lib/model-runtime/materializeImageBilledCreditPolicy";
import { KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } from "../../lib/model-runtime/klingMotionControlPricing";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../lib/model-runtime/providerModelIds";
import {
  ADMISSION_LIMITED_TELEMETRY_SOURCE,
  DIRECT_SUBMIT_ADMISSION_LIMITED_TELEMETRY_SOURCE,
} from "../../lib/server/api/errorTelemetryPolicy";
import { chargeGenerationRequest } from "../../lib/server/api/generationBilling";
import { buildPricingParams } from "../../lib/server/api/generationBilling/pricingParams";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const insertCreditLedgerEntryMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const resolveRuntimeModelPricingPolicyMock = vi.fn();
const resolveBillingConcurrencyEntitlementMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/creditLedger", () => ({
  insertCreditLedgerEntry: (...args: unknown[]) => insertCreditLedgerEntryMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("../../lib/server/api/modelPricingControlPlane", () => ({
  resolveRuntimeModelPricingPolicy: (...args: unknown[]) =>
    resolveRuntimeModelPricingPolicyMock(...args),
}));

vi.mock("../../lib/server/api/billingConcurrencyEntitlements", () => ({
  resolveBillingConcurrencyEntitlement: (...args: unknown[]) =>
    resolveBillingConcurrencyEntitlementMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

const withVideoBilledCreditsOverride = ({
  modelId,
  params,
  credits,
  policy = getDefaultModelPricingPolicyDocument(),
}: {
  modelId: string;
  params: ReturnType<typeof buildPricingParams>;
  credits: number;
  policy?: ModelPricingPolicyDocument;
}): ModelPricingPolicyDocument => {
  const variantId = resolvePricingGridCostBreakdown({
    modelId,
    params,
    pricingPolicy: policy,
  })?.variantId;
  if (!variantId) return policy;
  const currentModelPolicy = policy.perModel[modelId] ?? {};
  return {
    ...policy,
    perModel: {
      ...policy.perModel,
      [modelId]: {
        ...currentModelPolicy,
        variants: {
          ...(currentModelPolicy.variants ?? {}),
          [variantId]: {
            ...(currentModelPolicy.variants?.[variantId] ?? {}),
            billedCreditsOverride: credits,
          },
        },
      },
    },
  };
};

describe("generationBilling reservation RPC handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SHORTPULSE_FAL_ADMISSION_MODE;
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null });
    logGenerationFailureMock.mockResolvedValue(undefined);
    resolveBillingConcurrencyEntitlementMock.mockResolvedValue({
      userId: "user-1",
      planId: "studio",
      planDisplayName: "Studio",
      offerId: "studio__current",
      contractId: "contract-studio",
      maxConcurrentGenerations: 4,
      source: "contract",
    });
    resolveRuntimeModelPricingPolicyMock.mockResolvedValue({
      policy: getDefaultModelPricingPolicyDocument(),
      activePolicyVersion: null,
      activePolicyVersionId: null,
      source: "control_plane",
      updatedAt: "2026-04-29T00:00:00.000Z",
      updatedByEmail: "pricing@example.com",
    });
  });

  it("returns a no-op charge context when skipBilling is explicitly enabled", async () => {
    const req = {
      headers: {
        "x-shortpulse-request-id": "req-free-action",
      },
      url: "/api/fal/free-action-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v5/lite/edit",
      payload: {
        image_url: "https://example.com/ref.png",
      },
      reason: "Free action generation",
      skipBilling: true,
    });

    expect(charge).not.toBeNull();
    expect(charge?.sourceRef).toBe("req-free-action");
    expect(charge?.credits).toBe(0);
    expect(charge?.billingMode).toBe("reservation");
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();

    await charge?.markSubmitted("provider-req-1", {
      route: "/api/fal/free-action-submit",
    });
    await charge?.refund("No-op refund");

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
  });

  it("fails closed when runtime pricing policy is unavailable", async () => {
    resolveRuntimeModelPricingPolicyMock.mockRejectedValueOnce(
      new Error("Model pricing control plane is not configured.")
    );
    const rpcMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });
    const req = {
      headers: { "x-shortpulse-request-id": "req-pricing-unavailable" },
      url: "/api/fal/seedream-submit",
      body: {},
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      payload: {},
      reason: "Seedream image generation",
    });

    expect(charge).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Model pricing policy is unavailable." });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.generation_billing_pricing_policy_unavailable",
        statusCode: 500,
      })
    );
  });

  it("fails closed when the reservation RPC has a recoverable failure", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: "42702", message: 'column reference "source_ref" is ambiguous' },
    });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
    });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-ambiguous",
      },
      url: "/api/fal/seedream-edit-submit",
    };
    const res = createMockResponse();

    const result = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      payload: {
        prompt: "cinematic portrait",
        image_urls: ["https://example.com/ref.png"],
      },
      reason: "Fal Seedream edit generation",
    });

    expect(result).toBeNull();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.any(Object)
    );
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Generation admission is temporarily unavailable. Please retry shortly.",
      code: "GENERATION_ADMISSION_UNAVAILABLE",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("fails closed when reservation RPC fails with an unexpected SQL error", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: "42704", message: "undefined object" },
    });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
    });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-unexpected",
      },
      url: "/api/fal/seedream-edit-submit",
    };
    const res = createMockResponse();

    const result = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      payload: {
        prompt: "cinematic portrait",
        image_urls: ["https://example.com/ref.png"],
      },
      reason: "Fal Seedream edit generation",
    });

    expect(result).toBeNull();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Generation admission is temporarily unavailable. Please retry shortly.",
      code: "GENERATION_ADMISSION_UNAVAILABLE",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("reserves Kie GPT Image 2 text requests through the canonical reservation RPC", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-kie-gpt-image", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-kie-gpt-image",
      },
      url: "/api/fal/kie-gpt-image-2-submit",
    };
    const res = createMockResponse();
    const payload = {
      prompt: "cinematic portrait",
      aspect_ratio: "16:9",
      resolution: "1K",
      generation_count: 1,
    };

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
      payload,
      reason: "Kie GPT Image 2 generation",
    });

    const expectedPricingParams = buildPricingParams(
      KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
      payload
    );
    const expectedEstimate = computeCostForModel(
      KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
      expectedPricingParams
    );

    expect(charge).not.toBeNull();
    expect(charge?.billingMode).toBe("reservation");
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-kie-gpt-image",
        p_amount_cents: Math.abs(expectedEstimate?.credits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
          route: "/api/fal/kie-gpt-image-2-submit",
          debited_credits: expectedEstimate?.credits,
          pricing_breakdown: {
            usd_raw: expectedEstimate?.usdRaw,
            raw_credits: expectedEstimate?.rawCredits,
            billed_credits: expectedEstimate?.credits,
            billed_usd: expectedEstimate?.usd,
            pricing_policy_version: null,
            pricing_policy_source: "control_plane",
          },
        }),
      })
    );

    expect(res.status).not.toHaveBeenCalled();
  });

  it("reserves Kie GPT Image 2 multi-ref Create requests from the active edit row", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-kie-image-multi-ref", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-kie-image-multi-ref",
      },
      url: "/api/fal/kie-gpt-image-2-edit-submit",
    };
    const res = createMockResponse();
    const payload = {
      prompt: "cinematic portrait",
      aspect_ratio: "16:9",
      resolution: "1K",
      image_urls: [
        "https://example.com/look-1.png",
        "https://example.com/look-2.png",
        "https://example.com/look-3.png",
      ],
      shortpulse_context: {
        selected_tool: "create",
        mode: "image",
      },
    };

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      payload,
      reason: "Kie GPT Image 2 multi-ref create",
      shortpulseContext: {
        selected_tool: "create",
        mode: "image",
      },
    });

    const expectedPricingParams = buildPricingParams(
      KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      payload
    );
    const expectedLookup = resolveCreateImageBilledCreditLookup({
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      params: expectedPricingParams,
      pricingPolicy: materializeImageBilledCreditPolicy(getDefaultModelPricingPolicyDocument()),
    });
    const expectedCredits = expectedLookup.breakdown?.credits ?? null;

    expect(charge).not.toBeNull();
    expect(expectedLookup.authorityMode).toBe("explicit_row");
    expect(expectedLookup.breakdown?.variantId).toBe("edit|res:1K|aspect:16:9");
    expect(expectedCredits).toBe(5);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_amount_cents: Math.abs(expectedCredits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
          debited_credits: expectedCredits,
          pricing_params: expect.objectContaining(expectedPricingParams),
          pricing_breakdown: expect.objectContaining({
            billed_credits: expectedCredits,
          }),
        }),
      })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("fails closed when Create image canonical billed-credit rows are missing", async () => {
    const rpcMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-kie-image-missing-create-price",
      },
      url: "/api/fal/kie-gpt-image-2-edit-submit",
    };
    const res = createMockResponse();
    const payload = {
      prompt: "cinematic portrait",
      aspect_ratio: "3:2",
      resolution: "1K",
      image_urls: ["https://example.com/look-1.png"],
      shortpulse_context: {
        selected_tool: "create",
        mode: "image",
      },
    };

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      payload,
      reason: "Kie GPT Image 2 missing canonical create price",
      shortpulseContext: {
        selected_tool: "create",
        mode: "image",
      },
    });

    expect(charge).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Pricing is unavailable for this configuration.",
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.generation_billing_missing_canonical_create_price",
        message: "Pricing is unavailable for this configuration.",
        statusCode: 500,
        metadata: expect.objectContaining({
          model_id: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
          source_ref: "req-kie-image-missing-create-price",
          pricing_params: expect.objectContaining({
            aspect: "3:2",
            resolution: "1K",
          }),
        }),
      })
    );
  });

  it("reserves Kie GPT Image 2 edit requests with edit pricing params", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-kie-image-edit", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-kie-image-edit",
      },
      url: "/api/fal/kie-gpt-image-2-edit-submit",
    };
    const res = createMockResponse();

    const payload = {
      prompt: "restyle the portrait",
      aspect_ratio: "16:9",
      resolution: "1K",
      image_urls: ["https://example.com/base.png"],
      shortpulse_context: {
        selected_tool: "edit",
        mode: "image",
      },
    };

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      payload,
      reason: "Kie GPT Image 2 edit",
      shortpulseContext: {
        selected_tool: "edit",
        mode: "image",
      },
    });

    const expectedPricingParams = buildPricingParams(
      KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      payload
    );
    const expectedLookup = resolveEditImageBilledCreditLookup({
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      params: expectedPricingParams,
      pricingPolicy: materializeImageBilledCreditPolicy(getDefaultModelPricingPolicyDocument()),
    });
    const expectedCredits = expectedLookup.breakdown?.credits ?? null;

    expect(charge).not.toBeNull();
    expect(expectedLookup.authorityMode).toBe("explicit_row");
    expect(expectedLookup.breakdown?.variantId).toBe("edit|res:1K|aspect:16:9");
    expect(expectedCredits).toBe(5);
    expect(charge?.billingMode).toBe("reservation");
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-kie-image-edit",
        p_amount_cents: Math.abs(expectedCredits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
          route: "/api/fal/kie-gpt-image-2-edit-submit",
          debited_credits: expectedCredits,
          pricing_params: expect.objectContaining(expectedPricingParams),
        }),
      })
    );

    expect(res.status).not.toHaveBeenCalled();
  });

  it("reserves Kie GPT Image 2 multi-ref edit requests from the active edit row", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-kie-image-edit-multi-ref", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });
    const req = {
      headers: {
        "x-shortpulse-request-id": "req-kie-image-edit-multi-ref",
      },
      url: "/api/fal/kie-gpt-image-2-edit-submit",
    };
    const res = createMockResponse();

    const payload = {
      prompt: "restyle the portrait",
      aspect_ratio: "16:9",
      resolution: "1K",
      image_urls: ["https://example.com/base.png", "https://example.com/look.png"],
      shortpulse_context: {
        selected_tool: "edit",
        mode: "image",
      },
    };

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      payload,
      reason: "Kie GPT Image 2 multi-ref edit",
      shortpulseContext: {
        selected_tool: "edit",
        mode: "image",
      },
    });

    const expectedPricingParams = buildPricingParams(
      KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      payload
    );
    const expectedLookup = resolveEditImageBilledCreditLookup({
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      params: expectedPricingParams,
      pricingPolicy: materializeImageBilledCreditPolicy(getDefaultModelPricingPolicyDocument()),
    });
    const expectedCredits = expectedLookup.breakdown?.credits ?? null;

    expect(charge).not.toBeNull();
    expect(expectedLookup.authorityMode).toBe("explicit_row");
    expect(expectedLookup.breakdown?.variantId).toBe("edit|res:1K|aspect:16:9");
    expect(expectedCredits).toBe(5);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_amount_cents: Math.abs(expectedCredits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
          route: "/api/fal/kie-gpt-image-2-edit-submit",
          debited_credits: expectedCredits,
          pricing_params: expect.objectContaining(expectedPricingParams),
          pricing_breakdown: expect.objectContaining({
            billed_credits: expectedCredits,
          }),
        }),
      })
    );
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.generation_billing_missing_canonical_edit_price",
      })
    );
  });

  it("records pricing observability when the client sends displayed billed credits", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-observable-kie-image", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-observable-kie-image",
      },
      url: "/api/fal/kie-gpt-image-2-submit",
      body: {
        shortpulse_context: {
          displayed_billed_credits: 8,
          pricing_display_source: "shared_adapter",
          pricing_policy_ready: true,
        },
      },
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
      payload: {
        prompt: "cinematic portrait",
        aspect_ratio: "16:9",
        resolution: "1K",
        generation_count: 1,
      },
      reason: "Kie GPT Image 2 generation",
    });

    const expectedPricingParams = buildPricingParams(KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID, {
      prompt: "cinematic portrait",
      aspect_ratio: "16:9",
      resolution: "1K",
      generation_count: 1,
    });
    const expectedEstimate = computeCostForModel(
      KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
      expectedPricingParams
    );

    expect(charge).not.toBeNull();
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_metadata: expect.objectContaining({
          pricing_observability: {
            displayed_billed_credits: 8,
            actual_billed_credits: expectedEstimate?.credits,
            delta_credits: Number(((expectedEstimate?.credits ?? 0) - 8).toFixed(4)),
            mismatch: (expectedEstimate?.credits ?? 0) !== 8,
            pricing_display_source: "shared_adapter",
            pricing_policy_ready: true,
          },
          shortpulse_context: {
            displayed_billed_credits: 8,
            pricing_display_source: "shared_adapter",
            pricing_policy_ready: true,
          },
        }),
      })
    );
  });

  it("reserves video requests from the explicit admin billed row when shortpulse_context marks video billing", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-video-grid", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-video-grid",
      },
      url: "/api/fal/kie-seedance-2-fast-submit",
      body: {
        shortpulse_context: {
          selected_tool: "video",
          mode: "video",
          displayed_billed_credits: 20,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        },
      },
    };
    const res = createMockResponse();
    const payload = {
      prompt: "product hero turntable shot",
      duration: 10,
      resolution: "720p",
      aspect_ratio: "1:1",
      generate_audio: false,
      web_search: false,
      shortpulse_context: {
        selected_tool: "video",
        mode: "video",
      },
    };

    const expectedPricingParams = buildPricingParams(KIE_SEEDANCE_2_FAST_MODEL_ID, payload);
    const explicitVideoPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params: expectedPricingParams,
      credits: 24,
    });
    resolveRuntimeModelPricingPolicyMock.mockResolvedValueOnce({
      policy: explicitVideoPolicy,
      activePolicyVersion: null,
      activePolicyVersionId: null,
      source: "control_plane",
      updatedAt: "2026-04-29T00:00:00.000Z",
      updatedByEmail: "pricing@example.com",
    });

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      payload,
      reason: "Seedance 2 Fast video generation",
      shortpulseContext: {
        selected_tool: "video",
        mode: "video",
      },
    });

    const expectedBreakdown = resolveVideoBilledCreditLookup({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params: expectedPricingParams,
      pricingPolicy: explicitVideoPolicy,
    }).breakdown;

    expect(charge).not.toBeNull();
    expect(expectedBreakdown).not.toBeNull();
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_amount_cents: Math.abs(expectedBreakdown?.credits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: KIE_SEEDANCE_2_FAST_MODEL_ID,
          debited_credits: expectedBreakdown?.credits,
          pricing_breakdown: expect.objectContaining({
            billed_credits: expectedBreakdown?.credits,
            billed_usd: expectedBreakdown?.usd,
            ...(expectedBreakdown?.variantId ? { variant_id: expectedBreakdown.variantId } : {}),
          }),
        }),
      })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("reserves Kling Motion Control requests when provider mode carries the resolution", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-kling-motion-grid", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-kling-motion-grid",
      },
      url: "/api/fal/kie-kling-submit",
      body: {
        shortpulse_context: {
          selected_tool: "video",
          mode: "video",
          displayed_billed_credits: 31,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        },
      },
    };
    const res = createMockResponse();
    const payload = {
      prompt: "Transfer motion from reference video to character",
      model: "kling-3.0/motion-control",
      image_url: "https://example.com/character.png",
      video_url: "https://example.com/motion.mp4",
      mode: "720p",
      generate_audio: true,
      shortpulse_context: {
        selected_tool: "video",
        mode: "video",
      },
    };
    const expectedPricingParams = buildPricingParams(KIE_KLING_30_MODEL_ID, payload);
    const explicitVideoPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_KLING_30_MODEL_ID,
      params: {
        variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
        durationSeconds: 10,
        resolution: "720p",
        audio: true,
      },
      credits: 31,
    });
    resolveRuntimeModelPricingPolicyMock.mockResolvedValueOnce({
      policy: explicitVideoPolicy,
      activePolicyVersion: null,
      activePolicyVersionId: null,
      source: "control_plane",
      updatedAt: "2026-04-29T00:00:00.000Z",
      updatedByEmail: "pricing@example.com",
    });

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_KLING_30_MODEL_ID,
      payload,
      reason: "Kling Motion Control video generation",
      shortpulseContext: {
        selected_tool: "video",
        mode: "video",
      },
    });

    const expectedBreakdown = resolveVideoBilledCreditLookup({
      modelId: KIE_KLING_30_MODEL_ID,
      params: expectedPricingParams,
      pricingPolicy: explicitVideoPolicy,
    }).breakdown;

    expect(charge).not.toBeNull();
    expect(expectedPricingParams).toEqual(
      expect.objectContaining({
        variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
        resolution: "720p",
        mode: "720p",
        audio: true,
      })
    );
    expect(expectedBreakdown).toMatchObject({
      credits: 31,
      variantId: "motion_control|res:720p|audio:on",
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_amount_cents: 31,
        p_metadata: expect.objectContaining({
          model_id: KIE_KLING_30_MODEL_ID,
          debited_credits: 31,
          pricing_breakdown: expect.objectContaining({
            billed_credits: 31,
            variant_id: "motion_control|res:720p|audio:on",
          }),
        }),
      })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("reserves Seedance video requests from the shared-policy canonical row by default", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-video-missing-row", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-video-missing-row",
      },
      url: "/api/fal/kie-seedance-2-fast-submit",
      body: {
        shortpulse_context: {
          selected_tool: "video",
          mode: "video",
          displayed_billed_credits: 20,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        },
      },
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      payload: {
        prompt: "product hero turntable shot",
        duration: 10,
        resolution: "720p",
        aspect_ratio: "1:1",
        generate_audio: false,
        shortpulse_context: {
          selected_tool: "video",
          mode: "video",
        },
      },
      reason: "Seedance 2 Fast video generation",
      shortpulseContext: {
        selected_tool: "video",
        mode: "video",
      },
    });

    const expectedPricingParams = buildPricingParams(KIE_SEEDANCE_2_FAST_MODEL_ID, {
      prompt: "product hero turntable shot",
      duration: 10,
      resolution: "720p",
      aspect_ratio: "1:1",
      generate_audio: false,
      shortpulse_context: {
        selected_tool: "video",
        mode: "video",
      },
    });
    const expectedBreakdown = resolveVideoBilledCreditLookup({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params: expectedPricingParams,
      pricingPolicy: materializeImageBilledCreditPolicy(getDefaultModelPricingPolicyDocument()),
    }).breakdown;

    expect(charge).not.toBeNull();
    expect(expectedBreakdown).toMatchObject({
      variantId: "default|res:720p|aspect:16:9|audio:on",
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_amount_cents: Math.abs(expectedBreakdown?.credits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: KIE_SEEDANCE_2_FAST_MODEL_ID,
          debited_credits: expectedBreakdown?.credits,
          pricing_breakdown: expect.objectContaining({
            billed_credits: expectedBreakdown?.credits,
            billed_usd: expectedBreakdown?.usd,
            variant_id: expectedBreakdown?.variantId,
          }),
        }),
      })
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
  });

  it("reserves audio requests from the pricing-grid resolver when shortpulse_context marks sound billing", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-audio-grid", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-audio-grid",
      },
      url: "/api/elevenlabs/music",
      body: {
        shortpulse_context: {
          selected_tool: "music",
          mode: "audio",
          displayed_billed_credits: 18,
          pricing_display_source: "pricing_grid",
          pricing_policy_ready: true,
        },
      },
    };
    const res = createMockResponse();
    const payload = {
      text: "Night-drive synth anthem",
      duration_seconds: 30,
      shortpulse_context: {
        selected_tool: "music",
        mode: "audio",
      },
    };

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "music_v1",
      payload,
      reason: "ElevenLabs music generation",
      shortpulseContext: {
        selected_tool: "music",
        mode: "audio",
      },
    });

    const expectedPricingParams = buildPricingParams("music_v1", payload);
    const expectedBreakdown = resolvePricingGridCostBreakdown({
      modelId: "music_v1",
      params: expectedPricingParams,
      pricingPolicy: materializeImageBilledCreditPolicy(getDefaultModelPricingPolicyDocument()),
    });

    expect(charge).not.toBeNull();
    expect(expectedBreakdown).not.toBeNull();
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_amount_cents: Math.abs(expectedBreakdown?.credits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: "music_v1",
          debited_credits: expectedBreakdown?.credits,
          pricing_breakdown: expect.objectContaining({
            billed_credits: expectedBreakdown?.credits,
            billed_usd: expectedBreakdown?.usd,
            ...(expectedBreakdown?.variantId ? { variant_id: expectedBreakdown.variantId } : {}),
          }),
        }),
      })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns charge helpers when reservation RPC succeeds and calls mark/release RPCs", async () => {
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ status: "reserved", source_ref: "req-ok", message: null }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ status: "reserved", source_ref: "req-ok", message: null }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ status: "released", source_ref: "req-ok", message: null }],
        error: null,
      });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
    });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-ok",
      },
      url: "/api/fal/seedream-edit-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      payload: {
        prompt: "cinematic portrait",
        image_urls: ["https://example.com/ref.png"],
      },
      reason: "Fal Seedream edit generation",
    });

    expect(charge).not.toBeNull();
    expect(charge?.sourceRef).toBe("req-ok");
    expect(charge?.billingMode).toBe("reservation");

    const markResult = await charge?.markSubmitted("provider-req-1", {
      route: "/api/fal/seedream-edit-submit",
    });
    await charge?.refund("Auto-release: test", { from: "test" });

    expect(markResult).toEqual({
      ok: true,
      status: "reserved",
      sourceRef: "req-ok",
      message: null,
      code: null,
    });

    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      "mark_generation_reservation_submitted",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-ok",
        p_provider_request_id: "provider-req-1",
      })
    );
    expect(rpcMock).toHaveBeenNthCalledWith(
      3,
      "release_generation_reservation_by_source_ref",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-ok",
        p_reason: "Auto-release: test",
      })
    );
  });

  it("returns a failed submit-link result when reservation submit linkage cannot be recorded", async () => {
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ status: "reserved", source_ref: "req-link-fail", message: null }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42704", message: "undefined object" },
      });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
    });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-link-fail",
      },
      url: "/api/fal/seedream-edit-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      payload: {
        prompt: "cinematic portrait",
        image_urls: ["https://example.com/ref.png"],
      },
      reason: "Fal Seedream edit generation",
    });

    expect(charge).not.toBeNull();

    const linkResult = await charge?.markSubmitted("provider-req-link-fail", {
      route: "/api/fal/seedream-edit-submit",
    });

    expect(linkResult).toEqual({
      ok: false,
      status: "failed",
      sourceRef: "req-link-fail",
      message: "undefined object",
      code: "42704",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      "mark_generation_reservation_submitted",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-link-fail",
        p_provider_request_id: "provider-req-link-fail",
      })
    );
  });

  it("keeps debit amounts in parity with estimated costs across active Fal payloads", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [{ status: "reserved", source_ref: "ok", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
    });

    const cases = [
      {
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        route: "/api/fal/seedream-edit-submit",
        requestId: "req-seedream-edit",
        payload: {
          prompt: "cinematic portrait",
          image_urls: ["https://example.com/ref.png"],
          image_size: { width: 4096, height: 4096 },
        },
      },
      {
        modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        route: "/api/fal/seedream-submit",
        requestId: "req-seedream",
        payload: {
          prompt: "studio portrait",
          image_size: "square",
        },
      },
      {
        modelId: "kie-ai/kling-3.0",
        route: "/api/fal/kie-kling-submit",
        requestId: "req-kie-kling",
        payload: {
          prompt: "city drone sweep",
          image_url: "https://example.com/ref.png",
          duration: 10,
          resolution: "1080p",
          generate_audio: true,
        },
      },
      {
        modelId: "kie-ai/veo-3.1-fast-i2v",
        route: "/api/fal/kie-veo-submit",
        requestId: "req-kie-veo",
        payload: {
          prompt: "sunset shoreline walk",
          image_urls: ["https://example.com/first.png", "https://example.com/last.png"],
          generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
          duration: 8,
          resolution: "720p",
          generate_audio: true,
        },
      },
      {
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        route: "/api/fal/kie-seedance-2-submit",
        requestId: "req-kie-seedance-2",
        payload: {
          prompt: "cinematic sports ad",
          first_frame_url: "https://example.com/first.png",
          last_frame_url: "https://example.com/last.png",
          duration: 5,
          resolution: "1080p",
          aspect_ratio: "16:9",
          generate_audio: true,
          return_last_frame: false,
          web_search: false,
        },
      },
      {
        modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
        route: "/api/fal/kie-seedance-2-fast-submit",
        requestId: "req-kie-seedance-2-fast",
        payload: {
          prompt: "product hero turntable shot",
          duration: 10,
          resolution: "720p",
          aspect_ratio: "1:1",
          generate_audio: false,
          web_search: false,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const req = {
        headers: {
          "x-shortpulse-request-id": testCase.requestId,
        },
        url: testCase.route,
      };
      const res = createMockResponse();

      const callCountBefore = rpcMock.mock.calls.length;
      const charge = await chargeGenerationRequest({
        req: req as never,
        res: res as never,
        modelId: testCase.modelId,
        payload: testCase.payload as Record<string, unknown>,
        reason: `${testCase.modelId} generation`,
      });

      expect(charge).not.toBeNull();
      expect(charge?.billingMode).toBe("reservation");
      expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
      expect(rpcMock.mock.calls.length).toBe(callCountBefore + 1);

      const reserveCall = rpcMock.mock.calls[callCountBefore];
      expect(reserveCall?.[0]).toBe("admit_and_reserve_generation_credits");

      const reservePayload = reserveCall?.[1] as {
        p_amount_cents: number;
        p_metadata: {
          pricing_breakdown?: {
            usd_raw: number;
            raw_credits: number;
            billed_credits: number;
            billed_usd: number;
            pricing_policy_version: string | null;
            pricing_policy_source: string | null;
          };
        };
      };

      const pricingParams = buildPricingParams(
        testCase.modelId,
        testCase.payload as Record<string, unknown>
      );
      const estimated = computeCostForModel(testCase.modelId, pricingParams);
      expect(estimated).not.toBeNull();

      expect(reservePayload.p_amount_cents).toBe(estimated?.credits);
      expect(reservePayload.p_metadata.pricing_breakdown).toEqual({
        usd_raw: estimated?.usdRaw,
        raw_credits: estimated?.rawCredits,
        billed_credits: estimated?.credits,
        billed_usd: estimated?.usd,
        pricing_policy_version: null,
        pricing_policy_source: "control_plane",
      });
    }
  });

  it("uses admit+reserve RPC for generation reservations", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-atomic", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: { "x-shortpulse-request-id": "req-atomic" },
      url: "/api/fal/seedream-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      payload: { prompt: "portrait" },
      reason: "Fal Seedream generation",
    });

    expect(charge).not.toBeNull();
    expect(charge?.billingMode).toBe("reservation");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-atomic",
        p_admission_mode: "enforce",
        p_global_max: 4,
      })
    );
    const atomicPayload = rpcMock.mock.calls[0]?.[1] as {
      p_metadata: Record<string, unknown>;
      p_tier: string;
    };
    expect(atomicPayload.p_tier).toBe("image_heavy");
    expect(atomicPayload.p_metadata.admission_tier).toBe("image_heavy");
  });

  it("fails closed when the canonical admit+reserve RPC is unavailable", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.admit_and_reserve_generation_credits in the schema cache",
      },
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: { "x-shortpulse-request-id": "req-atomic-fallback" },
      url: "/api/fal/seedream-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      payload: { prompt: "portrait" },
      reason: "Fal Seedream generation",
    });

    expect(charge).toBeNull();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0]?.[0]).toBe("admit_and_reserve_generation_credits");
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Generation admission is temporarily unavailable. Please retry shortly.",
      code: "GENERATION_ADMISSION_UNAVAILABLE",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("fails closed when the reservation RPC reports insufficient credits", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: {
        code: "P0001",
        message: "Insufficient credits",
      },
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: { "x-shortpulse-request-id": "req-insufficient-credits" },
      url: "/api/fal/seedream-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      payload: { prompt: "portrait" },
      reason: "Fal Seedream generation",
    });

    expect(charge).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_source_ref: "req-insufficient-credits",
      })
    );
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: "Insufficient credits.",
      code: "INSUFFICIENT_CREDITS",
      chargeState: "not_reserved",
    });
  });

  it("fails closed on admission-limited atomic reservation RPC decisions", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [
        {
          status: "admission_limited",
          source_ref: "req-atomic-limit",
          message: "admission_limited",
          admission_reason: "tier_limit",
          admission_global_active: 4,
          admission_global_max: 4,
          admission_tier: "video_long",
          admission_tier_active: 2,
          admission_tier_max: 2,
          retry_after_seconds: 11,
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: { "x-shortpulse-request-id": "req-atomic-limit" },
      url: "/api/fal/kie-veo-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: {
        prompt: "test prompt",
        duration: 8,
        resolution: "720p",
        aspect_ratio: "16:9",
      },
      reason: "Kie Veo generation",
    });

    expect(charge).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_source_ref: "req-atomic-limit",
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "11");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many active generations. Please retry shortly.",
      code: "GENERATION_ADMISSION_LIMIT",
      retryAfterSeconds: 11,
      admissionScope: "per_user",
      planId: "studio",
      planDisplayName: "Studio",
      maxConcurrentGenerations: 4,
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: ADMISSION_LIMITED_TELEMETRY_SOURCE,
        statusCode: 429,
      })
    );
  });

  it("blocks generation access when the resolved plan entitlement has zero active slots", async () => {
    resolveBillingConcurrencyEntitlementMock.mockResolvedValueOnce({
      userId: "user-1",
      planId: "free",
      planDisplayName: "Baseline access",
      offerId: "free__current",
      contractId: null,
      maxConcurrentGenerations: 0,
      source: "current_offer",
    });
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [
        {
          status: "admission_limited",
          source_ref: "req-zero-slots",
          message: "admission_limited",
          admission_reason: "global_limit",
          admission_global_active: 0,
          admission_global_max: 0,
          admission_tier: "image_standard",
          admission_tier_active: 0,
          admission_tier_max: 1000000,
          retry_after_seconds: 20,
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: { "x-shortpulse-request-id": "req-zero-slots" },
      url: "/api/fal/kie-gpt-image-2-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
      payload: {
        prompt: "test prompt",
        aspect_ratio: "16:9",
        resolution: "1K",
      },
      reason: "Kie GPT Image 2 generation",
    });

    expect(charge).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_admission_mode: "enforce",
        p_global_max: 0,
      })
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Baseline access does not include generation access. Choose a paid plan to generate.",
      code: "GENERATION_ADMISSION_LIMIT",
      retryAfterSeconds: 20,
      admissionScope: "per_user",
      planId: "free",
      planDisplayName: "Baseline access",
      maxConcurrentGenerations: 0,
    });
  });

  it("uses a direct-submit telemetry source for non-Fal admission denials", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [
        {
          status: "admission_limited",
          source_ref: "req-elevenlabs-limit",
          message: "admission_limited",
          admission_reason: "tier_limit",
          admission_global_active: 4,
          admission_global_max: 4,
          admission_tier: "image",
          admission_tier_active: 2,
          admission_tier_max: 2,
          retry_after_seconds: 7,
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: { "x-shortpulse-request-id": "req-elevenlabs-limit" },
      url: "/api/elevenlabs/music",
      body: {
        shortpulse_context: {
          selected_tool: "music",
          mode: "audio",
        },
      },
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "music_v1",
      payload: {
        text: "Night-drive synth anthem",
        duration_seconds: 30,
      },
      reason: "ElevenLabs music generation",
      shortpulseContext: {
        selected_tool: "music",
        mode: "audio",
      },
    });

    expect(charge).toBeNull();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: DIRECT_SUBMIT_ADMISSION_LIMITED_TELEMETRY_SOURCE,
        statusCode: 429,
      })
    );
  });
});

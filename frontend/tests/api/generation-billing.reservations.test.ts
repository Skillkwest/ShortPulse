import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeCostForModel } from "../../lib/model-runtime/pricing";
import { getDefaultModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import {
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

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("generationBilling reservation RPC handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SHORTPULSE_FAL_ADMISSION_MODE;
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null });
    logGenerationFailureMock.mockResolvedValue(undefined);
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

  it("bypasses reservation blocking when the reservation RPC has a recoverable failure", async () => {
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

    expect(result).not.toBeNull();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.any(Object)
    );
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(result?.billingMode).toBe("bypass");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("bypasses reservation blocking when reservation RPC fails with an unexpected SQL error", async () => {
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

    expect(result).not.toBeNull();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(result?.billingMode).toBe("bypass");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("reserves gpt-image-2 requests through the canonical reservation RPC", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-openai-image", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-openai-image",
      },
      url: "/api/openai/image-generate",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "gpt-image-2",
      payload: {
        prompt: "cinematic portrait",
        size: "1024x1024",
        quality: "medium",
        n: 1,
      },
      reason: "OpenAI GPT Image 2 generation",
    });

    const expectedPricingParams = buildPricingParams("gpt-image-2", {
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });
    const expectedEstimate = computeCostForModel("gpt-image-2", expectedPricingParams);

    expect(charge).not.toBeNull();
    expect(charge?.billingMode).toBe("reservation");
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-openai-image",
        p_amount_cents: Math.abs(expectedEstimate?.credits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: "gpt-image-2",
          route: "/api/openai/image-generate",
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

  it("reserves gpt-image-2 edit requests with edit pricing params", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-openai-image-edit", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-openai-image-edit",
      },
      url: "/api/openai/image-edit",
    };
    const res = createMockResponse();

    const payload = {
      prompt: "restyle the portrait",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      input_fidelity: "high",
      images: [
        { image_url: "https://example.com/base.png" },
        { image_url: "https://example.com/ref.png" },
      ],
      mask: {
        image_url: "https://example.com/mask.png",
      },
    };

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "gpt-image-2",
      payload,
      reason: "OpenAI GPT Image 2 edit",
    });

    const expectedPricingParams = buildPricingParams("gpt-image-2", payload);
    const expectedEstimate = computeCostForModel("gpt-image-2", expectedPricingParams);

    expect(charge).not.toBeNull();
    expect(charge?.billingMode).toBe("reservation");
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "admit_and_reserve_generation_credits",
      expect.objectContaining({
        p_user_id: "user-1",
        p_source_ref: "req-openai-image-edit",
        p_amount_cents: Math.abs(expectedEstimate?.credits ?? 0),
        p_metadata: expect.objectContaining({
          model_id: "gpt-image-2",
          route: "/api/openai/image-edit",
          debited_credits: expectedEstimate?.credits,
          pricing_params: expectedPricingParams,
        }),
      })
    );

    expect(res.status).not.toHaveBeenCalled();
  });

  it("records pricing observability when the client sends displayed billed credits", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [{ status: "reserved", source_ref: "req-observable-image", message: null }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: {
        "x-shortpulse-request-id": "req-observable-image",
      },
      url: "/api/openai/image-generate",
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
      modelId: "gpt-image-2",
      payload: {
        prompt: "cinematic portrait",
        size: "1024x1024",
        quality: "medium",
        n: 1,
      },
      reason: "OpenAI GPT Image 2 generation",
    });

    const expectedPricingParams = buildPricingParams("gpt-image-2", {
      prompt: "cinematic portrait",
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });
    const expectedEstimate = computeCostForModel("gpt-image-2", expectedPricingParams);

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
        modelId: "fal-ai/flux-pro/v1/fill",
        route: "/api/fal/flux-pro-fill-submit",
        requestId: "req-flux-fill",
        payload: {
          prompt: "cinematic portrait",
          image_url: "https://example.com/base.png",
          mask_url: "https://example.com/mask.png",
          image_size: { width: 1024, height: 1024 },
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

  it("bypasses blocking when the canonical admit+reserve RPC is unavailable", async () => {
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

    expect(charge).not.toBeNull();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0]?.[0]).toBe("admit_and_reserve_generation_credits");
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
    expect(charge?.billingMode).toBe("bypass");
    expect(res.status).not.toHaveBeenCalled();
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
      error: "Insufficient credits. Add credits or switch plans before retrying.",
      code: "INSUFFICIENT_CREDITS",
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
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: ADMISSION_LIMITED_TELEMETRY_SOURCE,
        statusCode: 429,
      })
    );
  });

  it("uses a direct-submit telemetry source for non-Fal admission denials", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    const rpcMock = vi.fn().mockResolvedValueOnce({
      data: [
        {
          status: "admission_limited",
          source_ref: "req-openai-limit",
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
      headers: { "x-shortpulse-request-id": "req-openai-limit" },
      url: "/api/openai/image-generate",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "gpt-image-2",
      payload: {
        prompt: "portrait",
        size: "1024x1024",
        quality: "medium",
        n: 1,
      },
      reason: "OpenAI image generation",
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

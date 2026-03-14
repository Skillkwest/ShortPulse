import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeCostForModel } from "../../lib/model-runtime/pricing";
import { chargeGenerationRequest } from "../../lib/server/api/generationBilling";
import { buildPricingParams } from "../../lib/server/api/generationBilling/pricingParams";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const insertCreditLedgerEntryMock = vi.fn();
const logGenerationFailureMock = vi.fn();

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

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("generationBilling reservation RPC handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED = "false";
    delete process.env.SHORTPULSE_FAL_ADMISSION_MODE;
    delete process.env.SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED;
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null });
    logGenerationFailureMock.mockResolvedValue(undefined);
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

  it("falls back to direct debit only when the emergency fallback flag is enabled", async () => {
    process.env.SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED = "true";
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
    expect(result?.billingMode).toBe("direct_debit");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("reserve_generation_credits", expect.any(Object));
    expect(insertCreditLedgerEntryMock).toHaveBeenCalledTimes(1);
    const debitPayload = insertCreditLedgerEntryMock.mock.calls[0]?.[0] as {
      changeCents: number;
      source: string;
      sourceRef: string;
      metadata: {
        pricing_breakdown?: {
          usd_raw: number;
          raw_credits: number;
          billed_credits: number;
          billed_usd: number;
        };
      };
    };
    expect(typeof debitPayload.changeCents).toBe("number");
    expect(debitPayload.changeCents).toBeLessThan(0);
    expect(debitPayload.source).toBe("generation_charge");
    expect(debitPayload.sourceRef).toBe("req-ambiguous");
    expect(debitPayload.metadata.pricing_breakdown).toEqual({
      usd_raw: 0.04,
      raw_credits: 5,
      billed_credits: 5,
      billed_usd: 0.05,
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 500 with a safe error when reservation RPC fails with an unexpected SQL error", async () => {
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
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to process generation credits. Please retry.",
    });
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

    await charge?.markSubmitted("provider-req-1", { route: "/api/fal/seedream-edit-submit" });
    await charge?.refund("Auto-release: test", { from: "test" });

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
        modelId: "fal/flux-2/edit",
        route: "/api/fal/flux2-edit-submit",
        requestId: "req-flux2-edit",
        payload: {
          prompt: "cinematic portrait",
          image_urls: ["https://example.com/ref.png"],
          image_size: { width: 4096, height: 4096 },
        },
      },
      {
        modelId: "fal/flux-2-pro/edit",
        route: "/api/fal/flux2pro-edit-submit",
        requestId: "req-flux2-pro-edit",
        payload: {
          prompt: "cinematic portrait",
          image_urls: ["https://example.com/ref.png"],
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
        modelId: "fal-ai/sora-2/text-to-video/pro",
        route: "/api/fal/sora-pro-submit",
        requestId: "req-sora",
        payload: {
          prompt: "city timelapse",
          duration: 11,
          resolution: "720p",
          aspect_ratio: "16:9",
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
      expect(reserveCall?.[0]).toBe("reserve_generation_credits");

      const reservePayload = reserveCall?.[1] as {
        p_amount_cents: number;
        p_metadata: {
          pricing_breakdown?: {
            usd_raw: number;
            raw_credits: number;
            billed_credits: number;
            billed_usd: number;
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
      });
    }
  });

  it("uses atomic admit+reserve RPC when the atomic flag is enabled", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED = "true";
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

  it("falls back to legacy reservation RPC when atomic function is unavailable", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED = "true";
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.admit_and_reserve_generation_credits in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: [{ status: "reserved", source_ref: "req-atomic-fallback", message: null }],
        error: null,
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
    expect(charge?.billingMode).toBe("reservation");
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0]?.[0]).toBe("admit_and_reserve_generation_credits");
    expect(rpcMock.mock.calls[1]?.[0]).toBe("reserve_generation_credits");
  });

  it("returns admission-limited 429 from atomic reservation RPC decisions", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED = "true";
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
      url: "/api/fal/veo-submit",
    };
    const res = createMockResponse();

    const charge = await chargeGenerationRequest({
      req: req as never,
      res: res as never,
      modelId: "fal-ai/sora-2/text-to-video/pro",
      payload: {
        prompt: "test prompt",
        duration: 8,
        resolution: "720p",
        aspect_ratio: "16:9",
      },
      reason: "Fal Sora generation",
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
      limits: {
        globalMax: 4,
        globalActive: 4,
        tier: "video_long",
        tierMax: 2,
        tierActive: 2,
      },
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.api.fal_submit.admission_limited",
        statusCode: 429,
      })
    );
  });
});

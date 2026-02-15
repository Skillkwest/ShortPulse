import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeCostForModel } from "../../features/ai-studio/logic/pricing";
import { chargeGenerationRequest } from "../../lib/server/api/generationBilling";
import { buildPricingParams } from "../../lib/server/api/generationBilling/pricingParams";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const insertCreditLedgerEntryMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/creditLedger", () => ({
  insertCreditLedgerEntry: (...args: unknown[]) => insertCreditLedgerEntryMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("generationBilling reservation RPC handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null });
  });

  it("falls back to direct debit when reservation RPC fails with ambiguous source_ref SQL error", async () => {
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
      raw_credits: 4,
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
});

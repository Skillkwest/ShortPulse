import { beforeEach, describe, expect, it, vi } from "vitest";
import { chargeGenerationRequest } from "../../lib/server/api/generationBilling";

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
    };
    expect(typeof debitPayload.changeCents).toBe("number");
    expect(debitPayload.changeCents).toBeLessThan(0);
    expect(debitPayload.source).toBe("generation_charge");
    expect(debitPayload.sourceRef).toBe("req-ambiguous");
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
});

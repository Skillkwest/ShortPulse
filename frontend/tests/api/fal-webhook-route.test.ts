import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/webhook";

const readRawBodyMock = vi.fn();
const verifyFalWebhookSignatureMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/falWebhook", () => ({
  readRawBody: (...args: unknown[]) => readRawBodyMock(...args),
  verifyFalWebhookSignature: (...args: unknown[]) => verifyFalWebhookSignatureMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createSupabaseMock = () => {
  const maybeSingle = vi.fn(async () => ({
    data: {
      id: "gen-1",
      user_id: "user-1",
      request_id: "req-1",
      status: "running",
      metadata: {},
    },
    error: null,
  }));

  const updateEq2 = vi.fn(async () => ({ error: null }));
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const update = vi.fn(() => ({ eq: updateEq1 }));

  const selectEq = vi.fn(() => ({
    order: vi.fn(() => ({
      limit: vi.fn(() => ({
        maybeSingle,
      })),
    })),
  }));
  const select = vi.fn(() => ({ eq: selectEq }));

  const from = vi.fn((table: string) => {
    if (table !== "ai_generations") throw new Error(`unexpected table ${table}`);
    return { select, update };
  });

  return { from, updateEq2, maybeSingle };
};

describe("POST /api/fal/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_FAL_WEBHOOK_ENABLED = "true";
    process.env.SHORTPULSE_FAL_INTEGRATION_MODE = "on";
  });

  it("rejects invalid webhook signatures", async () => {
    readRawBodyMock.mockResolvedValue(JSON.stringify({ request_id: "req-1" }));
    verifyFalWebhookSignatureMock.mockReturnValue(false);

    const req = {
      method: "POST",
      headers: {
        "x-fal-signature": "bad-signature",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid webhook signature" });
  });

  it("settles success and updates generation state on terminal media payload", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    readRawBodyMock.mockResolvedValue(
      JSON.stringify({
        id: "event-1",
        request_id: "req-1",
        status: "COMPLETED",
        data: {
          images: [{ url: "https://cdn.shortpulse.test/output.png" }],
        },
      })
    );
    verifyFalWebhookSignatureMock.mockReturnValue(true);
    settleGenerationOutcomeMock.mockResolvedValue({ settled: true, note: "captured" });

    const req = {
      method: "POST",
      headers: {
        "x-fal-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "success",
      })
    );
    expect(supabase.updateEq2).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        received: true,
        request_id: "req-1",
        status: "success",
      })
    );
  });
});

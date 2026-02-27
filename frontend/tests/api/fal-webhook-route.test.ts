import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/webhook";
import { RequestBodyTooLargeError } from "../../lib/server/api/requestBody";

const readRawBodyMock = vi.fn();
const verifyFalWebhookSignatureMock = vi.fn();
const verifyFalWebhookBodyHashMock = vi.fn();
const readFalWebhookHeadersMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();

vi.mock("../../lib/server/api/falWebhook", () => ({
  readRawBody: (...args: unknown[]) => readRawBodyMock(...args),
  verifyFalWebhookSignature: (...args: unknown[]) => verifyFalWebhookSignatureMock(...args),
  verifyFalWebhookBodyHash: (...args: unknown[]) => verifyFalWebhookBodyHashMock(...args),
  readFalWebhookHeaders: (...args: unknown[]) => readFalWebhookHeadersMock(...args),
}));

vi.mock("../../lib/server/falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
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
  const insertSingle = vi.fn(async () => ({ data: { event_id: "event-1" }, error: null }));
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: insertSingle,
    })),
  }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn((table: string) => {
    if (table !== "fal_webhook_events") throw new Error(`unexpected table ${table}`);
    return { insert, update };
  });
  return { from, insertSingle, updateEq };
};

describe("POST /api/fal/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_FAL_WEBHOOK_ENABLED = "true";
    process.env.SHORTPULSE_FAL_INTEGRATION_MODE = "on";
    readFalWebhookHeadersMock.mockReturnValue({
      requestId: "req-1",
      userId: "fal-user-1",
      eventId: "event-1",
      timestamp: String(Math.floor(Date.now() / 1000)),
      signature: "sig",
    });
    verifyFalWebhookBodyHashMock.mockReturnValue(true);
  });

  it("rejects invalid webhook signatures", async () => {
    readRawBodyMock.mockResolvedValue(JSON.stringify({ request_id: "req-1" }));
    verifyFalWebhookSignatureMock.mockResolvedValue({ ok: false, method: null });

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "bad-signature",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid webhook signature" });
    expect(executeGenerationRecoveryMock).not.toHaveBeenCalled();
  });

  it("returns 413 when webhook payload exceeds max size", async () => {
    readRawBodyMock.mockRejectedValue(new RequestBodyTooLargeError(512 * 1024));

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: "Webhook payload too large." });
  });

  it("ingests webhook events and delegates terminal processing to shared recovery execution", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    readRawBodyMock.mockResolvedValue(
      JSON.stringify({
        id: "event-1",
        request_id: "req-1",
        status: "OK",
        payload: {
          images: [{ url: "https://cdn.shortpulse.test/output.png" }],
        },
      })
    );
    verifyFalWebhookSignatureMock.mockResolvedValue({
      ok: true,
      method: "fal",
      payloadHash: "hash-1",
    });
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "recovered",
      requestId: "req-1",
      generationId: "gen-1",
      mediaFileIds: ["media-1"],
      mediaUrls: ["https://cdn.shortpulse.test/output.png"],
      processed: true,
    });

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.insertSingle).toHaveBeenCalled();
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "webhook",
        requestId: "req-1",
        routeLabel: "fal/webhook",
      })
    );
    expect(supabase.updateEq).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        received: true,
        request_id: "req-1",
        status: "recovered",
      })
    );
  });

  it("resolves request id from canonical payload aliases when headers omit it", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    readFalWebhookHeadersMock.mockReturnValue({
      requestId: null,
      userId: "fal-user-1",
      eventId: null,
      timestamp: String(Math.floor(Date.now() / 1000)),
      signature: "sig",
    });
    readRawBodyMock.mockResolvedValue(
      JSON.stringify({
        id: "event-canonical-1",
        data: {
          task_id: "task-canonical-1",
          status: "completed",
        },
      })
    );
    verifyFalWebhookSignatureMock.mockResolvedValue({
      ok: true,
      method: "fal",
      payloadHash: "hash-1",
    });
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "recovered",
      requestId: "task-canonical-1",
      generationId: "gen-1",
      mediaFileIds: ["media-1"],
      mediaUrls: ["https://cdn.shortpulse.test/output.png"],
      processed: true,
    });

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "task-canonical-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "task-canonical-1",
      })
    );
  });

  it("returns sanitized 500 error responses", async () => {
    readRawBodyMock.mockResolvedValue(JSON.stringify({ request_id: "req-1", status: "OK" }));
    verifyFalWebhookSignatureMock.mockResolvedValue({
      ok: true,
      method: "fal",
      payloadHash: "hash-1",
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { code: "XX000", message: "db down" },
            })),
          })),
        })),
      })),
    });

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Webhook processing failed." });
  });
});

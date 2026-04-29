import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/webhook";
import { RequestBodyTooLargeError } from "../../lib/server/api/requestBody";

const readRawBodyMock = vi.fn();
const verifyFalWebhookSignatureMock = vi.fn();
const verifyFalWebhookBodyHashMock = vi.fn();
const readFalWebhookHeadersMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const parseFalWebhookPayloadMock = vi.fn((rawBody: string) => JSON.parse(rawBody));
const ingestFalWebhookEventMock = vi.fn();

vi.mock("../../lib/server/api/falWebhook", () => ({
  readRawBody: (req: unknown, options: unknown) => readRawBodyMock(req, options),
  verifyFalWebhookSignature: (input: unknown) => verifyFalWebhookSignatureMock(input),
  verifyFalWebhookBodyHash: (input: unknown) => verifyFalWebhookBodyHashMock(input),
  readFalWebhookHeaders: (req: unknown) => readFalWebhookHeadersMock(req),
}));

vi.mock("../../lib/server/falIntegration/falWebhookIngress", () => ({
  parseFalWebhookPayload: (rawBody: string) => parseFalWebhookPayloadMock(rawBody),
  ingestFalWebhookEvent: (input: unknown) => ingestFalWebhookEventMock(input),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (input: unknown) => logApiRouteExceptionMock(input),
  logGenerationFailure: (input: unknown) => logGenerationFailureMock(input),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/fal/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    verifyFalWebhookSignatureMock.mockResolvedValue({
      ok: false,
      method: null,
      reason: "missing_required_fal_headers",
    });

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
    expect(ingestFalWebhookEventMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "fal/webhook",
        source: "api.fal_webhook.signature_invalid",
        statusCode: 400,
        message: "missing_required_fal_headers",
      })
    );
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

  it("rejects invalid payload hashes with structured logging", async () => {
    readRawBodyMock.mockResolvedValue(JSON.stringify({ request_id: "req-1" }));
    verifyFalWebhookSignatureMock.mockResolvedValue({
      ok: true,
      method: "fal",
      payloadHash: "hash-1",
    });
    verifyFalWebhookBodyHashMock.mockReturnValue(false);

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
        "x-fal-webhook-payload-hash": "bad-hash",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid webhook payload hash" });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "fal/webhook",
        source: "api.fal_webhook.payload_hash_invalid",
        statusCode: 400,
        message: "Invalid webhook payload hash",
      })
    );
  });

  it("delegates verified webhook payloads to falWebhookIngress and returns accepted results", async () => {
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
    ingestFalWebhookEventMock.mockResolvedValue({
      kind: "accepted",
      requestId: "req-1",
      status: "completed",
    });

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(parseFalWebhookPayloadMock).toHaveBeenCalled();
    expect(ingestFalWebhookEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          request_id: "req-1",
          status: "OK",
        }),
        headers: expect.objectContaining({
          requestId: "req-1",
          eventId: "event-1",
          userId: "fal-user-1",
        }),
        verificationMethod: "fal",
        payloadHash: "hash-1",
        maxAttempts: expect.any(Number),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        received: true,
        request_id: "req-1",
        status: "completed",
      })
    );
  });

  it("passes canonical payload aliases through to falWebhookIngress when headers omit request id", async () => {
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
    ingestFalWebhookEventMock.mockResolvedValue({
      kind: "accepted",
      requestId: "task-canonical-1",
      status: "completed",
    });

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(ingestFalWebhookEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          requestId: null,
        }),
        payload: expect.objectContaining({
          id: "event-canonical-1",
          data: expect.objectContaining({
            task_id: "task-canonical-1",
          }),
        }),
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
    ingestFalWebhookEventMock.mockRejectedValue(new Error("db down"));

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

  it("logs invalid webhook payload parsing failures", async () => {
    readRawBodyMock.mockResolvedValue("{not-json");
    verifyFalWebhookSignatureMock.mockResolvedValue({
      ok: true,
      method: "fal",
      payloadHash: "hash-1",
    });
    parseFalWebhookPayloadMock.mockImplementationOnce(() => {
      throw new Error("bad json");
    });

    const req = {
      method: "POST",
      headers: {
        "x-fal-webhook-signature": "sig",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid webhook payload" });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "fal/webhook",
        source: "api.fal_webhook.payload_invalid",
        statusCode: 400,
        message: "Invalid webhook payload",
      })
    );
  });
});

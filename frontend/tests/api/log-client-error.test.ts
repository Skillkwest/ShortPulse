import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/log/client-error";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/log/client-error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "inc-1" });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });

  it("writes normalized telemetry for authenticated users", async () => {
    const req = {
      method: "POST",
      body: {
        source: "client.runtime",
        scope: "app",
        severity: "high",
        message: "Boom",
        metadata: { custom: "value" },
      },
      headers: {
        "user-agent": "ua-test",
        host: "localhost:3000",
        "x-vercel-id": "iad1::abc123",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(writeAppErrorLogMock).toHaveBeenCalledTimes(1);
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.runtime",
        scope: "app",
        severity: "high",
        message: "Boom",
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: expect.objectContaining({
          custom: "value",
          user_agent: "ua-test",
          host: "localhost:3000",
          vercel_id: "iad1::abc123",
        }),
      })
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      logged: true,
      skipped: false,
      id: "inc-1",
    });
  });

  it("does not let client metadata override trusted request headers", async () => {
    const req = {
      method: "POST",
      body: {
        source: "client.runtime",
        message: "Boom",
        metadata: {
          user_agent: "spoofed",
          host: "spoofed.example",
          vercel_id: "spoofed-id",
          custom: "value",
        },
      },
      headers: {
        "user-agent": "trusted-ua",
        host: "trusted.example",
        "x-vercel-id": "iad1::trusted",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          custom: "value",
          user_agent: "trusted-ua",
          host: "trusted.example",
          vercel_id: "iad1::trusted",
        }),
      })
    );
  });

  it("returns a safe failure when auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValue(authError);
    const req = {
      method: "POST",
      body: { message: "failure" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "api.log.client-error.auth",
      })
    );
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Client error log ingestion failed." });
  });

  it("returns 500 when telemetry write fails", async () => {
    const writeError = new Error("db down");
    writeAppErrorLogMock.mockRejectedValue(writeError);
    const req = {
      method: "POST",
      body: { message: "failure" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: writeError,
      routeLabel: "api.log.client-error.write",
      user: { id: "user-1", email: "user@example.com" },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Client error log ingestion failed." });
  });

  it("rate limits repeated client-error ingest for the same authenticated user", async () => {
    for (let index = 0; index < 60; index += 1) {
      const req = {
        method: "POST",
        body: { message: `failure-${index}` },
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();
      await handler(req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(202);
    }

    const blockedReq = {
      method: "POST",
      body: { message: "blocked" },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    };
    const blockedRes = createMockResponse();

    await handler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
  });
});

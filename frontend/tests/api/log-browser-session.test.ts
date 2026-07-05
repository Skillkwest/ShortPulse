import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/log/browser-session";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const recordBrowserSessionEventMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/browserCrashSessions", () => ({
  recordBrowserSessionEvent: (...args: unknown[]) => recordBrowserSessionEventMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/log/browser-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    recordBrowserSessionEventMock.mockResolvedValue({
      sessionId: "session-1",
      previousSessionId: null,
      eventType: "heartbeat",
    });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
    expect(recordBrowserSessionEventMock).not.toHaveBeenCalled();
  });

  it("records authenticated browser session events", async () => {
    const req = {
      method: "POST",
      body: {
        eventType: "heartbeat",
        sessionId: "session-1",
        route: "/ai-studio?projectId=secret",
        metadata: { pressure_level: 2 },
      },
      headers: {
        "user-agent": "trusted-ua",
        host: "www.shortpulse.ai",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(recordBrowserSessionEventMock).toHaveBeenCalledWith({
      req,
      user: { id: "user-1", email: "user@example.com" },
      payload: req.body,
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      logged: true,
      sessionId: "session-1",
      previousSessionId: null,
      eventType: "heartbeat",
    });
  });

  it("returns a safe failure when auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValue(authError);
    const req = { method: "POST", body: {}, headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "api.log.browser-session.auth",
      })
    );
    expect(recordBrowserSessionEventMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Browser session log ingestion failed." });
  });

  it("returns a safe failure when persistence fails", async () => {
    const writeError = new Error("db down");
    recordBrowserSessionEventMock.mockRejectedValue(writeError);
    const req = {
      method: "POST",
      body: { eventType: "heartbeat", sessionId: "session-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: writeError,
      routeLabel: "api.log.browser-session.write",
      user: { id: "user-1", email: "user@example.com" },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Browser session log ingestion failed." });
  });

  it("rate limits repeated session events for the same authenticated user", async () => {
    for (let index = 0; index < 180; index += 1) {
      const req = {
        method: "POST",
        body: { eventType: "heartbeat", sessionId: `session-${index}` },
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();
      await handler(req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(202);
    }

    const blockedReq = {
      method: "POST",
      body: { eventType: "heartbeat", sessionId: "blocked" },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    };
    const blockedRes = createMockResponse();
    await handler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(recordBrowserSessionEventMock).toHaveBeenCalledTimes(180);
  });
});

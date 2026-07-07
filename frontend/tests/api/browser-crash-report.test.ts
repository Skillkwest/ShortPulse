import { beforeEach, describe, expect, it, vi } from "vitest";
import handler, { config } from "../../pages/api/browser-crash-report";

const enforceApiRateLimitMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const recordBrowserCrashReportsMock = vi.fn();

vi.mock("../../lib/server/api/rateLimit", () => ({
  enforceApiRateLimit: (...args: unknown[]) => enforceApiRateLimitMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/browserCrashSessions", () => ({
  recordBrowserCrashReports: (...args: unknown[]) => recordBrowserCrashReportsMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn(),
});

describe("POST /api/browser-crash-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceApiRateLimitMock.mockReturnValue(true);
    recordBrowserCrashReportsMock.mockResolvedValue({
      received: 1,
      processed: 1,
      skipped: 0,
      sessionIds: ["browser-session-1"],
    });
  });

  it("uses a small body limit because the route is browser-public", () => {
    expect(config.api.bodyParser.sizeLimit).toBe("64kb");
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {}, headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
    expect(enforceApiRateLimitMock).not.toHaveBeenCalled();
    expect(recordBrowserCrashReportsMock).not.toHaveBeenCalled();
  });

  it("accepts browser-delivered crash reports without bearer auth", async () => {
    const payload = [{ type: "crash", body: { reason: "oom" } }];
    const req = { method: "POST", body: payload, headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(enforceApiRateLimitMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        keyPrefix: "browser-crash-report",
      })
    );
    expect(recordBrowserCrashReportsMock).toHaveBeenCalledWith({ payload });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      received: 1,
      processed: 1,
      skipped: 0,
      sessionIds: ["browser-session-1"],
    });
  });

  it("stops when rate limited", async () => {
    enforceApiRateLimitMock.mockReturnValue(false);
    const req = { method: "POST", body: [], headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(recordBrowserCrashReportsMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("logs and returns a safe error when ingestion fails", async () => {
    const error = new Error("database unavailable");
    recordBrowserCrashReportsMock.mockRejectedValue(error);
    const req = { method: "POST", body: [{ type: "crash" }], headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error,
        routeLabel: "api/browser-crash-report.ingest",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to record browser crash report.",
    });
  });
});

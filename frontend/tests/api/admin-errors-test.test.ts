import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/errors-test";

const requireAdminUserMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/errors-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("logs admin auth verifier exceptions before writing synthetic incidents", async () => {
    const authError = new Error("auth verifier unavailable");
    requireAdminUserMock.mockRejectedValueOnce(authError);
    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "admin/errors-test.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to create synthetic incident." });
  });

  it("creates a generation-scoped synthetic incident", async () => {
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "incident-1" });
    const req = {
      method: "POST",
      url: "/api/admin/errors-test",
      body: {
        scope: "generation",
      },
      headers: {
        "x-shortpulse-request-id": "req-123",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(writeAppErrorLogMock).toHaveBeenCalledTimes(1);
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "admin.synthetic_test.generation",
        scope: "generation",
        severity: "high",
        statusCode: 502,
        route: "admin/errors-test",
        endpoint: "/api/admin/errors-test",
        requestId: "req-123",
        userId: "admin-1",
        userEmail: "admin@example.com",
      })
    );
    const payload = writeAppErrorLogMock.mock.calls[0]?.[0] as { message: string };
    expect(payload.message).toContain("Admin synthetic generation incident");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        logged: true,
        skipped: false,
        incidentId: "incident-1",
        scope: "generation",
      })
    );
  });

  it("returns 500 when synthetic incident creation fails", async () => {
    writeAppErrorLogMock.mockResolvedValue({ ok: false, skipped: false, id: null });
    const req = {
      method: "POST",
      url: "/api/admin/errors-test",
      body: { scope: "app" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to create synthetic incident." });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/crashes-status";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const updateBrowserCrashSessionReviewStatusMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/browserCrashSessions", () => ({
  updateBrowserCrashSessionReviewStatus: (...args: unknown[]) =>
    updateBrowserCrashSessionReviewStatusMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/crashes-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    updateBrowserCrashSessionReviewStatusMock.mockResolvedValue({
      id: "crash-1",
      review_status: "resolved",
      reviewed_at: "2026-07-05T12:00:00.000Z",
    });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
    expect(updateBrowserCrashSessionReviewStatusMock).not.toHaveBeenCalled();
  });

  it("updates crash-session review state for admins", async () => {
    const req = {
      method: "POST",
      body: { sessionId: "crash-1", status: "resolved" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(updateBrowserCrashSessionReviewStatusMock).toHaveBeenCalledWith({
      user: { id: "admin-1", email: "admin@example.com" },
      payload: { sessionId: "crash-1", status: "resolved" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      session: {
        id: "crash-1",
        review_status: "resolved",
        reviewed_at: "2026-07-05T12:00:00.000Z",
      },
    });
  });

  it("maps validation failures to 400", async () => {
    updateBrowserCrashSessionReviewStatusMock.mockRejectedValue(
      new Error("status must be one of open, resolved, ignored.")
    );
    const req = { method: "POST", body: { sessionId: "crash-1", status: "done" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "status must be one of open, resolved, ignored.",
    });
  });

  it("returns a safe failure when admin auth throws", async () => {
    const authError = new Error("auth failed");
    requireAdminUserMock.mockRejectedValue(authError);
    const req = { method: "POST", body: { sessionId: "crash-1", status: "resolved" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/crashes-status.auth",
      })
    );
    expect(updateBrowserCrashSessionReviewStatusMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update crash session." });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/errors-status-bulk";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/errors-status-bulk", () => {
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

  it("requires a non-empty errorIds array", async () => {
    const req = { method: "POST", body: { status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "errorIds must be a non-empty array." });
  });

  it("requires a valid status", async () => {
    const req = { method: "POST", body: { errorIds: ["inc-1"] } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "status must be one of open, resolved, ignored.",
    });
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = { method: "POST", body: { errorIds: ["inc-1"], status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/errors-status-bulk.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update incident status." });
  });

  it("updates multiple incidents in one batch", async () => {
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          incident_id: "inc-1",
          status: "resolved",
          updated_at: "2026-02-27T22:00:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          incident_id: "inc-2",
          status: "resolved",
          updated_at: "2026-02-27T22:00:01.000Z",
        },
        error: null,
      });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      method: "POST",
      body: { errorIds: ["inc-1", "inc-2"], status: "resolved", note: "bulk close" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rpcMock).toHaveBeenNthCalledWith(1, "admin_update_app_error_status", {
      p_error_id: "inc-1",
      p_event_id: null,
      p_status: "resolved",
      p_note: "bulk close",
      p_admin_user_id: "admin-1",
      p_admin_user_email: "admin@example.com",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "admin_update_app_error_status", {
      p_error_id: "inc-2",
      p_event_id: null,
      p_status: "resolved",
      p_note: "bulk close",
      p_admin_user_id: "admin-1",
      p_admin_user_email: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      partial: false,
      status: "resolved",
      summary: {
        requestedCount: 2,
        updatedCount: 2,
        failedCount: 0,
      },
      updatedIncidentIds: ["inc-1", "inc-2"],
      failed: [],
    });
  });

  it("returns partial success when some incidents fail", async () => {
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          incident_id: "inc-1",
          status: "ignored",
          updated_at: "2026-02-27T22:10:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0002", message: "Incident not found." },
      });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      method: "POST",
      body: { errorIds: ["inc-1", "inc-missing"], status: "ignored" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      partial: true,
      status: "ignored",
      summary: {
        requestedCount: 2,
        updatedCount: 1,
        failedCount: 1,
      },
      updatedIncidentIds: ["inc-1"],
      failed: [{ errorId: "inc-missing", error: "Incident not found.", code: "P0002" }],
    });
  });

  it("returns 500 when all batch updates fail", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "Incident not found." },
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      method: "POST",
      body: { errorIds: ["inc-missing"], status: "resolved" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      partial: false,
      status: "resolved",
      summary: {
        requestedCount: 1,
        updatedCount: 0,
        failedCount: 1,
      },
      updatedIncidentIds: [],
      failed: [{ errorId: "inc-missing", error: "Incident not found.", code: "P0002" }],
    });
  });

  it("logs and returns 500 when top-level execution throws", async () => {
    getSupabaseAdminMock.mockImplementation(() => {
      throw new Error("no supabase");
    });

    const req = {
      method: "POST",
      body: { errorIds: ["inc-1"], status: "resolved" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "no supabase" });
  });
});

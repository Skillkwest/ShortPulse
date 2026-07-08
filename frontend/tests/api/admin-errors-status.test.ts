import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/errors-status";

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

const createEventLookupMock = (
  result: {
    data: { source: string | null; incident_id: string | null } | null;
    error: { code?: string; message?: string } | null;
  } = { data: { source: "api.example", incident_id: null }, error: null }
) =>
  vi.fn(() => {
    const maybeSingle = vi.fn(async () => result);
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    return { select };
  });

describe("POST /api/admin/errors-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("requires either errorId or eventId", async () => {
    const req = { method: "POST", body: { status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "errorId or eventId is required." });
  });

  it("requires valid status", async () => {
    const req = { method: "POST", body: { errorId: "err_1", status: "done" } };
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

    const req = { method: "POST", body: { errorId: "inc-1", status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/errors-status.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update incident status." });
  });

  it("updates an existing incident by errorId through rpc", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        incident_id: "inc-1",
        status: "resolved",
        updated_at: "2026-02-17T00:00:00.000Z",
        event_id: null,
      },
      error: null,
    });

    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "POST", body: { errorId: "inc-1", status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rpcMock).toHaveBeenCalledWith("admin_update_app_error_status", {
      p_error_id: "inc-1",
      p_event_id: null,
      p_status: "resolved",
      p_note: null,
      p_admin_user_id: "admin-1",
      p_admin_user_email: "admin@example.com",
      p_watch_item: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      incident: { id: "inc-1", status: "resolved", updated_at: "2026-02-17T00:00:00.000Z" },
    });
  });

  it("passes watch note metadata for resolved watch items", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        incident_id: "inc-watch",
        status: "resolved",
        updated_at: "2026-02-17T00:15:00.000Z",
        event_id: null,
      },
      error: null,
    });

    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      method: "POST",
      body: {
        errorId: "inc-watch",
        status: "resolved",
        note: "Kie upload recovered; monitor recurrence.",
        watch: true,
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rpcMock).toHaveBeenCalledWith("admin_update_app_error_status", {
      p_error_id: "inc-watch",
      p_event_id: null,
      p_status: "resolved",
      p_note: "Kie upload recovered; monitor recurrence.",
      p_admin_user_id: "admin-1",
      p_admin_user_email: "admin@example.com",
      p_watch_item: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects watch markers for non-resolved statuses", async () => {
    const rpcMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "POST", body: { errorId: "inc-1", status: "ignored", watch: true } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rpcMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "watch items must use resolved status." });
  });

  it("returns eventId when rpc promotes event to incident", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        incident_id: "inc-promoted",
        status: "ignored",
        updated_at: "2026-02-17T04:20:00.000Z",
        event_id: "evt-1",
      },
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock, from: createEventLookupMock() });

    const req = { method: "POST", body: { eventId: "evt-1", status: "ignored" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      incident: { id: "inc-promoted", status: "ignored", updated_at: "2026-02-17T04:20:00.000Z" },
      eventId: "evt-1",
    });
  });

  it("does not promote routine telemetry-only events to incidents", async () => {
    const rpcMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
      from: createEventLookupMock({
        data: { source: "telemetry.ai_studio.stability.window_focus", incident_id: null },
        error: null,
      }),
    });

    const req = { method: "POST", body: { eventId: "evt-routine", status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rpcMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Routine telemetry events are raw evidence and cannot be promoted to incidents.",
    });
  });

  it("allows routine telemetry event status updates when already linked to an incident", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        incident_id: "inc-linked-telemetry",
        status: "ignored",
        updated_at: "2026-02-17T04:30:00.000Z",
        event_id: "evt-linked",
      },
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
      from: createEventLookupMock({
        data: { source: "telemetry.ai_studio.stability.window_focus", incident_id: "inc-linked" },
        error: null,
      }),
    });

    const req = { method: "POST", body: { eventId: "evt-linked", status: "ignored" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rpcMock).toHaveBeenCalledWith("admin_update_app_error_status", {
      p_error_id: null,
      p_event_id: "evt-linked",
      p_status: "ignored",
      p_note: null,
      p_admin_user_id: "admin-1",
      p_admin_user_email: "admin@example.com",
      p_watch_item: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps rpc not-found error to 404", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "Event not found." },
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "POST", body: { errorId: "inc-missing", status: "open" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: { code: "P0002", message: "Event not found." },
      routeLabel: "admin/errors-status.rpc",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        target_error_id: "inc-missing",
        target_event_id: null,
        target_status: "open",
        target_watch_item: false,
        rpc_error_code: "P0002",
      },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Event not found." });
  });

  it("maps rpc validation error to 400", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "22023", message: "status must be one of open, resolved, ignored." },
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "POST", body: { errorId: "inc-1", status: "open" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "status must be one of open, resolved, ignored.",
    });
  });

  it("normalizes array rpc payloads", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          incident_id: "inc-array",
          status: "open",
          updated_at: "2026-02-27T12:00:00.000Z",
          event_id: null,
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "POST", body: { errorId: "inc-array", status: "open" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      incident: { id: "inc-array", status: "open", updated_at: "2026-02-27T12:00:00.000Z" },
    });
  });

  it("fails closed when rpc payload is missing incident_id", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: { status: "resolved", updated_at: "2026-02-27T13:00:00.000Z", event_id: null },
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "POST", body: { errorId: "inc-missing", status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/errors-status.rpc-payload",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        target_error_id: "inc-missing",
        target_event_id: null,
        target_status: "resolved",
        target_watch_item: false,
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update incident status." });
  });

  it("logs and returns 500 when rpc throws", async () => {
    const rpcMock = vi.fn().mockRejectedValue(new Error("rpc exploded"));
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "POST", body: { errorId: "inc-throw", status: "ignored" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "rpc exploded" });
  });
});

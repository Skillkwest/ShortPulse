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

  it("updates an existing incident by errorId", async () => {
    const incidentSelectMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "inc-1", status: "open", metadata: null },
      error: null,
    });
    const incidentUpdateMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "inc-1", status: "resolved", updated_at: "2026-02-17T00:00:00.000Z" },
      error: null,
    });

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table !== "app_error_logs") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          select: () => ({
            eq: () => ({
              maybeSingle: incidentSelectMaybeSingle,
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: incidentUpdateMaybeSingle,
              }),
            }),
          }),
        };
      },
    });

    const req = { method: "POST", body: { errorId: "inc-1", status: "resolved" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      incident: { id: "inc-1", status: "resolved", updated_at: "2026-02-17T00:00:00.000Z" },
    });
    expect(incidentSelectMaybeSingle).toHaveBeenCalledTimes(1);
    expect(incidentUpdateMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("promotes an unlinked event and applies ignored status", async () => {
    const eventSelectMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "evt-1",
        incident_id: null,
        fingerprint: "fp-1",
        source: "client.runtime",
        scope: "app",
        severity: "high",
        message: "mode is not defined",
        stack: "ReferenceError: mode is not defined",
        route: "/ai-studio",
        endpoint: null,
        request_id: "req-1",
        http_status: null,
        user_id: "user-1",
        user_email: "user@example.com",
        metadata: { host: "localhost:3000" },
        occurred_at: "2026-02-17T04:19:47.375+00:00",
      },
      error: null,
    });
    const incidentInsertMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "inc-promoted", status: "ignored", updated_at: "2026-02-17T04:20:00.000Z" },
      error: null,
    });
    const eventLinkEq = vi.fn().mockResolvedValue({ error: null });

    const incidentInsert = vi.fn(() => ({
      select: () => ({
        maybeSingle: incidentInsertMaybeSingle,
      }),
    }));
    const eventUpdate = vi.fn(() => ({
      eq: eventLinkEq,
    }));

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "app_error_events") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: eventSelectMaybeSingle,
              }),
            }),
            update: eventUpdate,
          };
        }
        if (table === "app_error_logs") {
          return {
            insert: incidentInsert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const req = { method: "POST", body: { eventId: "evt-1", status: "ignored" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(incidentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ignored",
        source: "client.runtime",
        fingerprint: "fp-1",
      })
    );
    expect(eventUpdate).toHaveBeenCalledWith({ incident_id: "inc-promoted" });
    expect(eventLinkEq).toHaveBeenCalledWith("id", "evt-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      incident: { id: "inc-promoted", status: "ignored", updated_at: "2026-02-17T04:20:00.000Z" },
      eventId: "evt-1",
    });
  });
});

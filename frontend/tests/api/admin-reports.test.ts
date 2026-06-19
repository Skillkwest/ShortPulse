import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/reports";

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

describe("GET /api/admin/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = { method: "GET", query: { page: "1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "api.admin.reports.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load reports right now." });
  });

  it("logs report list query failures before returning the safe load error", async () => {
    const listError = { message: "issue report list query failed" };
    const rangeMock = vi.fn().mockResolvedValue({
      data: null,
      count: null,
      error: listError,
    });
    const orderMock = vi.fn(() => ({ range: rangeMock }));
    const selectMock = vi.fn(() => ({ order: orderMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = { method: "GET", query: { page: "1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: listError,
      routeLabel: "api.admin.reports.list",
      user: { id: "admin-1", email: "admin@example.com" },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "issue report list query failed" });
  });

  it("logs degraded summary count queries while preserving the report list response", async () => {
    const summaryError = { message: "summary count failed" };
    const rangeMock = vi.fn().mockResolvedValue({
      data: [{ id: "report-1", status: "new" }],
      count: 1,
      error: null,
    });
    const orderMock = vi.fn(() => ({ range: rangeMock }));
    const eqMock = vi
      .fn()
      .mockResolvedValueOnce({ count: null, error: summaryError })
      .mockResolvedValueOnce({ count: 0, error: null })
      .mockResolvedValueOnce({ count: 0, error: null });
    const selectMock = vi.fn((_columns: string, options?: { head?: boolean }) => {
      if (options?.head) {
        return {
          count: null,
          error: summaryError,
          eq: eqMock,
        };
      }
      return { order: orderMock };
    });
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = { method: "GET", query: { page: "1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "api.admin.reports.summary",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        total_count_error: "summary count failed",
        new_count_error: "summary count failed",
        reviewing_count_error: null,
        resolved_count_error: null,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      reports: [{ id: "report-1", status: "new" }],
      summary: {
        totalCount: 0,
        newCount: 0,
        reviewingCount: 0,
        resolvedCount: 0,
      },
      pagination: {
        page: 1,
        perPage: 50,
        totalCount: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH } from "../../lib/issueReports";
import handler from "../../pages/api/admin/reports/[reportId]";

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

describe("PATCH /api/admin/reports/[reportId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects admin notes that exceed the supported length", async () => {
    const req = {
      method: "PATCH",
      query: { reportId: "report-1" },
      body: { adminNotes: "a".repeat(ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH + 1) },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: `Admin notes must be ${ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = {
      method: "PATCH",
      query: { reportId: "report-1" },
      body: { status: "reviewing" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "api.admin.reports.[reportId].auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to verify report access." });
  });

  it("logs detail load query failures before returning the safe load error", async () => {
    const loadError = { message: "detail load failed" };
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: loadError,
    });
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "GET",
      query: { reportId: "report-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: loadError,
      routeLabel: "api.admin.reports.[reportId].get",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        report_id: "report-1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load that report right now." });
  });

  it("logs report update failures before returning the safe update error", async () => {
    const updateError = { message: "report update failed" };
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: updateError,
    });
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "PATCH",
      query: { reportId: "report-1" },
      body: { status: "reviewing" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: updateError,
      routeLabel: "api.admin.reports.[reportId].patch",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        report_id: "report-1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update that report right now." });
  });
});

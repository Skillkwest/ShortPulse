import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/announcements/clear";

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
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

describe("POST /api/admin/announcements/clear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 403 for non-admin callers", async () => {
    requireAdminUserMock.mockImplementationOnce(async (_req: unknown, res: MockResponse) => {
      res.status(403).json({ error: "Forbidden" });
      return null;
    });

    const req = { method: "POST" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("clears active announcements", async () => {
    const eqMock = vi.fn(async () => ({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    getSupabaseAdminMock.mockReturnValue({
      from: fromMock,
    });

    const req = { method: "POST" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(fromMock).toHaveBeenCalledWith("dashboard_announcements");
    expect(updateMock).toHaveBeenCalledWith({
      is_active: false,
      updated_by: "admin-1",
    });
    expect(eqMock).toHaveBeenCalledWith("is_active", true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

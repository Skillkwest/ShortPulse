import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/crashes";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const fetchBrowserCrashSessionsMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/browserCrashSessions", () => ({
  fetchBrowserCrashSessions: (...args: unknown[]) => fetchBrowserCrashSessionsMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/admin/crashes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    fetchBrowserCrashSessionsMock.mockResolvedValue({
      sessions: [{ id: "session-row-1", status: "probable_freeze_or_crash" }],
      pagination: { page: 2, perPage: 25, totalCount: 1, totalPages: 1 },
    });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
    expect(fetchBrowserCrashSessionsMock).not.toHaveBeenCalled();
  });

  it("loads crash sessions for admins with bounded filters", async () => {
    const req = {
      method: "GET",
      query: {
        page: "2",
        limit: "25",
        status: "probable_freeze_or_crash",
        search: "user@example.com",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchBrowserCrashSessionsMock).toHaveBeenCalledWith({
      page: 2,
      limit: 25,
      status: "probable_freeze_or_crash",
      search: "user@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      sessions: [{ id: "session-row-1", status: "probable_freeze_or_crash" }],
      pagination: { page: 2, perPage: 25, totalCount: 1, totalPages: 1 },
    });
  });

  it("falls back to safe defaults for unsupported filters", async () => {
    const req = {
      method: "GET",
      query: { page: "-1", limit: "500", status: "weird", search: "x".repeat(200) },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchBrowserCrashSessionsMock).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
      status: "all",
      search: "x".repeat(120),
    });
  });

  it("returns a safe failure when admin auth throws", async () => {
    const authError = new Error("auth failed");
    requireAdminUserMock.mockRejectedValue(authError);
    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/crashes.auth",
      })
    );
    expect(fetchBrowserCrashSessionsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load crash sessions." });
  });

  it("returns a safe failure when list loading fails", async () => {
    const listError = new Error("db unavailable");
    fetchBrowserCrashSessionsMock.mockRejectedValue(listError);
    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: listError,
      routeLabel: "admin/crashes.list",
      user: { id: "admin-1", email: "admin@example.com" },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load crash sessions." });
  });
});

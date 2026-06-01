import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/access";

const requireApiUserMock = vi.fn();
const resolveAdminAccessViaMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  resolveAdminAccessVia: (...args: unknown[]) => resolveAdminAccessViaMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn(),
});

describe("GET /api/admin/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 403 when verified user is not admin", async () => {
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveAdminAccessViaMock.mockReturnValue("none");

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      isAdmin: false,
      accessVia: "none",
    });
  });

  it("returns 200 with role access when user is admin via role", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    resolveAdminAccessViaMock.mockReturnValue("role");

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      isAdmin: true,
      accessVia: "role",
      user: {
        id: "admin-1",
        email: "admin@example.com",
      },
    });
  });

  it("returns 403 when verified user only matches a legacy allowlist email", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-2", email: "allowlisted@example.com" });
    resolveAdminAccessViaMock.mockReturnValue("none");

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      isAdmin: false,
      accessVia: "none",
    });
  });

  it("returns 500 when access resolution throws", async () => {
    requireApiUserMock.mockRejectedValue(new Error("boom"));

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to verify admin access." });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/announcements/publish";

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

describe("POST /api/admin/announcements/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
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

    const req = { method: "POST", body: { title: "T", message: "M" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payloads", async () => {
    const req = { method: "POST", body: { title: "   ", message: "" } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Title is required." });
  });

  it("returns 400 when title exceeds max length", async () => {
    const req = {
      method: "POST",
      body: { title: "a".repeat(121), message: "valid message" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Title must be 120 characters or fewer." });
  });

  it("publishes and returns the active announcement", async () => {
    const rpcMock = vi.fn(async () => ({
      data: [
        {
          id: "ann-1",
          title: "Studio update",
          message: "New style controls ship today.",
          published_at: "2026-03-10T08:00:00.000Z",
          updated_at: "2026-03-10T08:00:00.000Z",
        },
      ],
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
    });

    const req = {
      method: "POST",
      body: { title: " Studio update ", message: " New style controls ship today. " },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rpcMock).toHaveBeenCalledWith("publish_dashboard_announcement", {
      p_title: "Studio update",
      p_message: "New style controls ship today.",
      p_actor_user_id: "admin-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      announcement: {
        id: "ann-1",
        title: "Studio update",
        message: "New style controls ship today.",
        publishedAt: "2026-03-10T08:00:00.000Z",
        updatedAt: "2026-03-10T08:00:00.000Z",
      },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/announcements/active";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
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

describe("GET /api/announcements/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns null when no active announcement exists", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ announcement: null });
  });

  it("returns the active announcement payload", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "ann-1",
                title: "Planned maintenance",
                message: "AI Studio deploy starts at 2AM UTC.",
                published_at: "2026-03-10T00:00:00.000Z",
                updated_at: "2026-03-10T00:05:00.000Z",
              },
              error: null,
            })),
          })),
        })),
      })),
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      announcement: {
        id: "ann-1",
        title: "Planned maintenance",
        message: "AI Studio deploy starts at 2AM UTC.",
        publishedAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:05:00.000Z",
      },
    });
  });

  it("returns 401 when caller is unauthenticated", async () => {
    requireApiUserMock.mockImplementationOnce(async (_req: unknown, res: MockResponse) => {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("logs unexpected auth failures before reading announcement state", async () => {
    requireApiUserMock.mockRejectedValue(new Error("auth verifier exploded"));

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "announcements/active.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load active announcement." });
  });
});

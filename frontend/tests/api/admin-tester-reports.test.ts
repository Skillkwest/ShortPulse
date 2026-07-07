import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/tester-reports";

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

describe("GET /api/admin/tester-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);
    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "api.admin.tester-reports.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load tester reports right now.",
    });
  });

  it("lists filtered tester report runs with summary counts", async () => {
    const listBuilder = {
      eq: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: "report-run-1", tester_slug: "maya-chen", status: "completed" }],
        count: 1,
        error: null,
      }),
    };
    listBuilder.eq.mockReturnValue(listBuilder);
    listBuilder.or.mockReturnValue(listBuilder);
    listBuilder.order.mockReturnValue(listBuilder);
    const countBuilder = {
      count: 1,
      error: null,
      eq: vi.fn(() => ({ count: 1, error: null })),
    };
    const rangeMock = vi.fn().mockResolvedValue({
      data: [{ id: "report-run-1", tester_slug: "maya-chen", status: "completed" }],
      count: 1,
      error: null,
    });
    listBuilder.range = rangeMock;
    const selectMock = vi.fn((_columns: string, options?: { head?: boolean }) => {
      if (options?.head) {
        return countBuilder;
      }
      return listBuilder;
    });
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "GET",
      query: {
        page: "1",
        limit: "25",
        tester: "maya-chen",
        status: "completed",
        hyberveesReview: "unreviewed",
        search: "orientation",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fromMock).toHaveBeenCalledWith("tester_report_runs");
    expect(listBuilder.eq).toHaveBeenCalledWith("status", "completed");
    expect(listBuilder.eq).toHaveBeenCalledWith("hybervees_review_status", "unreviewed");
    expect(listBuilder.eq).toHaveBeenCalledWith("tester_slug", "maya-chen");
    expect(listBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(listBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("scenario.ilike.%orientation%")
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reports: [{ id: "report-run-1", tester_slug: "maya-chen", status: "completed" }],
        summary: {
          totalCount: 1,
          completedCount: 1,
          blockedCount: 1,
          failedCount: 1,
          partialCount: 1,
          hyberveesUnreviewedCount: 1,
          hyberveesReviewedCount: 1,
        },
      })
    );
  });
});

/**
 * API tests for admin fleet user-health report endpoint.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/user-health-fleet";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const readAdminUserHealthFleetReportMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/adminUserHealth/fleet", () => ({
  readAdminUserHealthFleetReport: (...args: unknown[]) =>
    readAdminUserHealthFleetReportMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/admin/user-health-fleet", () => {
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

  it("returns fleet report payload", async () => {
    readAdminUserHealthFleetReportMock.mockResolvedValue({
      run: {
        id: "run-1",
        triggerSource: "scheduled",
        status: "completed",
        lookbackDays: 30,
        activeWindowDays: 30,
        retentionDays: 90,
        targetCount: 5,
        processedCount: 5,
        failedCount: 0,
        partialData: false,
        startedAt: "2026-03-14T16:00:00.000Z",
        finishedAt: "2026-03-14T16:00:10.000Z",
        durationMs: 10_000,
        errorSummary: null,
        metadata: {},
        drainage: {
          enabled: true,
          scanned: 12,
          released: 4,
          errors: 0,
        },
      },
      summary: {
        criticalCount: 1,
        warningCount: 2,
        infoCount: 2,
        highRiskCount: 1,
        mediumRiskCount: 2,
        lowRiskCount: 2,
        totalCostWithoutSuccessCents: 300,
        totalStuckGenerations: 2,
      },
      snapshots: [],
      pagination: {
        page: 1,
        perPage: 50,
        totalCount: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      health: {
        degraded: false,
        reason: null,
      },
    });

    const req = {
      method: "GET",
      query: {
        page: "2",
        perPage: "250",
        severity: "critical",
        findingCode: "STUCK_GENERATIONS",
        riskBand: "high",
        search: "kirkartman00@gmail.com",
        runId: "run-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(readAdminUserHealthFleetReportMock).toHaveBeenCalledWith({
      runId: "run-1",
      page: 2,
      perPage: 100,
      severity: "critical",
      findingCode: "STUCK_GENERATIONS",
      riskBand: "high",
      search: "kirkartman00@gmail.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        run: expect.objectContaining({ id: "run-1" }),
        filters: {
          runId: "run-1",
          severity: "critical",
          findingCode: "STUCK_GENERATIONS",
          riskBand: "high",
          search: "kirkartman00@gmail.com",
        },
      })
    );
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);
    const req = { method: "GET", query: { runId: "run-1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/user-health-fleet.auth",
      })
    );
    expect(readAdminUserHealthFleetReportMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load fleet health report." });
  });

  it("logs and returns 500 when report load fails", async () => {
    readAdminUserHealthFleetReportMock.mockRejectedValueOnce(new Error("fleet read failed"));
    const req = { method: "GET", query: { page: "1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "admin/user-health-fleet",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "fleet read failed",
    });
  });
});

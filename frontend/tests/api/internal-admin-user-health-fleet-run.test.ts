/**
 * API tests for internal admin user-health fleet runner auth and control flow.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/admin-user-health-fleet/run";

const logApiRouteExceptionMock = vi.fn();
const runAdminUserHealthFleetScanMock = vi.fn();
const readAdminUserHealthFleetRuntimeFlagsMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/adminUserHealth/fleet", () => ({
  runAdminUserHealthFleetScan: (...args: unknown[]) => runAdminUserHealthFleetScanMock(...args),
}));

vi.mock("../../lib/server/adminUserHealth/runtime", () => ({
  readAdminUserHealthFleetRuntimeFlags: (...args: unknown[]) =>
    readAdminUserHealthFleetRuntimeFlagsMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/internal/admin-user-health-fleet/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    readAdminUserHealthFleetRuntimeFlagsMock.mockReturnValue({
      enabled: true,
      cronSecret: "fleet-secret",
    });
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "DELETE", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns not found when fleet automation is disabled", async () => {
    readAdminUserHealthFleetRuntimeFlagsMock.mockReturnValue({
      enabled: false,
      cronSecret: "fleet-secret",
    });
    const req = { method: "POST", headers: { "x-shortpulse-cron-secret": "fleet-secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });

  it("requires cron-secret auth", async () => {
    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("accepts POST with x-shortpulse-cron-secret and defaults trigger to scheduled", async () => {
    runAdminUserHealthFleetScanMock.mockResolvedValue({
      ok: true,
      status: "completed",
      runId: "run-1",
      targeted: 2,
      processed: 2,
      failed: 0,
      partial: false,
      criticalUsers: 0,
      warningUsers: 1,
      totalCostWithoutSuccessCents: 50,
      drainage: {
        enabled: true,
        scanned: 7,
        released: 2,
        errors: 0,
      },
      durationMs: 1234,
      errors: [],
    });

    const req = { method: "POST", headers: { "x-shortpulse-cron-secret": "fleet-secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runAdminUserHealthFleetScanMock).toHaveBeenCalledWith({
      triggerSource: "scheduled",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        status: "completed",
        runId: "run-1",
        drainage: expect.objectContaining({
          enabled: true,
          scanned: 7,
          released: 2,
          errors: 0,
        }),
      })
    );
  });

  it("accepts POST with bearer token and CRON_SECRET fallback", async () => {
    readAdminUserHealthFleetRuntimeFlagsMock.mockReturnValue({
      enabled: true,
      cronSecret: null,
    });
    process.env.CRON_SECRET = "vercel-secret";
    runAdminUserHealthFleetScanMock.mockResolvedValue({
      ok: true,
      status: "partial",
      runId: "run-2",
      targeted: 10,
      processed: 8,
      failed: 2,
      partial: true,
      criticalUsers: 1,
      warningUsers: 3,
      totalCostWithoutSuccessCents: 500,
      durationMs: 4000,
      errors: ["time budget reached"],
    });

    const req = { method: "POST", headers: { authorization: "Bearer vercel-secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runAdminUserHealthFleetScanMock).toHaveBeenCalledWith({
      triggerSource: "scheduled",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("accepts explicit manual trigger overrides on POST", async () => {
    runAdminUserHealthFleetScanMock.mockResolvedValue({
      ok: true,
      status: "completed",
      runId: "run-manual",
      targeted: 1,
      processed: 1,
      failed: 0,
      partial: false,
      criticalUsers: 0,
      warningUsers: 0,
      totalCostWithoutSuccessCents: 0,
      drainage: {
        enabled: false,
        scanned: 0,
        released: 0,
        errors: 0,
      },
      durationMs: 30,
      errors: [],
    });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "fleet-secret",
        "x-shortpulse-trigger-source": "manual",
      },
      query: {},
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runAdminUserHealthFleetScanMock).toHaveBeenCalledWith({
      triggerSource: "manual",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 200 when a scheduled overlapping run is already active", async () => {
    runAdminUserHealthFleetScanMock.mockResolvedValue({
      ok: false,
      status: "running",
      runId: "run-3",
      targeted: 0,
      processed: 0,
      failed: 0,
      partial: true,
      criticalUsers: 0,
      warningUsers: 0,
      totalCostWithoutSuccessCents: 0,
      durationMs: 20,
      errors: ["A fleet scan run is already active."],
    });

    const req = { method: "POST", headers: { "x-shortpulse-cron-secret": "fleet-secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 409 when a manual overlapping run is already active", async () => {
    runAdminUserHealthFleetScanMock.mockResolvedValue({
      ok: false,
      status: "running",
      runId: "run-3",
      targeted: 0,
      processed: 0,
      failed: 0,
      partial: true,
      criticalUsers: 0,
      warningUsers: 0,
      totalCostWithoutSuccessCents: 0,
      durationMs: 20,
      errors: ["A fleet scan run is already active."],
    });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "fleet-secret",
        "x-shortpulse-trigger-source": "manual",
      },
      query: {},
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("logs and returns 500 when scan execution throws", async () => {
    runAdminUserHealthFleetScanMock.mockRejectedValueOnce(new Error("fleet exploded"));
    const req = { method: "POST", headers: { "x-shortpulse-cron-secret": "fleet-secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "internal/admin-user-health-fleet/run",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "fleet exploded" });
  });
});

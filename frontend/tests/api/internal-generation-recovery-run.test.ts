import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/generation-recovery/run";

const logApiRouteExceptionMock = vi.fn();
const runGenerationControlPlaneCycleMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/generationControlPlane/runCycle", () => ({
  runGenerationControlPlaneCycle: (...args: unknown[]) =>
    runGenerationControlPlaneCycleMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/internal/generation-recovery/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_FAL_RECONCILER_ENABLED = "true";
    process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET = "cron-secret";
    delete process.env.CRON_SECRET;
    runGenerationControlPlaneCycleMock.mockResolvedValue({
      ok: true,
      claimed: 1,
      processed: 1,
      recovered: 1,
      requeued: 0,
      exhausted: 0,
      skipped: 0,
      duplicates: 0,
      errors: 0,
      observationClaimed: 0,
      observationProcessed: 0,
      observationIgnored: 0,
      observationFailed: 0,
      observationErrors: 0,
      reservationCleanupScanned: 0,
      reservationCleanupReleased: 0,
      reservationCleanupErrors: 0,
      audioCompanionArtClaimed: 0,
      audioCompanionArtProcessed: 0,
      audioCompanionArtReady: 0,
      audioCompanionArtFailed: 0,
      audioCompanionArtSkipped: 0,
      audioCompanionArtErrors: 0,
      stageTimings: {
        reservationCleanup: { durationMs: 0 },
        providerAttachedReservationCleanup: { durationMs: 0 },
        observationInboxProcessing: { durationMs: 0 },
        recoveryClaim: { durationMs: 0 },
        recoveryExecution: { durationMs: 0 },
        projectionRepair: { durationMs: 0 },
        audioCompanionArtProcessing: { durationMs: 0 },
      },
    });
  });

  it("requires the cron secret", async () => {
    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runGenerationControlPlaneCycleMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("rejects GET because the recovery runner mutates state", async () => {
    const req = {
      method: "GET",
      headers: {
        authorization: "Bearer cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runGenerationControlPlaneCycleMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("accepts bearer token auth with CRON_SECRET fallback when route secret is unset", async () => {
    delete process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET;
    process.env.CRON_SECRET = "vercel-cron-secret";

    const req = {
      method: "POST",
      headers: {
        authorization: "Bearer vercel-cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runGenerationControlPlaneCycleMock).toHaveBeenCalledWith({
      context: expect.objectContaining({
        req,
        routeLabel: "internal/generation-recovery/run",
      }),
      mode: "primary",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        runMode: "primary",
      })
    );
  });

  it("runs in primary mode by default", async () => {
    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runGenerationControlPlaneCycleMock).toHaveBeenCalledWith({
      context: expect.objectContaining({
        req,
        routeLabel: "internal/generation-recovery/run",
      }),
      mode: "primary",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        runMode: "primary",
      })
    );
  });

  it("supports an explicit rescue run for bounded/manual operator use", async () => {
    const req = {
      method: "POST",
      body: {
        runMode: "rescue",
      },
      headers: {
        "x-shortpulse-cron-secret": "cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runGenerationControlPlaneCycleMock).toHaveBeenCalledWith({
      context: expect.objectContaining({
        req,
        routeLabel: "internal/generation-recovery/run",
      }),
      mode: "rescue",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        runMode: "rescue",
      })
    );
  });

  it("maps explicit full requests back to primary mode", async () => {
    const req = {
      method: "POST",
      body: {
        runMode: "full",
      },
      headers: {
        "x-shortpulse-cron-secret": "cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runGenerationControlPlaneCycleMock).toHaveBeenCalledWith({
      context: expect.objectContaining({
        req,
        routeLabel: "internal/generation-recovery/run",
      }),
      mode: "primary",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        runMode: "primary",
      })
    );
  });

  it("returns 500 and logs when the control plane throws", async () => {
    runGenerationControlPlaneCycleMock.mockRejectedValueOnce(new Error("cycle failed"));
    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "internal/generation-recovery/run",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "cycle failed" });
  });
});

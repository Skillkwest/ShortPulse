import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GENERATION_CONTROL_PLANE_WORKER_INTERVAL_MS,
  runGenerationControlPlaneWorkerLoop,
  runGenerationControlPlaneWorkerOnce,
} from "../workerLoop";

describe("generationControlPlane/workerLoop", () => {
  it("runs one control-plane cycle directly without the route wrapper", async () => {
    const runCycle = vi.fn().mockResolvedValue({
      ok: true,
      claimed: 1,
      processed: 1,
      recovered: 1,
      requeued: 0,
      exhausted: 0,
      duplicates: 0,
      errors: 0,
      skipped: 0,
      reservationCleanupScanned: 1,
      reservationCleanupReleased: 0,
      reservationCleanupErrors: 0,
      queueClaimed: 1,
      queueSubmitted: 1,
      queueRetried: 0,
      queueRequeuedNoCapacity: 0,
      queueExhausted: 0,
      queueSkipped: 0,
      queueDispatchErrors: 0,
      stageTimings: {
        queueDispatch: { durationMs: 12 },
        reservationCleanup: { durationMs: 3 },
        providerAttachedReservationCleanup: { durationMs: 0 },
        observationInboxProcessing: { durationMs: 5 },
        requestIdRepair: { durationMs: 0 },
        recoveryClaim: { durationMs: 4 },
        recoveryExecution: { durationMs: 8 },
      },
    });
    const writeHeartbeat = vi.fn();
    const runWriter = {
      startRun: vi.fn().mockResolvedValue("run-1"),
      finishRun: vi.fn().mockResolvedValue(undefined),
    };
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const result = await runGenerationControlPlaneWorkerOnce({
      runCycle,
      writeHeartbeat,
      runWriter,
      logger,
    });

    expect(runCycle).toHaveBeenCalledWith({
      context: {
        routeLabel: "worker/generation-control-plane",
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
      })
    );
    expect(writeHeartbeat).toHaveBeenCalledTimes(2);
    expect(runWriter.startRun).toHaveBeenCalledWith({
      routeLabel: "worker/generation-control-plane",
    });
    expect(runWriter.finishRun).toHaveBeenCalledWith({
      runId: "run-1",
      status: "ok",
      result: expect.objectContaining({
        ok: true,
      }),
    });
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('stageTimings={"queueDispatch":{"durationMs":12}')
    );
  });

  it("loops with success backoff and writes a stopped heartbeat", async () => {
    const runCycle = vi.fn().mockResolvedValue({
      ok: true,
      claimed: 0,
      processed: 0,
      recovered: 0,
      requeued: 0,
      exhausted: 0,
      duplicates: 0,
      errors: 0,
      skipped: 0,
      reservationCleanupScanned: 0,
      reservationCleanupReleased: 0,
      reservationCleanupErrors: 0,
      queueClaimed: 0,
      queueSubmitted: 0,
      queueRetried: 0,
      queueRequeuedNoCapacity: 0,
      queueExhausted: 0,
      queueSkipped: 0,
      queueDispatchErrors: 0,
      stageTimings: {
        queueDispatch: { durationMs: 0 },
        reservationCleanup: { durationMs: 0 },
        providerAttachedReservationCleanup: { durationMs: 0 },
        observationInboxProcessing: { durationMs: 0 },
        requestIdRepair: { durationMs: 0 },
        recoveryClaim: { durationMs: 0 },
        recoveryExecution: { durationMs: 0 },
      },
    });
    const writeHeartbeat = vi.fn();
    const runWriter = {
      startRun: vi.fn().mockResolvedValue("run-2"),
      finishRun: vi.fn().mockResolvedValue(undefined),
    };
    const sleep = vi.fn().mockResolvedValue(undefined);
    let iterations = 0;

    await runGenerationControlPlaneWorkerLoop({
      runCycle,
      writeHeartbeat,
      runWriter,
      sleep,
      shouldStop: () => {
        iterations += 1;
        return iterations > 1;
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(runCycle).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(runWriter.startRun).toHaveBeenCalledTimes(1);
    expect(runWriter.finishRun).toHaveBeenCalledTimes(1);
    expect(writeHeartbeat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "stopped",
      })
    );
  });

  it("skips cycle execution when leadership is not acquired", async () => {
    const runCycle = vi.fn();
    const writeHeartbeat = vi.fn();
    const sleep = vi.fn().mockResolvedValue(undefined);
    let iterations = 0;

    await runGenerationControlPlaneWorkerLoop({
      runCycle,
      writeHeartbeat,
      beforeRun: async () => false,
      sleep,
      shouldStop: () => {
        iterations += 1;
        return iterations > 1;
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(runCycle).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
    expect(writeHeartbeat).toHaveBeenCalledTimes(2);
    expect(writeHeartbeat).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "running",
      })
    );
    expect(writeHeartbeat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "stopped",
      })
    );
  });

  it("records an error run when the control-plane cycle fails", async () => {
    const runCycle = vi.fn().mockRejectedValue(new Error("boom"));
    const writeHeartbeat = vi.fn();
    const runWriter = {
      startRun: vi.fn().mockResolvedValue("run-3"),
      finishRun: vi.fn().mockResolvedValue(undefined),
    };
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const result = await runGenerationControlPlaneWorkerOnce({
      runCycle,
      writeHeartbeat,
      runWriter,
      logger,
    });

    expect(result).toEqual({
      ok: false,
      error: "boom",
    });
    expect(runWriter.finishRun).toHaveBeenCalledWith({
      runId: "run-3",
      status: "error",
      error: "boom",
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it("uses the fast default polling interval between successful cycles", async () => {
    const runCycle = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        claimed: 0,
        processed: 0,
        recovered: 0,
        requeued: 0,
        exhausted: 0,
        duplicates: 0,
        errors: 0,
        skipped: 0,
        reservationCleanupScanned: 0,
        reservationCleanupReleased: 0,
        reservationCleanupErrors: 0,
        observationClaimed: 0,
        observationProcessed: 0,
        observationIgnored: 0,
        observationFailed: 0,
        observationErrors: 0,
        queueClaimed: 0,
        queueSubmitted: 0,
        queueRetried: 0,
        queueRequeuedNoCapacity: 0,
        queueExhausted: 0,
        queueSkipped: 0,
        queueDispatchErrors: 0,
        stageTimings: {
          queueDispatch: { durationMs: 0 },
          reservationCleanup: { durationMs: 0 },
          providerAttachedReservationCleanup: { durationMs: 0 },
          observationInboxProcessing: { durationMs: 0 },
          requestIdRepair: { durationMs: 0 },
          recoveryClaim: { durationMs: 0 },
          recoveryExecution: { durationMs: 0 },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        claimed: 0,
        processed: 0,
        recovered: 0,
        requeued: 0,
        exhausted: 0,
        duplicates: 0,
        errors: 0,
        skipped: 0,
        reservationCleanupScanned: 0,
        reservationCleanupReleased: 0,
        reservationCleanupErrors: 0,
        observationClaimed: 0,
        observationProcessed: 0,
        observationIgnored: 0,
        observationFailed: 0,
        observationErrors: 0,
        queueClaimed: 0,
        queueSubmitted: 0,
        queueRetried: 0,
        queueRequeuedNoCapacity: 0,
        queueExhausted: 0,
        queueSkipped: 0,
        queueDispatchErrors: 0,
        stageTimings: {
          queueDispatch: { durationMs: 0 },
          reservationCleanup: { durationMs: 0 },
          providerAttachedReservationCleanup: { durationMs: 0 },
          observationInboxProcessing: { durationMs: 0 },
          requestIdRepair: { durationMs: 0 },
          recoveryClaim: { durationMs: 0 },
          recoveryExecution: { durationMs: 0 },
        },
      });
    const sleep = vi.fn().mockResolvedValue(undefined);
    let shouldStopChecks = 0;

    await runGenerationControlPlaneWorkerLoop({
      runCycle,
      sleep,
      writeHeartbeat: vi.fn(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
      shouldStop: () => (shouldStopChecks += 1) >= 4,
    });

    expect(runCycle).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(DEFAULT_GENERATION_CONTROL_PLANE_WORKER_INTERVAL_MS);
  });
});

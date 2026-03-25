import { describe, expect, it, vi } from "vitest";
import {
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
    });
    const writeHeartbeat = vi.fn();
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const result = await runGenerationControlPlaneWorkerOnce({
      runCycle,
      writeHeartbeat,
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
    expect(logger.error).not.toHaveBeenCalled();
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
    });
    const writeHeartbeat = vi.fn();
    const sleep = vi.fn().mockResolvedValue(undefined);
    let iterations = 0;

    await runGenerationControlPlaneWorkerLoop({
      runCycle,
      writeHeartbeat,
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
    expect(writeHeartbeat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "stopped",
      })
    );
  });
});

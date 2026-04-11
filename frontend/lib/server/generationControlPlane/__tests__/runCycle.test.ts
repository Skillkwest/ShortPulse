import { beforeEach, describe, expect, it, vi } from "vitest";
import { runGenerationControlPlaneCycle } from "../runCycle";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const dispatchGenerationSubmitQueueBatchMock = vi.fn();
const processPendingGenerationObservationsMock = vi.fn();
const repairGenerationRequestIdsFromReservationsMock = vi.fn();
const repairStaleTerminalGenerationProjectionsMock = vi.fn();
const claimGenerationRecoveryBatchMock = vi.fn();
const executeClaimedRecoveryBatchMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../api/generationQueue/dispatch", () => ({
  dispatchGenerationSubmitQueueBatch: (...args: unknown[]) =>
    dispatchGenerationSubmitQueueBatchMock(...args),
}));

vi.mock("../observationBatchExecution", () => ({
  processPendingGenerationObservations: (...args: unknown[]) =>
    processPendingGenerationObservationsMock(...args),
}));

vi.mock("../../api/generationQueue/requestIdRepair", () => ({
  repairGenerationRequestIdsFromReservations: (...args: unknown[]) =>
    repairGenerationRequestIdsFromReservationsMock(...args),
}));

vi.mock("../../api/generationProjection", () => ({
  repairStaleTerminalGenerationProjections: (...args: unknown[]) =>
    repairStaleTerminalGenerationProjectionsMock(...args),
}));

vi.mock("../recoveryBatchAcquisition", () => ({
  claimGenerationRecoveryBatch: (...args: unknown[]) => claimGenerationRecoveryBatchMock(...args),
}));

vi.mock("../recoveryBatchExecution", () => ({
  executeClaimedRecoveryBatch: (...args: unknown[]) => executeClaimedRecoveryBatchMock(...args),
}));

type SupabaseMock = {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
};

const createSupabaseMock = (): SupabaseMock => {
  const updateEq2 = vi.fn(async () => ({ error: null }));
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const update = vi.fn(() => ({ eq: updateEq1 }));
  const from = vi.fn(() => ({ update }));
  const rpc = vi.fn(async (functionName: string) => {
    if (functionName === "release_stale_generation_reservations") {
      return {
        data: [{ scanned_count: 2, released_count: 1, error_count: 0 }],
        error: null,
      };
    }
    if (functionName === "claim_generation_recovery_batch") {
      return { data: [], error: null };
    }
    return { data: [], error: null };
  });
  return { rpc, from };
};

describe("runGenerationControlPlaneCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_FAL_RECONCILER_ENABLED = "true";
    process.env.SHORTPULSE_FAL_RECONCILER_BATCH_SIZE = "10";
    process.env.SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS = "5";
    process.env.SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS = "0";
    process.env.SHORTPULSE_FAL_INTEGRATION_MODE = "on";
    process.env.SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST = "*";
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "true";
    process.env.SHORTPULSE_FAL_QUEUE_DISPATCH_BATCH_SIZE = "25";
    dispatchGenerationSubmitQueueBatchMock.mockResolvedValue({
      claimed: 1,
      submitted: 1,
      retried: 0,
      requeuedNoCapacity: 0,
      exhausted: 0,
      skipped: 0,
      errors: 0,
    });
    processPendingGenerationObservationsMock.mockResolvedValue({
      claimed: 2,
      processed: 1,
      ignored: 1,
      failed: 0,
      errors: 0,
    });
    repairGenerationRequestIdsFromReservationsMock.mockResolvedValue({
      scanned: 0,
      repaired: 0,
      errors: 0,
    });
    repairStaleTerminalGenerationProjectionsMock.mockResolvedValue({
      scanned: 0,
      repaired: 0,
      skipped: 0,
    });
    claimGenerationRecoveryBatchMock.mockResolvedValue({
      rows: [],
      claimSource: "rpc",
      rpcError: null,
    });
    executeClaimedRecoveryBatchMock.mockResolvedValue({
      recovered: 0,
      requeued: 0,
      exhausted: 0,
      skipped: 0,
      duplicates: 0,
      processed: 0,
      errors: 0,
    });
  });

  it("supports a worker-style invocation without a request object", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });

    const result = await runGenerationControlPlaneCycle({
      context: {
        routeLabel: "worker/generation-control-plane",
      },
    });

    expect(dispatchGenerationSubmitQueueBatchMock).toHaveBeenCalledWith({
      req: undefined,
      routeLabel: "worker/generation-control-plane",
      limit: 25,
    });
    expect(dispatchGenerationSubmitQueueBatchMock.mock.invocationCallOrder[0]).toBeLessThan(
      supabase.rpc.mock.invocationCallOrder[0]
    );
    expect(repairGenerationRequestIdsFromReservationsMock).not.toHaveBeenCalled();
    expect(processPendingGenerationObservationsMock).toHaveBeenCalledWith({
      limit: 10,
      leaseSeconds: expect.any(Number),
      routeLabel: "worker/generation-control-plane",
    });
    expect(claimGenerationRecoveryBatchMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      batchSize: 10,
      maxAttempts: 5,
      minAgeSeconds: 0,
      leaseSeconds: expect.any(Number),
    });
    expect(executeClaimedRecoveryBatchMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      rows: [],
      modelAllowlist: expect.any(Set),
      maxAttempts: 5,
      routeLabel: "worker/generation-control-plane",
      logException: expect.any(Function),
    });
    expect(repairStaleTerminalGenerationProjectionsMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      limit: 10,
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        observationClaimed: 2,
        observationProcessed: 1,
        observationIgnored: 1,
        observationFailed: 0,
        observationErrors: 0,
        claimed: 0,
        queueClaimed: 1,
        queueSubmitted: 1,
        reservationCleanupScanned: 2,
        reservationCleanupReleased: 1,
        stageTimings: expect.objectContaining({
          queueDispatch: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
          reservationCleanup: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
          observationInboxProcessing: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
          recoveryClaim: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
          recoveryExecution: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
        }),
      })
    );
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("skips queue dispatch and does not run request-id repair in rescue mode", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });

    await runGenerationControlPlaneCycle({
      context: {
        routeLabel: "internal/generation-recovery/run",
      },
      mode: "rescue",
    });

    expect(dispatchGenerationSubmitQueueBatchMock).not.toHaveBeenCalled();
    expect(repairGenerationRequestIdsFromReservationsMock).not.toHaveBeenCalled();
    expect(processPendingGenerationObservationsMock).toHaveBeenCalledWith({
      limit: 5,
      leaseSeconds: expect.any(Number),
      routeLabel: "internal/generation-recovery/run",
    });
    expect(claimGenerationRecoveryBatchMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      batchSize: 5,
      maxAttempts: 5,
      minAgeSeconds: 0,
      leaseSeconds: expect.any(Number),
    });
  });

  it("skips request-id repair in primary mode", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });

    await runGenerationControlPlaneCycle({
      context: {
        routeLabel: "worker/generation-control-plane",
      },
    });

    expect(dispatchGenerationSubmitQueueBatchMock).toHaveBeenCalled();
    expect(repairGenerationRequestIdsFromReservationsMock).not.toHaveBeenCalled();
    expect(processPendingGenerationObservationsMock).toHaveBeenCalledWith({
      limit: 10,
      leaseSeconds: expect.any(Number),
      routeLabel: "worker/generation-control-plane",
    });
    expect(repairStaleTerminalGenerationProjectionsMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      limit: 10,
    });
    expect(claimGenerationRecoveryBatchMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      batchSize: 10,
      maxAttempts: 5,
      minAgeSeconds: 0,
      leaseSeconds: expect.any(Number),
    });
  });

  it("skips request-id repair in primary mode even during rescue-oriented compatibility conditions", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });

    await runGenerationControlPlaneCycle({
      context: {
        routeLabel: "worker/generation-control-plane",
      },
      mode: "primary",
    });

    expect(dispatchGenerationSubmitQueueBatchMock).toHaveBeenCalled();
    expect(repairGenerationRequestIdsFromReservationsMock).not.toHaveBeenCalled();
  });
});

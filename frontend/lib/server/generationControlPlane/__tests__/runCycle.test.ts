import { beforeEach, describe, expect, it, vi } from "vitest";
import { runGenerationControlPlaneCycle } from "../runCycle";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const processPendingGenerationObservationsMock = vi.fn();
const processPendingAudioCompanionArtBatchMock = vi.fn();
const repairStaleTerminalGenerationProjectionsMock = vi.fn();
const claimGenerationRecoveryBatchMock = vi.fn();
const executeClaimedRecoveryBatchMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../observationBatchExecution", () => ({
  processPendingGenerationObservations: (...args: unknown[]) =>
    processPendingGenerationObservationsMock(...args),
}));

vi.mock("../../audioCompanionArt/processing", () => ({
  processPendingAudioCompanionArtBatch: (...args: unknown[]) =>
    processPendingAudioCompanionArtBatchMock(...args),
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

vi.mock("../../audioCompanionArt/processing", () => ({
  processPendingAudioCompanionArtBatch: (...args: unknown[]) =>
    processPendingAudioCompanionArtBatchMock(...args),
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
    if (functionName === "release_stale_provider_attached_generation_reservations") {
      return {
        data: [{ scanned_count: 3, released_count: 2, error_count: 1 }],
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
    process.env.SHORTPULSE_FAL_PROJECTION_REPAIR_INTERVAL_SECONDS = "0";
    process.env.SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST = "*";
    processPendingGenerationObservationsMock.mockResolvedValue({
      claimed: 2,
      processed: 1,
      ignored: 1,
      failed: 0,
      errors: 0,
    });
    processPendingAudioCompanionArtBatchMock.mockResolvedValue({
      claimed: 0,
      processed: 0,
      ready: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
    });
    repairStaleTerminalGenerationProjectionsMock.mockResolvedValue({
      scanned: 0,
      repaired: 0,
      skipped: 0,
    });
    claimGenerationRecoveryBatchMock.mockResolvedValue({
      rows: [],
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
    processPendingAudioCompanionArtBatchMock.mockResolvedValue({
      claimed: 0,
      processed: 0,
      ready: 0,
      failed: 0,
      skipped: 0,
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
      onAssociationFailure: expect.any(Function),
    });
    expect(processPendingAudioCompanionArtBatchMock).toHaveBeenCalledWith({
      limit: 6,
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
        reservationCleanupScanned: 5,
        reservationCleanupReleased: 3,
        reservationCleanupErrors: 1,
        preProviderReservationCleanupScanned: 2,
        preProviderReservationCleanupReleased: 1,
        preProviderReservationCleanupErrors: 0,
        providerAttachedReservationCleanupScanned: 3,
        providerAttachedReservationCleanupReleased: 2,
        providerAttachedReservationCleanupErrors: 1,
        projectionRepairScanned: 0,
        projectionRepairRepaired: 0,
        projectionRepairSkipped: 0,
        audioCompanionArtClaimed: 0,
        audioCompanionArtProcessed: 0,
        audioCompanionArtReady: 0,
        audioCompanionArtFailed: 0,
        audioCompanionArtSkipped: 0,
        audioCompanionArtErrors: 0,
        stageTimings: expect.objectContaining({
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
          projectionRepair: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
          audioCompanionArtProcessing: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
        }),
      })
    );
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("does not run request-id repair in rescue mode", async () => {
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
    expect(repairStaleTerminalGenerationProjectionsMock).not.toHaveBeenCalled();
  });

  it("repairs stale terminal projections in primary mode", async () => {
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

    expect(processPendingGenerationObservationsMock).toHaveBeenCalledWith({
      limit: 10,
      leaseSeconds: expect.any(Number),
      routeLabel: "worker/generation-control-plane",
    });
    expect(repairStaleTerminalGenerationProjectionsMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      limit: 10,
      onAssociationFailure: expect.any(Function),
    });
    expect(claimGenerationRecoveryBatchMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      batchSize: 10,
      maxAttempts: 5,
      minAgeSeconds: 0,
      leaseSeconds: expect.any(Number),
    });
  });

  it("throttles expensive projection repair scans without pausing active recovery", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });
    process.env.SHORTPULSE_FAL_PROJECTION_REPAIR_INTERVAL_SECONDS = "300";
    let nowMs = 900_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => nowMs);

    try {
      const firstResult = await runGenerationControlPlaneCycle({
        context: {
          routeLabel: "worker/generation-control-plane-throttle-test",
        },
      });
      nowMs += 60_000;
      const secondResult = await runGenerationControlPlaneCycle({
        context: {
          routeLabel: "worker/generation-control-plane-throttle-test-cold-start",
        },
      });
      nowMs += 240_000;
      const thirdResult = await runGenerationControlPlaneCycle({
        context: {
          routeLabel: "worker/generation-control-plane-throttle-test",
        },
      });
      expect(firstResult.projectionRepairRan).toBe(true);
      expect(secondResult.projectionRepairRan).toBe(false);
      expect(thirdResult.projectionRepairRan).toBe(true);
    } finally {
      dateNowSpy.mockRestore();
    }

    expect(repairStaleTerminalGenerationProjectionsMock).toHaveBeenCalledTimes(2);
    expect(claimGenerationRecoveryBatchMock).toHaveBeenCalledTimes(3);
    expect(executeClaimedRecoveryBatchMock).toHaveBeenCalledTimes(3);
    expect(processPendingGenerationObservationsMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces projection repair metrics and logs project association repair failures", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });
    repairStaleTerminalGenerationProjectionsMock.mockImplementationOnce(
      async ({ onAssociationFailure }) => {
        await onAssociationFailure({
          stage: "media",
          userId: "user-1",
          projectId: "project-1",
          generationId: "generation-1",
          mediaFileIds: ["media-1"],
          error: new Error("association failed"),
        });
        return {
          scanned: 3,
          repaired: 2,
          skipped: 1,
        };
      }
    );

    const result = await runGenerationControlPlaneCycle({
      context: {
        routeLabel: "worker/generation-control-plane",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        projectionRepairScanned: 3,
        projectionRepairRepaired: 2,
        projectionRepairSkipped: 1,
      })
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        routeLabel: "worker/generation-control-plane",
        metadata: expect.objectContaining({
          stage: "projection_repair_project_association",
          association_stage: "media",
          user_id: "user-1",
          project_id: "project-1",
          generation_id: "generation-1",
          media_file_ids: ["media-1"],
        }),
      })
    );
  });

  it("keeps the primary cycle on accepted-generation recovery", async () => {
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

    expect(claimGenerationRecoveryBatchMock).toHaveBeenCalledWith({
      supabaseAdmin: expect.any(Object),
      batchSize: 10,
      maxAttempts: 5,
      minAgeSeconds: 0,
      leaseSeconds: expect.any(Number),
    });
  });
});

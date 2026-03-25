import { beforeEach, describe, expect, it, vi } from "vitest";
import { runGenerationControlPlaneCycle } from "../runCycle";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const dispatchGenerationSubmitQueueBatchMock = vi.fn();
const repairGenerationRequestIdsFromReservationsMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();

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

vi.mock("../../api/generationQueue/requestIdRepair", () => ({
  repairGenerationRequestIdsFromReservations: (...args: unknown[]) =>
    repairGenerationRequestIdsFromReservationsMock(...args),
}));

vi.mock("../../falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
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
    repairGenerationRequestIdsFromReservationsMock.mockResolvedValue({
      scanned: 0,
      repaired: 0,
      errors: 0,
    });
    executeGenerationRecoveryMock.mockResolvedValue({
      processed: false,
      state: "skipped",
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
    expect(repairGenerationRequestIdsFromReservationsMock).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        claimed: 0,
        queueClaimed: 1,
        queueSubmitted: 1,
        reservationCleanupScanned: 2,
        reservationCleanupReleased: 1,
      })
    );
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });
});

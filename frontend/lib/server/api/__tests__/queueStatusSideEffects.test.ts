import { beforeEach, describe, expect, it, vi } from "vitest";
import { runQueueStatusSideEffects } from "../generationQueue/queueStatusSideEffects";

const dispatchGenerationSubmitQueueBatchMock = vi.fn();
const claimDueQueueStatusRecoveryMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../generationQueue/dispatch", () => ({
  dispatchGenerationSubmitQueueBatch: (...args: unknown[]) =>
    dispatchGenerationSubmitQueueBatchMock(...args),
}));

vi.mock("../generationQueue/statusRecoveryKick", () => ({
  claimDueQueueStatusRecovery: (...args: unknown[]) => claimDueQueueStatusRecoveryMock(...args),
}));

vi.mock("../../falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

vi.mock("../appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

describe("runQueueStatusSideEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchGenerationSubmitQueueBatchMock.mockResolvedValue({
      claimed: 0,
      submitted: 0,
      retried: 0,
      requeuedNoCapacity: 0,
      exhausted: 0,
      skipped: 0,
      errors: 0,
    });
    claimDueQueueStatusRecoveryMock.mockResolvedValue({
      claimed: false,
      generationId: null,
      requestId: null,
      reason: "not_found",
      errorMessage: null,
    });
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "provider_running",
      generationId: "gen-1",
      requestId: "req-1",
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    });
  });

  it("logs dispatch kick partial failures and continues", async () => {
    dispatchGenerationSubmitQueueBatchMock.mockResolvedValueOnce({
      claimed: 1,
      submitted: 0,
      retried: 0,
      requeuedNoCapacity: 0,
      exhausted: 1,
      skipped: 0,
      errors: 2,
    });

    await runQueueStatusSideEffects({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "api/fal/queue-status-kick",
      userId: "user-1",
      userEmail: "user@example.com",
      sourceRef: "src-1",
      generationId: "gen-1",
      flags: {
        queueStatusDispatchKickEnabled: true,
        queueStatusRecoveryKickEnabled: false,
        reconcilerMaxAttempts: 5,
      },
    });

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.status.kick_partial_failure",
        routeLabel: "api/fal/queue-status-kick",
      })
    );
    expect(claimDueQueueStatusRecoveryMock).not.toHaveBeenCalled();
  });

  it("logs dispatch kick exceptions and continues", async () => {
    dispatchGenerationSubmitQueueBatchMock.mockRejectedValueOnce(new Error("dispatch failed"));

    await runQueueStatusSideEffects({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "api/fal/queue-status-kick",
      userId: "user-1",
      userEmail: "user@example.com",
      sourceRef: "src-1",
      generationId: "gen-1",
      flags: {
        queueStatusDispatchKickEnabled: true,
        queueStatusRecoveryKickEnabled: false,
        reconcilerMaxAttempts: 5,
      },
    });

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.status.kick_failed",
        routeLabel: "api/fal/queue-status-kick",
      })
    );
  });

  it("logs recovery claim db failures", async () => {
    claimDueQueueStatusRecoveryMock.mockResolvedValueOnce({
      claimed: false,
      generationId: "gen-1",
      requestId: "req-1",
      reason: "db_error",
      errorMessage: "db unavailable",
    });

    await runQueueStatusSideEffects({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "api/fal/queue-status-kick",
      userId: "user-1",
      userEmail: "user@example.com",
      sourceRef: "src-1",
      generationId: "gen-1",
      flags: {
        queueStatusDispatchKickEnabled: false,
        queueStatusRecoveryKickEnabled: true,
        reconcilerMaxAttempts: 5,
      },
    });

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.status.recovery_claim_failed",
        routeLabel: "api/fal/queue-status-kick",
      })
    );
  });

  it("logs recovery execution failures for claimed rows", async () => {
    claimDueQueueStatusRecoveryMock.mockResolvedValueOnce({
      claimed: true,
      generationId: "gen-1",
      requestId: "req-1",
      reason: "claimed",
      errorMessage: null,
    });
    executeGenerationRecoveryMock.mockRejectedValueOnce(new Error("recovery unavailable"));

    await runQueueStatusSideEffects({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "api/fal/queue-status-kick",
      userId: "user-1",
      userEmail: "user@example.com",
      sourceRef: "src-1",
      generationId: "gen-1",
      flags: {
        queueStatusDispatchKickEnabled: false,
        queueStatusRecoveryKickEnabled: true,
        reconcilerMaxAttempts: 5,
      },
    });

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.status.recovery_kick_failed",
        routeLabel: "api/fal/queue-status-kick",
      })
    );
  });

  it("skips dispatch and recovery when both toggles are disabled", async () => {
    const result = await runQueueStatusSideEffects({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "api/fal/queue-status-kick",
      userId: "user-1",
      userEmail: "user@example.com",
      sourceRef: "src-1",
      generationId: "gen-1",
      flags: {
        queueStatusDispatchKickEnabled: false,
        queueStatusRecoveryKickEnabled: false,
        reconcilerMaxAttempts: 5,
      },
    });

    expect(dispatchGenerationSubmitQueueBatchMock).not.toHaveBeenCalled();
    expect(claimDueQueueStatusRecoveryMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        dispatchKickAttempted: false,
        recoveryKickAttempted: false,
      })
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { processPendingGenerationObservations } from "../observationBatchExecution";

const readPendingGenerationObservationsMock = vi.fn();
const markGenerationObservationProcessingStateMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();

vi.mock("../../api/generationObservationInbox", () => ({
  claimPendingGenerationObservations: (...args: unknown[]) =>
    readPendingGenerationObservationsMock(...args),
  markGenerationObservationProcessingState: (...args: unknown[]) =>
    markGenerationObservationProcessingStateMock(...args),
}));

vi.mock("../../falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

describe("processPendingGenerationObservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markGenerationObservationProcessingStateMock.mockResolvedValue(undefined);
  });

  it("processes supported pending observations through recovery execution", async () => {
    readPendingGenerationObservationsMock.mockResolvedValue([
      {
        id: "obs-1",
        generationId: "gen-1",
        generationAttemptId: "attempt-1",
        userId: "user-1",
        provider: "fal",
        providerRequestId: "req-1",
        observationSource: "webhook",
        observationType: "completed",
        idempotencyKey: "fal:webhook:event-1",
        payload: { status: "completed" },
        observedAt: new Date().toISOString(),
      },
    ]);
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "recovered",
      generationId: "gen-1",
      requestId: "req-1",
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    });

    await expect(
      processPendingGenerationObservations({
        limit: 10,
        leaseSeconds: 120,
        routeLabel: "worker/generation-control-plane",
      })
    ).resolves.toEqual({
      claimed: 1,
      processed: 1,
      ignored: 0,
      failed: 0,
      errors: 0,
    });
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "reconciler",
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      observation: {
        state: "completed",
        payload: { status: "completed" },
        mediaUrls: [],
      },
      routeLabel: "worker/generation-control-plane",
    });
    expect(readPendingGenerationObservationsMock).toHaveBeenCalledWith({
      limit: 10,
      leaseSeconds: 120,
    });
    expect(markGenerationObservationProcessingStateMock).toHaveBeenCalledWith({
      idempotencyKey: "fal:webhook:event-1",
      processingState: "processed",
      processingError: null,
    });
  });

  it("ignores unsupported observation types", async () => {
    readPendingGenerationObservationsMock.mockResolvedValue([
      {
        id: "obs-2",
        generationId: "gen-2",
        generationAttemptId: null,
        userId: "user-2",
        provider: "fal",
        providerRequestId: "req-2",
        observationSource: "webhook",
        observationType: "unknown",
        idempotencyKey: "fal:webhook:event-2",
        payload: {},
        observedAt: new Date().toISOString(),
      },
    ]);

    await expect(
      processPendingGenerationObservations({
        limit: 10,
        leaseSeconds: 120,
        routeLabel: "worker/generation-control-plane",
      })
    ).resolves.toEqual({
      claimed: 1,
      processed: 0,
      ignored: 1,
      failed: 0,
      errors: 0,
    });
    expect(executeGenerationRecoveryMock).not.toHaveBeenCalled();
    expect(markGenerationObservationProcessingStateMock).toHaveBeenCalledWith({
      idempotencyKey: "fal:webhook:event-2",
      processingState: "ignored",
      processingError: "unsupported_observation_type",
    });
  });

  it("marks observations failed when recovery execution throws", async () => {
    readPendingGenerationObservationsMock.mockResolvedValue([
      {
        id: "obs-3",
        generationId: "gen-3",
        generationAttemptId: null,
        userId: "user-3",
        provider: "fal",
        providerRequestId: "req-3",
        observationSource: "webhook",
        observationType: "failed",
        idempotencyKey: "fal:webhook:event-3",
        payload: { status: "failed" },
        observedAt: new Date().toISOString(),
      },
    ]);
    executeGenerationRecoveryMock.mockRejectedValue(new Error("boom"));

    await expect(
      processPendingGenerationObservations({
        limit: 10,
        leaseSeconds: 120,
        routeLabel: "worker/generation-control-plane",
      })
    ).resolves.toEqual({
      claimed: 1,
      processed: 0,
      ignored: 0,
      failed: 1,
      errors: 1,
    });
    expect(markGenerationObservationProcessingStateMock).toHaveBeenCalledWith({
      idempotencyKey: "fal:webhook:event-3",
      processingState: "failed",
      processingError: "boom",
    });
  });
});

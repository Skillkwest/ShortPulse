import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/queue-status";

const requireApiUserMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const dispatchGenerationSubmitQueueBatchMock = vi.fn();
const claimDueQueueStatusRecoveryMock = vi.fn();
const readGenerationQueueStatusMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/dispatch", () => ({
  dispatchGenerationSubmitQueueBatch: (...args: unknown[]) =>
    dispatchGenerationSubmitQueueBatchMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/statusRecoveryKick", () => ({
  claimDueQueueStatusRecovery: (...args: unknown[]) => claimDueQueueStatusRecoveryMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/service", () => ({
  readGenerationQueueStatus: (...args: unknown[]) => readGenerationQueueStatusMock(...args),
}));

vi.mock("../../lib/server/falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("GET /api/fal/queue-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });
    readFalRuntimeFlagsMock.mockReturnValue({
      queueEnabled: true,
      queueStatusDispatchKickEnabled: true,
    });
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
    readGenerationQueueStatusMock.mockResolvedValue({
      status: "queued",
      generationId: "gen-1",
      sourceRef: "src-1",
      retryAfterMs: 2000,
    });
  });

  it("returns 200 when dispatch kick fails but queue status read succeeds", async () => {
    dispatchGenerationSubmitQueueBatchMock.mockRejectedValueOnce(new Error("claim conflict"));
    const req = {
      method: "GET",
      query: { sourceRef: "src-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.status.kick_failed",
        routeLabel: "api/fal/queue-status",
      })
    );
    expect(dispatchGenerationSubmitQueueBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "api/fal/queue-status",
        userId: "user-1",
        limit: 1,
      })
    );
    expect(readGenerationQueueStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "src-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
      })
    );
  });

  it("returns 200 in read-only dispatch mode without dispatch kick side effects", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      queueEnabled: true,
      queueStatusDispatchKickEnabled: false,
    });
    const req = {
      method: "GET",
      query: { sourceRef: "src-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchGenerationSubmitQueueBatchMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
    expect(readGenerationQueueStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "src-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("kicks due recovery before status read when claim succeeds", async () => {
    claimDueQueueStatusRecoveryMock.mockResolvedValueOnce({
      claimed: true,
      generationId: "gen-1",
      requestId: "req-1",
      reason: "claimed",
      errorMessage: null,
    });
    const req = {
      method: "GET",
      query: { generationId: "gen-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(claimDueQueueStatusRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        generationId: "gen-1",
      })
    );
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "status_proxy",
        routeLabel: "api/fal/queue-status",
        generationId: "gen-1",
        requestId: "req-1",
        userId: "user-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("logs recovery claim failures and still returns queue status", async () => {
    claimDueQueueStatusRecoveryMock.mockResolvedValueOnce({
      claimed: false,
      generationId: "gen-1",
      requestId: "req-1",
      reason: "db_error",
      errorMessage: "db unavailable",
    });
    const req = {
      method: "GET",
      query: { generationId: "gen-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.status.recovery_claim_failed",
        routeLabel: "api/fal/queue-status",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns optional modelId for dispatched queue status responses", async () => {
    readGenerationQueueStatusMock.mockResolvedValueOnce({
      status: "dispatched",
      generationId: "gen-kie-1",
      sourceRef: "src-kie-1",
      requestId: "req-kie-1",
      provider: "kie",
      modelId: "kie-ai/kling-3.0",
    });
    const req = {
      method: "GET",
      query: { generationId: "gen-kie-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dispatched",
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
      })
    );
  });

  it("logs recovery execution errors and still returns queue status", async () => {
    claimDueQueueStatusRecoveryMock.mockResolvedValueOnce({
      claimed: true,
      generationId: "gen-1",
      requestId: "req-1",
      reason: "claimed",
      errorMessage: null,
    });
    executeGenerationRecoveryMock.mockRejectedValueOnce(new Error("recovery unavailable"));
    const req = {
      method: "GET",
      query: { generationId: "gen-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.status.recovery_kick_failed",
        routeLabel: "api/fal/queue-status",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 500 when queue status read fails", async () => {
    readGenerationQueueStatusMock.mockRejectedValueOnce(new Error("status read failed"));
    const req = {
      method: "GET",
      query: { generationId: "gen-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "api/fal/queue-status",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Unable to resolve queued generation status.",
      })
    );
  });
});

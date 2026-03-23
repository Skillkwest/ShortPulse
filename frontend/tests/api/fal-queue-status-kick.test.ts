import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/queue-status-kick";

const requireApiUserMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const runQueueStatusSideEffectsMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/queueStatusSideEffects", () => ({
  runQueueStatusSideEffects: (...args: unknown[]) => runQueueStatusSideEffectsMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("POST /api/fal/queue-status-kick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });
    readFalRuntimeFlagsMock.mockReturnValue({
      queueEnabled: true,
      queueStatusDispatchKickEnabled: true,
      queueStatusRecoveryKickEnabled: true,
      reconcilerMaxAttempts: 5,
    });
    runQueueStatusSideEffectsMock.mockResolvedValue({
      dispatchKickAttempted: true,
      dispatchKickErrors: 0,
      dispatchKickExhausted: 0,
      recoveryKickAttempted: true,
      recoveryClaimed: false,
      recoveryClaimReason: "not_found",
    });
  });

  it("returns 200 and executes side effects", async () => {
    const req = {
      method: "POST",
      body: { sourceRef: "src-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runQueueStatusSideEffectsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "api/fal/queue-status-kick",
        sourceRef: "src-1",
        generationId: null,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        dispatchKickAttempted: true,
      })
    );
  });

  it("returns 400 when both sourceRef and generationId are missing", async () => {
    const req = {
      method: "POST",
      body: {},
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runQueueStatusSideEffectsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when queue runtime is disabled", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      queueEnabled: false,
      queueStatusDispatchKickEnabled: true,
      queueStatusRecoveryKickEnabled: true,
      reconcilerMaxAttempts: 5,
    });
    const req = {
      method: "POST",
      body: { generationId: "gen-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(runQueueStatusSideEffectsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 when side effects throw", async () => {
    runQueueStatusSideEffectsMock.mockRejectedValueOnce(new Error("boom"));
    const req = {
      method: "POST",
      body: { generationId: "gen-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "api/fal/queue-status-kick",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 405 for unsupported methods", async () => {
    const req = {
      method: "GET",
      body: { sourceRef: "src-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(runQueueStatusSideEffectsMock).not.toHaveBeenCalled();
  });
});

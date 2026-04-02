import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/queue-status";

const requireApiUserMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const readGenerationQueueStatusMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/service", () => ({
  readGenerationQueueStatus: (...args: unknown[]) => readGenerationQueueStatusMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
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
      reconcilerMaxAttempts: 5,
    });
    readGenerationQueueStatusMock.mockResolvedValue({
      status: "queued",
      generationId: "gen-1",
      sourceRef: "src-1",
      retryAfterMs: 2000,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
      },
    });
  });

  it("returns 200 without running queue-status side effects", async () => {
    const req = {
      method: "GET",
      query: { sourceRef: "src-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

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
        shortpulseLifecycle: expect.objectContaining({
          taskState: "pending",
          queueState: "queued",
          isTerminal: false,
        }),
      })
    );
  });

  it("keeps queue-status read-only", async () => {
    const req = {
      method: "GET",
      query: { sourceRef: "src-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(readGenerationQueueStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "src-1",
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

  it("passes through dispatching queue status responses", async () => {
    readGenerationQueueStatusMock.mockResolvedValueOnce({
      status: "dispatching",
      generationId: "gen-dispatching-1",
      sourceRef: "src-dispatching-1",
      retryAfterMs: 2000,
    });
    const req = {
      method: "GET",
      query: { generationId: "gen-dispatching-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dispatching",
        retryAfterMs: 2000,
      })
    );
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/sessions/save";

const requireApiUserMock = vi.fn();
const parseAiStudioSessionIdMock = vi.fn();
const parseAiStudioSessionSnapshotMock = vi.fn();
const saveAiStudioSessionSnapshotMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/aiStudioSessions", () => ({
  parseAiStudioSessionId: (...args: unknown[]) => parseAiStudioSessionIdMock(...args),
  parseAiStudioSessionSnapshot: (...args: unknown[]) => parseAiStudioSessionSnapshotMock(...args),
  saveAiStudioSessionSnapshot: (...args: unknown[]) => saveAiStudioSessionSnapshotMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/ai/sessions/save", () => {
  const originalSessionsApiFlag = process.env.SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof originalSessionsApiFlag === "string") {
      process.env.SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED = originalSessionsApiFlag;
    } else {
      delete process.env.SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED;
    }
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    parseAiStudioSessionIdMock.mockReturnValue("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a");
    parseAiStudioSessionSnapshotMock.mockReturnValue({ schemaVersion: 1 });
    saveAiStudioSessionSnapshotMock.mockResolvedValue({
      userId: "user-1",
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      title: null,
      schemaVersion: 1,
      saveSeq: 1,
      updatedAt: "2026-03-03T00:00:00.000Z",
      expiresAt: "2026-08-30T00:00:00.000Z",
    });
    logApiRouteExceptionMock.mockResolvedValue(undefined);
  });

  it("returns 405 for non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 503 when the sessions API flag is disabled", async () => {
    process.env.SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED = "false";
    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "AI Studio sessions API is disabled" });
  });

  it("returns 400 when sid is invalid", async () => {
    parseAiStudioSessionIdMock.mockReturnValueOnce(null);
    const req = { method: "POST", body: { sid: "bad", snapshot: { schemaVersion: 1 } } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid session id" });
  });

  it("returns 400 when snapshot is invalid", async () => {
    parseAiStudioSessionSnapshotMock.mockReturnValueOnce(null);
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: [],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid session snapshot payload" });
  });

  it("returns 400 when schemaVersion is invalid", async () => {
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: { schemaVersion: 1 },
        schemaVersion: 101,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid schemaVersion" });
  });

  it("returns 400 when title is invalid", async () => {
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: { schemaVersion: 1 },
        title: 123,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid title" });
  });

  it("returns 200 when payload is valid", async () => {
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: { schemaVersion: 1 },
        schemaVersion: 1,
        title: "Session title",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(saveAiStudioSessionSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        schemaVersion: 1,
        title: "Session title",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 500 when persistence throws", async () => {
    saveAiStudioSessionSnapshotMock.mockRejectedValueOnce(new Error("db exploded"));
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: { schemaVersion: 1 },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "ai/sessions/save",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to save AI Studio session" });
  });
});

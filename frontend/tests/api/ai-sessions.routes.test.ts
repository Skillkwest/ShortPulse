import { beforeEach, describe, expect, it, vi } from "vitest";
import saveSessionHandler from "../../pages/api/ai/sessions/save";
import getSessionHandler from "../../pages/api/ai/sessions/[sid]";
import listSessionsHandler from "../../pages/api/ai/sessions";

const requireApiUserMock = vi.fn();
const saveSessionMock = vi.fn();
const getSessionMock = vi.fn();
const listSessionsMock = vi.fn();
const parseSessionIdMock = vi.fn();
const parseSnapshotMock = vi.fn();
const decodeCursorMock = vi.fn();
const encodeCursorMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/aiStudioSessions", () => ({
  saveAiStudioSessionSnapshot: (...args: unknown[]) => saveSessionMock(...args),
  getAiStudioSessionSnapshot: (...args: unknown[]) => getSessionMock(...args),
  listAiStudioSessions: (...args: unknown[]) => listSessionsMock(...args),
  parseAiStudioSessionId: (...args: unknown[]) => parseSessionIdMock(...args),
  parseAiStudioSessionSnapshot: (...args: unknown[]) => parseSnapshotMock(...args),
  decodeAiStudioSessionCursor: (...args: unknown[]) => decodeCursorMock(...args),
  encodeAiStudioSessionCursor: (...args: unknown[]) => encodeCursorMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("AI session API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    parseSessionIdMock.mockImplementation((value: unknown) =>
      typeof value === "string" ? value : null
    );
    parseSnapshotMock.mockImplementation((value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value) ? value : null
    );
    decodeCursorMock.mockImplementation(() => null);
    encodeCursorMock.mockReturnValue("next-cursor");
  });

  it("rejects non-POST session save methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await saveSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("validates session id and snapshot for save", async () => {
    const req = { method: "POST", body: { sid: 42, snapshot: null } };
    const res = createMockResponse();
    parseSessionIdMock.mockReturnValueOnce(null);
    await saveSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid session id" });
  });

  it("saves a session snapshot", async () => {
    saveSessionMock.mockResolvedValue({
      userId: "user-1",
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      title: null,
      schemaVersion: 1,
      saveSeq: 3,
      updatedAt: "2026-03-02T01:00:00.000Z",
      expiresAt: "2026-08-29T01:00:00.000Z",
    });
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: { workspace: { prompt: "p" } },
      },
    };
    const res = createMockResponse();
    await saveSessionHandler(req as never, res as never);
    expect(saveSessionMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 400 for invalid get sid", async () => {
    parseSessionIdMock.mockReturnValueOnce(null);
    const req = { method: "GET", query: { sid: "bad" } };
    const res = createMockResponse();
    await getSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when session does not exist", async () => {
    getSessionMock.mockResolvedValue(null);
    const req = { method: "GET", query: { sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a" } };
    const res = createMockResponse();
    await getSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns session payload for valid get", async () => {
    getSessionMock.mockResolvedValue({
      userId: "user-1",
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      title: "Session",
      schemaVersion: 1,
      saveSeq: 1,
      snapshot: { workspace: { mode: "image" } },
      updatedAt: "2026-03-02T01:00:00.000Z",
      expiresAt: "2026-08-29T01:00:00.000Z",
    });
    const req = { method: "GET", query: { sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a" } };
    const res = createMockResponse();
    await getSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("validates list limit and cursor", async () => {
    const req = { method: "GET", query: { limit: "0" } };
    const res = createMockResponse();
    await listSessionsHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);

    const reqInvalidCursor = { method: "GET", query: { cursor: "invalid" } };
    const resInvalidCursor = createMockResponse();
    decodeCursorMock.mockReturnValueOnce(null);
    await listSessionsHandler(reqInvalidCursor as never, resInvalidCursor as never);
    expect(resInvalidCursor.status).toHaveBeenCalledWith(400);
  });

  it("lists sessions and returns next cursor when page is full", async () => {
    decodeCursorMock.mockReturnValueOnce({
      updatedAt: "2026-03-03T00:00:00.000Z",
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
    });
    listSessionsMock.mockResolvedValue([
      {
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        title: null,
        schemaVersion: 1,
        saveSeq: 2,
        updatedAt: "2026-03-02T10:00:00.000Z",
        expiresAt: "2026-08-29T01:00:00.000Z",
      },
      {
        sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        title: null,
        schemaVersion: 1,
        saveSeq: 1,
        updatedAt: "2026-03-02T09:00:00.000Z",
        expiresAt: "2026-08-29T01:00:00.000Z",
      },
    ]);
    const req = { method: "GET", query: { limit: "2", cursor: "cursor-1" } };
    const res = createMockResponse();
    await listSessionsHandler(req as never, res as never);
    expect(listSessionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", limit: 2 })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      sessions: expect.any(Array),
      nextCursor: "next-cursor",
    });
  });
});

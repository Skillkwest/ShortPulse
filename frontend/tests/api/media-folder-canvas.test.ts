import { beforeEach, describe, expect, it, vi } from "vitest";
import getHandler from "../../pages/api/ai/media-folder-canvas/[folderId]";
import saveHandler from "../../pages/api/ai/media-folder-canvas/save";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getMediaFolderCanvasStateForUserMock = vi.fn();
const saveMediaFolderCanvasStateForUserMock = vi.fn();
const parseMediaFolderCanvasSnapshotMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/mediaFolderCanvasService", async () => {
  const actual = await vi.importActual("../../lib/server/mediaFolderCanvasService");
  return {
    ...actual,
    getMediaFolderCanvasStateForUser: (...args: unknown[]) =>
      getMediaFolderCanvasStateForUserMock(...args),
    saveMediaFolderCanvasStateForUser: (...args: unknown[]) =>
      saveMediaFolderCanvasStateForUserMock(...args),
    parseMediaFolderCanvasSnapshot: (...args: unknown[]) =>
      parseMediaFolderCanvasSnapshotMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("media folder canvas routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("GET /api/ai/media-folder-canvas/:folderId returns state payload", async () => {
    getMediaFolderCanvasStateForUserMock.mockResolvedValueOnce({
      userId: "user-1",
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      schemaVersion: 1,
      snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
      saveSeq: 3,
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    });

    const req = {
      method: "GET",
      query: { folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f" },
    };
    const res = createMockResponse();

    await getHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      state: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        schemaVersion: 1,
        snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
        saveSeq: 3,
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z",
      },
    });
  });

  it("GET route rejects root folder id", async () => {
    const req = {
      method: "GET",
      query: { folderId: "all_items" },
    };
    const res = createMockResponse();

    await getHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getMediaFolderCanvasStateForUserMock).not.toHaveBeenCalled();
  });

  it("POST /save validates snapshot payload", async () => {
    parseMediaFolderCanvasSnapshotMock.mockReturnValueOnce(null);
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        schemaVersion: 1,
        snapshot: "not-an-object",
      },
    };
    const res = createMockResponse();

    await saveHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(saveMediaFolderCanvasStateForUserMock).not.toHaveBeenCalled();
  });

  it("POST /save persists folder canvas payload", async () => {
    parseMediaFolderCanvasSnapshotMock.mockReturnValueOnce({
      schemaVersion: 1,
      camera: { x: 0, y: 0, zoom: 1 },
      items: [],
    });
    saveMediaFolderCanvasStateForUserMock.mockResolvedValueOnce({
      userId: "user-1",
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      schemaVersion: 1,
      snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
      saveSeq: 4,
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T01:00:00.000Z",
    });

    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        schemaVersion: 1,
        snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
      },
    };
    const res = createMockResponse();

    await saveHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      schemaVersion: 1,
      saveSeq: 4,
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T01:00:00.000Z",
    });
  });
});

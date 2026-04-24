import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/projects/[projectId]/media/folders/[folderId]/canvas";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getProjectForUserMock = vi.fn();
const getProjectMediaFolderCanvasStateForUserMock = vi.fn();
const saveProjectMediaFolderCanvasStateForUserMock = vi.fn();
const parseMediaFolderCanvasSnapshotMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/projectsService", async () => {
  const actual = await vi.importActual("../../lib/server/projectsService");
  return {
    ...actual,
    getProjectForUser: (...args: unknown[]) => getProjectForUserMock(...args),
  };
});

vi.mock("../../lib/server/projectMediaFolderCanvasService", () => ({
  getProjectMediaFolderCanvasStateForUser: (...args: unknown[]) =>
    getProjectMediaFolderCanvasStateForUserMock(...args),
  saveProjectMediaFolderCanvasStateForUser: (...args: unknown[]) =>
    saveProjectMediaFolderCanvasStateForUserMock(...args),
}));

vi.mock("../../lib/server/mediaFolderCanvasService", async () => {
  const actual = await vi.importActual("../../lib/server/mediaFolderCanvasService");
  return {
    ...actual,
    parseMediaFolderCanvasSnapshot: (...args: unknown[]) =>
      parseMediaFolderCanvasSnapshotMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("project media folder canvas routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    getProjectForUserMock.mockResolvedValue({
      id: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
      userId: "user-1",
      title: "Project",
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    });
  });

  it("GET returns project folder canvas state payload", async () => {
    getProjectMediaFolderCanvasStateForUserMock.mockResolvedValueOnce({
      userId: "user-1",
      projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      schemaVersion: 1,
      snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
      saveSeq: 3,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    });

    const req = {
      method: "GET",
      query: {
        projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      state: {
        projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        schemaVersion: 1,
        snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
        saveSeq: 3,
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
      },
    });
  });

  it("rejects invalid folder ids before calling the project service", async () => {
    const req = {
      method: "GET",
      query: {
        projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        folderId: "all_items",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getProjectMediaFolderCanvasStateForUserMock).not.toHaveBeenCalled();
  });

  it("PUT validates the folder canvas payload", async () => {
    parseMediaFolderCanvasSnapshotMock.mockReturnValueOnce(null);
    const req = {
      method: "PUT",
      query: {
        projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
      body: {
        schemaVersion: 1,
        snapshot: "not-an-object",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(saveProjectMediaFolderCanvasStateForUserMock).not.toHaveBeenCalled();
  });

  it("PUT persists project folder canvas payload", async () => {
    parseMediaFolderCanvasSnapshotMock.mockReturnValueOnce({
      schemaVersion: 1,
      camera: { x: 0, y: 0, zoom: 1 },
      items: [],
    });
    saveProjectMediaFolderCanvasStateForUserMock.mockResolvedValueOnce({
      userId: "user-1",
      projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      schemaVersion: 1,
      snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
      saveSeq: 4,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T01:00:00.000Z",
    });

    const req = {
      method: "PUT",
      query: {
        projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
      body: {
        schemaVersion: 1,
        snapshot: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, items: [] },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      schemaVersion: 1,
      saveSeq: 4,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T01:00:00.000Z",
    });
  });
});

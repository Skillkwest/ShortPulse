import { beforeEach, describe, expect, it, vi } from "vitest";
import createHandler from "../../pages/api/media/folders/create";
import listHandler from "../../pages/api/media/folders/list";
import renameHandler from "../../pages/api/media/folders/rename";
import deleteHandler from "../../pages/api/media/folders/delete";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const createMediaFolderForUserMock = vi.fn();
const listMediaFoldersForUserMock = vi.fn();
const renameMediaFolderForUserMock = vi.fn();
const deleteMediaFolderForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/mediaFoldersService", async () => {
  const actual = await vi.importActual("../../lib/server/mediaFoldersService");
  return {
    ...actual,
    createMediaFolderForUser: (...args: unknown[]) => createMediaFolderForUserMock(...args),
    listMediaFoldersForUser: (...args: unknown[]) => listMediaFoldersForUserMock(...args),
    renameMediaFolderForUser: (...args: unknown[]) => renameMediaFolderForUserMock(...args),
    deleteMediaFolderForUser: (...args: unknown[]) => deleteMediaFolderForUserMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("media folder CRUD routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("POST /create returns mapped folder payload", async () => {
    createMediaFolderForUserMock.mockResolvedValueOnce({
      id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      user_id: "user-1",
      name: "Campaign",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    });
    const req = { method: "POST", body: { name: "Campaign" } };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      folder: {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        name: "Campaign",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    });
  });

  it("POST /create rejects invalid folder names", async () => {
    const req = { method: "POST", body: { name: "   " } };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createMediaFolderForUserMock).not.toHaveBeenCalled();
  });

  it("GET /list returns mapped folders", async () => {
    listMediaFoldersForUserMock.mockResolvedValueOnce([
      {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        user_id: "user-1",
        name: "Campaign",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ]);
    const req = { method: "GET" };
    const res = createMockResponse();

    await listHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      folders: [
        {
          id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
          name: "Campaign",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("POST /rename validates folder id format", async () => {
    const req = { method: "POST", body: { folderId: "all_items", name: "Renamed" } };
    const res = createMockResponse();

    await renameHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(renameMediaFolderForUserMock).not.toHaveBeenCalled();
  });

  it("POST /rename returns 404 when folder is missing", async () => {
    renameMediaFolderForUserMock.mockResolvedValueOnce(null);
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        name: "Renamed",
      },
    };
    const res = createMockResponse();

    await renameHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("POST /delete returns 404 when folder is missing", async () => {
    deleteMediaFolderForUserMock.mockResolvedValueOnce(false);
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
    };
    const res = createMockResponse();

    await deleteHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

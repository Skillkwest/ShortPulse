import { beforeEach, describe, expect, it, vi } from "vitest";
import createHandler from "../../pages/api/media/folders/create";
import moveHandler from "../../pages/api/media/folders/move";
import listHandler from "../../pages/api/media/folders/list";
import renameHandler from "../../pages/api/media/folders/rename";
import deleteHandler from "../../pages/api/media/folders/delete";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const createMediaFolderForUserMock = vi.fn();
const listMediaFoldersForUserMock = vi.fn();
const moveMediaFolderForUserMock = vi.fn();
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
    moveMediaFolderForUser: (...args: unknown[]) => moveMediaFolderForUserMock(...args),
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

  it.each([
    {
      label: "GET /list",
      handler: listHandler,
      req: { method: "GET" },
      routeLabel: "media-folders-list.auth",
      responseError: "Failed to list folders",
      serviceMock: listMediaFoldersForUserMock,
    },
    {
      label: "POST /create",
      handler: createHandler,
      req: { method: "POST", body: { name: "Campaign" } },
      routeLabel: "media-folders-create.auth",
      responseError: "Failed to create folder",
      serviceMock: createMediaFolderForUserMock,
    },
    {
      label: "POST /rename",
      handler: renameHandler,
      req: {
        method: "POST",
        body: { folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f", name: "Renamed" },
      },
      routeLabel: "media-folders-rename.auth",
      responseError: "Failed to rename folder",
      serviceMock: renameMediaFolderForUserMock,
    },
    {
      label: "POST /move",
      handler: moveHandler,
      req: {
        method: "POST",
        body: { folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f", parentFolderId: null },
      },
      routeLabel: "media-folders-move.auth",
      responseError: "Failed to move folder",
      serviceMock: moveMediaFolderForUserMock,
    },
    {
      label: "POST /delete",
      handler: deleteHandler,
      req: { method: "POST", body: { folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f" } },
      routeLabel: "media-folders-delete.auth",
      responseError: "Failed to delete folder",
      serviceMock: deleteMediaFolderForUserMock,
    },
  ])("$label logs auth verifier failures before folder service calls", async (testCase) => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const res = createMockResponse();

    await testCase.handler(testCase.req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req: testCase.req,
        error: authError,
        routeLabel: testCase.routeLabel,
        scope: "app",
      })
    );
    expect(testCase.serviceMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: testCase.responseError });
  });

  it("POST /create returns mapped folder payload", async () => {
    createMediaFolderForUserMock.mockResolvedValueOnce({
      id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      user_id: "user-1",
      name: "Campaign",
      parent_folder_id: null,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
      item_count: 3,
    });
    const req = { method: "POST", body: { name: "Campaign" } };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      folder: {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        name: "Campaign",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        itemCount: 3,
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

  it("POST /create rejects invalid parent folder ids", async () => {
    const req = { method: "POST", body: { name: "Campaign", parentFolderId: "not-a-uuid" } };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createMediaFolderForUserMock).not.toHaveBeenCalled();
  });

  it("POST /create returns 404 when parent folder is missing", async () => {
    createMediaFolderForUserMock.mockRejectedValueOnce(new Error("Parent folder not found"));
    const req = {
      method: "POST",
      body: {
        name: "Campaign",
        parentFolderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
    };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Parent folder not found" });
  });

  it("GET /list returns mapped folders", async () => {
    listMediaFoldersForUserMock.mockResolvedValueOnce([
      {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        user_id: "user-1",
        name: "Campaign",
        parent_folder_id: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        item_count: 5,
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
          parentFolderId: null,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          itemCount: 5,
        },
      ],
    });
  });

  it("POST /create forwards a valid parent folder id to the service", async () => {
    createMediaFolderForUserMock.mockResolvedValueOnce({
      id: "8ce73f1e-b71f-4b6d-bd6b-b65107f1ced3",
      user_id: "user-1",
      name: "Child",
      parent_folder_id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
      item_count: 0,
    });
    const req = {
      method: "POST",
      body: {
        name: "Child",
        parentFolderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
    };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(createMediaFolderForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Child",
      parentFolderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("POST /rename validates folder id format", async () => {
    const req = { method: "POST", body: { folderId: "all_items", name: "Renamed" } };
    const res = createMockResponse();

    await renameHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(renameMediaFolderForUserMock).not.toHaveBeenCalled();
  });

  it("POST /move validates parent folder id format", async () => {
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        parentFolderId: "not-a-uuid",
      },
    };
    const res = createMockResponse();

    await moveHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(moveMediaFolderForUserMock).not.toHaveBeenCalled();
  });

  it("POST /move returns 404 when folder is missing", async () => {
    moveMediaFolderForUserMock.mockResolvedValueOnce(null);
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        parentFolderId: null,
      },
    };
    const res = createMockResponse();

    await moveHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("POST /move returns 404 when parent folder is missing", async () => {
    moveMediaFolderForUserMock.mockRejectedValueOnce(new Error("Parent folder not found"));
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        parentFolderId: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
      },
    };
    const res = createMockResponse();

    await moveHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Parent folder not found" });
  });

  it("POST /move returns 409 on hierarchy conflicts", async () => {
    moveMediaFolderForUserMock.mockRejectedValueOnce(new Error("Invalid folder hierarchy"));
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        parentFolderId: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
      },
    };
    const res = createMockResponse();

    await moveHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid folder hierarchy" });
  });

  it("POST /move returns the mapped folder payload", async () => {
    moveMediaFolderForUserMock.mockResolvedValueOnce({
      id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      user_id: "user-1",
      name: "Campaign",
      parent_folder_id: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-02T00:00:00.000Z",
      item_count: 7,
    });
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        parentFolderId: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
      },
    };
    const res = createMockResponse();

    await moveHandler(req as never, res as never);

    expect(moveMediaFolderForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      parentFolderId: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
    });
    expect(res.json).toHaveBeenCalledWith({
      folder: {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        name: "Campaign",
        parentFolderId: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
        itemCount: 7,
      },
    });
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

  it("POST /rename returns parentFolderId in the mapped payload", async () => {
    renameMediaFolderForUserMock.mockResolvedValueOnce({
      id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      user_id: "user-1",
      name: "Renamed",
      parent_folder_id: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-02T00:00:00.000Z",
      item_count: 2,
    });
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        name: "Renamed",
      },
    };
    const res = createMockResponse();

    await renameHandler(req as never, res as never);

    expect(res.json).toHaveBeenCalledWith({
      folder: {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        name: "Renamed",
        parentFolderId: "fc4896c0-5c40-41ba-a5bb-efdebac771d4",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
        itemCount: 2,
      },
    });
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

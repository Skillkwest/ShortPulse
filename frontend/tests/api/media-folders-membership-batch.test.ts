import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/folders/membership-batch";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const applyFolderMembershipBatchMock = vi.fn();

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
    applyFolderMembershipBatch: (...args: unknown[]) => applyFolderMembershipBatchMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/folders/membership-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("rejects invalid folder ids", async () => {
    const req = {
      method: "POST",
      body: {
        folderId: "all_items",
        action: "assign",
        mediaIds: ["media-1"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid folder id",
      })
    );
    expect(applyFolderMembershipBatchMock).not.toHaveBeenCalled();
  });

  it("maps ownership validation failures to 403", async () => {
    applyFolderMembershipBatchMock.mockRejectedValueOnce(
      new Error("One or more item ids are invalid for this user")
    );
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        action: "assign",
        mediaIds: ["media-1"],
        promptIds: ["prompt-1"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid folder membership ids",
      })
    );
  });

  it("maps character-scoped media isolation failures to 409", async () => {
    applyFolderMembershipBatchMock.mockRejectedValueOnce(
      new Error("Character-scoped media ids are not allowed in media-library folders")
    );
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        action: "assign",
        mediaIds: ["media-character-1"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Character-scoped media is isolated",
      })
    );
  });

  it("returns service result on success", async () => {
    applyFolderMembershipBatchMock.mockResolvedValueOnce({
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      sourceFolderId: null,
      targetFolderId: null,
      action: "unassign",
      mediaAssigned: 0,
      mediaUnassigned: 1,
      promptsAssigned: 0,
      promptsUnassigned: 2,
      mediaDuplicates: 0,
      promptDuplicates: 0,
      mediaSkipped: 0,
      promptSkipped: 0,
    });
    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        action: "unassign",
        mediaIds: ["media-1"],
        promptIds: ["prompt-1", "prompt-2"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      sourceFolderId: null,
      targetFolderId: null,
      action: "unassign",
      mediaAssigned: 0,
      mediaUnassigned: 1,
      promptsAssigned: 0,
      promptsUnassigned: 2,
      mediaDuplicates: 0,
      promptDuplicates: 0,
      mediaSkipped: 0,
      promptSkipped: 0,
    });
  });

  it("validates move requests require source and target folder ids", async () => {
    const req = {
      method: "POST",
      body: {
        action: "move",
        sourceFolderId: "all_items",
        targetFolderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        mediaIds: ["media-1"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(applyFolderMembershipBatchMock).not.toHaveBeenCalled();
  });
});

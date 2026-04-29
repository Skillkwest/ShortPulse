import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../lib/server/projectApiRoutes/mediaFolders/list";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getProjectForUserMock = vi.fn();
const listProjectMediaFoldersForUserMock = vi.fn();

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

vi.mock("../../lib/server/projectMediaFoldersService", async () => {
  const actual = await vi.importActual("../../lib/server/projectMediaFoldersService");
  return {
    ...actual,
    listProjectMediaFoldersForUser: (...args: unknown[]) =>
      listProjectMediaFoldersForUserMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("project media folder list route", () => {
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

  it("returns mapped project folder payloads with item counts", async () => {
    listProjectMediaFoldersForUserMock.mockResolvedValueOnce([
      {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        project_id: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        user_id: "user-1",
        name: "Campaign",
        parent_folder_id: null,
        created_at: "2026-04-24T00:00:00.000Z",
        updated_at: "2026-04-24T00:00:00.000Z",
        item_count: 9,
      },
    ]);
    const req = {
      method: "GET",
      query: { projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(listProjectMediaFoldersForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      folders: [
        {
          id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
          name: "Campaign",
          parentFolderId: null,
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
          itemCount: 9,
        },
      ],
    });
  });
});

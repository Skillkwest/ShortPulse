import { beforeEach, describe, expect, it, vi } from "vitest";
import createHandler from "../../pages/api/projects/create";
import collectionHandler from "../../pages/api/projects";
import itemHandler from "../../pages/api/projects/[projectId]";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const createProjectForUserMock = vi.fn();
const listProjectsForUserMock = vi.fn();
const getProjectForUserMock = vi.fn();
const updateProjectTitleForUserMock = vi.fn();
const parseProjectIdMock = vi.fn();
const parseProjectListLimitMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/projectsService", () => ({
  createProjectForUser: (...args: unknown[]) => createProjectForUserMock(...args),
  listProjectsForUser: (...args: unknown[]) => listProjectsForUserMock(...args),
  getProjectForUser: (...args: unknown[]) => getProjectForUserMock(...args),
  updateProjectTitleForUser: (...args: unknown[]) => updateProjectTitleForUserMock(...args),
  parseProjectId: (...args: unknown[]) => parseProjectIdMock(...args),
  parseProjectListLimit: (...args: unknown[]) => parseProjectListLimitMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("projects routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    parseProjectIdMock.mockImplementation((value: unknown) =>
      typeof value === "string" ? value : null
    );
    parseProjectListLimitMock.mockReturnValue(3);
    createProjectForUserMock.mockResolvedValue({
      id: "project-1",
      title: "Untitled project",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    });
    listProjectsForUserMock.mockResolvedValue([]);
    getProjectForUserMock.mockResolvedValue({
      id: "project-1",
      title: "Untitled project",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    });
    updateProjectTitleForUserMock.mockResolvedValue({
      id: "project-1",
      title: "Renamed project",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });
  });

  it("creates the project without bootstrapping legacy media folders", async () => {
    const req = { method: "POST", body: { title: "" } };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(createProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      title: "",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      project: {
        id: "project-1",
        title: "Untitled project",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });
  });

  it("lists caller-owned projects", async () => {
    listProjectsForUserMock.mockResolvedValueOnce([
      {
        id: "project-1",
        title: "Project One",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
      },
    ]);
    const req = { method: "GET", query: { limit: "3" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(listProjectsForUserMock).toHaveBeenCalledWith({ userId: "user-1", limit: 3 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      projects: [
        {
          id: "project-1",
          title: "Project One",
          createdAt: "2026-04-23T00:00:00.000Z",
          updatedAt: "2026-04-23T01:00:00.000Z",
        },
      ],
    });
  });

  it("returns 400 for invalid project list limit", async () => {
    parseProjectListLimitMock.mockReturnValueOnce(null);
    const req = { method: "GET", query: { limit: "bad" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid project list limit" });
  });

  it("reads one caller-owned project", async () => {
    const req = { method: "GET", query: { projectId: "project-1" } };
    const res = createMockResponse();

    await itemHandler(req as never, res as never);

    expect(getProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updates a caller-owned project title", async () => {
    const req = { method: "PATCH", query: { projectId: "project-1" }, body: { title: "Renamed" } };
    const res = createMockResponse();

    await itemHandler(req as never, res as never);

    expect(updateProjectTitleForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      title: "Renamed",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      project: {
        id: "project-1",
        title: "Renamed project",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
      },
    });
  });

  it("returns 400 for invalid project id on item routes", async () => {
    parseProjectIdMock.mockReturnValueOnce(null);
    const req = { method: "GET", query: { projectId: "bad" } };
    const res = createMockResponse();

    await itemHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid project id" });
  });
});

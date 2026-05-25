import { beforeEach, describe, expect, it, vi } from "vitest";
import createHandler from "../../pages/api/projects/create";
import collectionHandler from "../../pages/api/projects";
import dynamicProjectHandler, {
  resolveProjectDynamicRoute,
} from "../../pages/api/projects/[...projectPath]";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";
import itemHandler from "../../lib/server/projectApiRoutes/item";
import workspaceHandler from "../../lib/server/projectApiRoutes/workspace";

const { MockInvalidProjectWorkspaceSnapshotError } = vi.hoisted(() => ({
  MockInvalidProjectWorkspaceSnapshotError: class InvalidProjectWorkspaceSnapshotError extends Error {},
}));

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const createProjectForUserMock = vi.fn();
const listProjectsForUserMock = vi.fn();
const getProjectForUserMock = vi.fn();
const deleteProjectForUserMock = vi.fn();
const updateProjectTitleForUserMock = vi.fn();
const getProjectWorkspaceStateForUserMock = vi.fn();
const upsertProjectWorkspaceStateForUserMock = vi.fn();
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
  deleteProjectForUser: (...args: unknown[]) => deleteProjectForUserMock(...args),
  updateProjectTitleForUser: (...args: unknown[]) => updateProjectTitleForUserMock(...args),
  parseProjectId: (...args: unknown[]) => parseProjectIdMock(...args),
  parseProjectListLimit: (...args: unknown[]) => parseProjectListLimitMock(...args),
}));

vi.mock("../../lib/server/projectWorkspaceStatesService", () => ({
  getProjectWorkspaceStateForUser: (...args: unknown[]) =>
    getProjectWorkspaceStateForUserMock(...args),
  InvalidProjectWorkspaceSnapshotError: MockInvalidProjectWorkspaceSnapshotError,
  upsertProjectWorkspaceStateForUser: (...args: unknown[]) =>
    upsertProjectWorkspaceStateForUserMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("projects routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
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
    deleteProjectForUserMock.mockResolvedValue({
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
    getProjectWorkspaceStateForUserMock.mockResolvedValue(null);
    upsertProjectWorkspaceStateForUserMock.mockResolvedValue({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
      },
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });
  });

  it("creates the project without bootstrapping legacy media folders", async () => {
    const req = { method: "POST", body: { title: "" }, socket: { remoteAddress: "127.0.0.1" } };
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

  it("returns a sanitized 500 when project creation fails unexpectedly", async () => {
    createProjectForUserMock.mockRejectedValueOnce(new Error("database exploded"));
    const req = {
      method: "POST",
      body: { title: "Boom" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to create project",
    });
  });

  it("rate limits repeated project creation attempts for the same authenticated user", async () => {
    for (let index = 0; index < 12; index += 1) {
      const req = {
        method: "POST",
        body: { title: `Project ${index}` },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();

      await createHandler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      body: { title: "Project blocked" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const blockedRes = createMockResponse();

    await createHandler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("lists caller-owned projects", async () => {
    listProjectsForUserMock.mockResolvedValueOnce([
      {
        id: "project-1",
        title: "Project One",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
        previewImageUrls: ["https://cdn.example.com/project-one-1.png"],
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
          previewImageUrls: ["https://cdn.example.com/project-one-1.png"],
        },
      ],
    });
  });

  it("accepts the all-projects limit for in-studio project switching", async () => {
    parseProjectListLimitMock.mockReturnValueOnce("all");
    const req = { method: "GET", query: { limit: "all" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(listProjectsForUserMock).toHaveBeenCalledWith({ userId: "user-1", limit: "all" });
    expect(res.status).toHaveBeenCalledWith(200);
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

  it("deletes a caller-owned project", async () => {
    const req = { method: "DELETE", query: { projectId: "project-1" } };
    const res = createMockResponse();

    await itemHandler(req as never, res as never);

    expect(deleteProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      deletedProjectId: "project-1",
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

  it("dispatches dynamic project item routes through the catch-all route", async () => {
    const req = { method: "GET", query: { projectPath: ["project-1"] } };
    const res = createMockResponse();

    await dynamicProjectHandler(req as never, res as never);

    expect(req.query).toEqual({ projectId: "project-1" });
    expect(getProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("dispatches dynamic project workspace routes through the catch-all route", async () => {
    const req = { method: "GET", query: { projectPath: ["project-1", "workspace"] } };
    const res = createMockResponse();

    await dynamicProjectHandler(req as never, res as never);

    expect(req.query).toEqual({ projectId: "project-1" });
    expect(getProjectWorkspaceStateForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("resolves the supported dynamic project route tree", () => {
    expect(resolveProjectDynamicRoute(["project-1"])?.kind).toBe("item");
    expect(resolveProjectDynamicRoute(["project-1", "workspace"])?.kind).toBe("workspace");
    expect(resolveProjectDynamicRoute(["project-1", "media", "folders", "list"])?.kind).toBe(
      "media-folders-list"
    );
    expect(resolveProjectDynamicRoute(["project-1", "media", "folders", "create"])?.kind).toBe(
      "media-folders-create"
    );
    expect(resolveProjectDynamicRoute(["project-1", "media", "folders", "rename"])?.kind).toBe(
      "media-folders-rename"
    );
    expect(resolveProjectDynamicRoute(["project-1", "media", "folders", "move"])?.kind).toBe(
      "media-folders-move"
    );
    expect(resolveProjectDynamicRoute(["project-1", "media", "folders", "delete"])?.kind).toBe(
      "media-folders-delete"
    );
    expect(
      resolveProjectDynamicRoute(["project-1", "media", "folders", "membership-batch"])?.kind
    ).toBe("media-folders-membership-batch");
    expect(
      resolveProjectDynamicRoute(["project-1", "media", "folders", "folder-1", "canvas"])
    ).toMatchObject({
      kind: "media-folder-canvas",
      query: { projectId: "project-1", folderId: "folder-1" },
    });
    expect(resolveProjectDynamicRoute(["project-1", "media", "folders", "folder-1"])).toBeNull();
    expect(resolveProjectDynamicRoute(["project-1", "unknown"])).toBeNull();
  });

  it("reads one caller-owned project workspace snapshot", async () => {
    getProjectWorkspaceStateForUserMock.mockResolvedValueOnce({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
      },
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });
    const req = { method: "GET", query: { projectId: "project-1" } };
    const res = createMockResponse();

    await workspaceHandler(req as never, res as never);

    expect(getProjectWorkspaceStateForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      workspace: {
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
        },
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
      },
    });
  });

  it("saves one caller-owned project workspace snapshot", async () => {
    upsertProjectWorkspaceStateForUserMock.mockResolvedValueOnce({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-2",
      },
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage: "project_association_backfill",
        repairMessage: "Project workspace save needs project association repair.",
      },
    });
    const req = {
      method: "PUT",
      query: { projectId: "project-1" },
      body: {
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-2",
        },
      },
    };
    const res = createMockResponse();

    await workspaceHandler(req as never, res as never);

    expect(upsertProjectWorkspaceStateForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-2",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      workspace: {
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-2",
        },
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
      },
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage: "project_association_backfill",
        repairMessage: "Project workspace save needs project association repair.",
      },
    });
  });

  it("returns 400 for invalid project workspace snapshots", async () => {
    upsertProjectWorkspaceStateForUserMock.mockRejectedValueOnce(
      new MockInvalidProjectWorkspaceSnapshotError("Invalid project workspace snapshot")
    );
    const req = {
      method: "PUT",
      query: { projectId: "project-1" },
      body: {
        schemaVersion: 2,
        snapshot: "bad",
      },
    };
    const res = createMockResponse();

    await workspaceHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid project workspace snapshot",
      details: "Invalid project workspace snapshot",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("returns a structured 500 when project workspace auth resolution throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth bootstrap failed"));
    const req = { method: "PUT", query: { projectId: "project-1" }, body: {} };
    const res = createMockResponse();

    await workspaceHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "projects-workspace-save",
      user: null,
      metadata: {
        source: "api.projects.workspace.save",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to save project workspace",
      details: "auth bootstrap failed",
    });
  });
});

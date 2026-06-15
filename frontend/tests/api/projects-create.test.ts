import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import createHandler from "../../pages/api/projects/create";
import collectionHandler from "../../pages/api/projects";
import dynamicProjectHandler, {
  config as dynamicProjectRouteConfig,
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
const writeAppErrorLogMock = vi.fn();
const createProjectForUserMock = vi.fn();
const listProjectsForUserMock = vi.fn();
const getProjectForUserMock = vi.fn();
const deleteProjectForUserMock = vi.fn();
const updateProjectTitleForUserMock = vi.fn();
const getProjectWorkspaceStateForUserMock = vi.fn();
const upsertProjectWorkspaceStateForUserMock = vi.fn();
const parseProjectIdMock = vi.fn();
const parseProjectListLimitMock = vi.fn();
const parseProjectListOffsetMock = vi.fn();
const parseProjectListPreviewModeMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/projectsService", () => ({
  MAX_PROJECT_LIST_LIMIT: 24,
  createProjectForUser: (...args: unknown[]) => createProjectForUserMock(...args),
  listProjectsForUser: (...args: unknown[]) => listProjectsForUserMock(...args),
  getProjectForUser: (...args: unknown[]) => getProjectForUserMock(...args),
  deleteProjectForUser: (...args: unknown[]) => deleteProjectForUserMock(...args),
  updateProjectTitleForUser: (...args: unknown[]) => updateProjectTitleForUserMock(...args),
  parseProjectId: (...args: unknown[]) => parseProjectIdMock(...args),
  parseProjectListLimit: (...args: unknown[]) => parseProjectListLimitMock(...args),
  parseProjectListOffset: (...args: unknown[]) => parseProjectListOffsetMock(...args),
  parseProjectListPreviewMode: (...args: unknown[]) => parseProjectListPreviewModeMock(...args),
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

const createStreamRequest = ({
  method,
  projectPath,
  body,
  contentType = "application/json",
}: {
  method: string;
  projectPath: string[];
  body: string;
  contentType?: string;
}) => {
  const req = new EventEmitter() as EventEmitter & {
    method: string;
    query: { projectPath: string[] } | { projectId: string };
    headers: Record<string, string>;
    body?: unknown;
    destroyed?: boolean;
    destroy: () => void;
  };

  req.method = method;
  req.query = { projectPath };
  req.headers = {
    "content-type": contentType,
    "content-length": String(Buffer.byteLength(body)),
  };
  req.destroy = () => {
    req.destroyed = true;
  };

  queueMicrotask(() => {
    req.emit("data", Buffer.from(body));
    req.emit("end");
  });

  return req;
};

describe("projects routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "event-1" });
    parseProjectIdMock.mockImplementation((value: unknown) =>
      typeof value === "string" ? value : null
    );
    parseProjectListLimitMock.mockReturnValue(3);
    parseProjectListOffsetMock.mockReturnValue(0);
    parseProjectListPreviewModeMock.mockReturnValue("include");
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

    expect(listProjectsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 4,
      offset: 0,
      includePreviews: true,
    });
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
      hasMore: false,
      nextOffset: null,
    });
  });

  it("returns pagination metadata for project list pages", async () => {
    parseProjectListLimitMock.mockReturnValueOnce(2);
    listProjectsForUserMock.mockResolvedValueOnce([
      {
        id: "project-1",
        title: "Project One",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
        previewImageUrls: [],
      },
      {
        id: "project-2",
        title: "Project Two",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T01:00:00.000Z",
        previewImageUrls: [],
      },
      {
        id: "project-3",
        title: "Project Three",
        createdAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T01:00:00.000Z",
        previewImageUrls: [],
      },
    ]);
    const req = { method: "GET", query: { limit: "2", offset: "0" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(listProjectsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 3,
      offset: 0,
      includePreviews: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      projects: [
        expect.objectContaining({ id: "project-1" }),
        expect.objectContaining({ id: "project-2" }),
      ],
      hasMore: true,
      nextOffset: 2,
    });
  });

  it("accepts the all-projects limit for in-studio project switching", async () => {
    parseProjectListLimitMock.mockReturnValueOnce("all");
    const req = { method: "GET", query: { limit: "all" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(listProjectsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      limit: "all",
      offset: 0,
      includePreviews: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("can list projects without preview enrichment for visible-first modal loading", async () => {
    parseProjectListPreviewModeMock.mockReturnValueOnce("none");
    const req = { method: "GET", query: { limit: "3", previewMode: "none" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(listProjectsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 4,
      offset: 0,
      includePreviews: false,
    });
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

  it("returns 400 for invalid project list offset", async () => {
    parseProjectListOffsetMock.mockReturnValueOnce(null);
    const req = { method: "GET", query: { limit: "3", offset: "bad" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid project list offset" });
  });

  it("returns 400 for invalid project list preview mode", async () => {
    parseProjectListPreviewModeMock.mockReturnValueOnce(null);
    const req = { method: "GET", query: { limit: "3", previewMode: "bad" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid project list preview mode" });
  });

  it("does not expose internal project list errors to callers", async () => {
    listProjectsForUserMock.mockRejectedValueOnce(new Error("project list relation leaked"));
    const req = { method: "GET", query: { limit: "3" } };
    const res = createMockResponse();

    await collectionHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "projects-list",
      user: { id: "user-1" },
      metadata: {
        source: "api.projects.list",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to list projects",
    });
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

  it("does not expose internal project item errors to callers", async () => {
    getProjectForUserMock.mockRejectedValueOnce(new Error("project row internals leaked"));
    const req = { method: "GET", query: { projectId: "project-1" } };
    const res = createMockResponse();

    await itemHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "projects-read",
      user: { id: "user-1" },
      metadata: {
        source: "api.projects.read",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to load project",
    });
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

  it("catches escaped dynamic project workspace dispatch failures with structured logging", async () => {
    const res = createMockResponse();
    const req = { method: "PUT", body: {} } as {
      method: string;
      body?: unknown;
      query?: unknown;
    };
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      get: () => ({ projectPath: ["project-1", "workspace"] }),
      set: () => {
        throw new Error("query mutation blocked");
      },
    });

    await dynamicProjectHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "projects-workspace-save-dispatch",
      metadata: {
        project_dynamic_route_kind: "workspace",
        project_dynamic_route_segments: ["project-1", "workspace"],
        source: "api.projects.dynamic_dispatch",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to save project workspace",
      details:
        "Failed to save project workspace during dynamic route dispatch: Internal Server Error",
      failureStage: "workspace save",
    });
  });

  it("manually parses project workspace save bodies before dispatch", async () => {
    const req = createStreamRequest({
      method: "PUT",
      projectPath: ["project-1", "workspace"],
      body: JSON.stringify({
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-2",
        },
      }),
    });
    const res = createMockResponse();

    await dynamicProjectHandler(req as never, res as never);

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
  });

  it("returns a structured 400 when dynamic project workspace body parsing fails", async () => {
    const req = createStreamRequest({
      method: "PUT",
      projectPath: ["project-1", "workspace"],
      body: "{",
    });
    const res = createMockResponse();

    await dynamicProjectHandler(req as never, res as never);

    expect(upsertProjectWorkspaceStateForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith({
      source: "telemetry.api.projects.dynamic_route.request_body_failure",
      scope: "app",
      severity: "low",
      message: "Project dynamic route request body was invalid.",
      route: "projects-workspace-save-request-body",
      endpoint: null,
      statusCode: 400,
      metadata: {
        method: "PUT",
        route_label: "projects-workspace-save-request-body",
        source: "api.projects.dynamic_request_body",
        project_dynamic_route_kind: "workspace",
        project_dynamic_route_segments: ["project-1", "workspace"],
        request_body_failure_kind: "invalid_request_body",
        request_body_content_type: "application/json",
        request_body_limit_bytes: undefined,
      },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid JSON request body.",
      details: "Failed to save project workspace during request body handling.",
      failureStage: "request body",
    });
  });

  it("returns a structured 413 when dynamic project workspace body parsing exceeds the route cap", async () => {
    const oversizedBody = "x".repeat(1024 * 1024 + 1);
    const req = createStreamRequest({
      method: "PUT",
      projectPath: ["project-1", "workspace"],
      body: oversizedBody,
      contentType: "text/plain",
    });
    const res = createMockResponse();

    await dynamicProjectHandler(req as never, res as never);

    expect(upsertProjectWorkspaceStateForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith({
      source: "telemetry.api.projects.dynamic_route.request_body_failure",
      scope: "app",
      severity: "medium",
      message: "Project dynamic route request body exceeded configured limit.",
      route: "projects-workspace-save-request-body",
      endpoint: null,
      statusCode: 413,
      metadata: {
        method: "PUT",
        route_label: "projects-workspace-save-request-body",
        source: "api.projects.dynamic_request_body",
        project_dynamic_route_kind: "workspace",
        project_dynamic_route_segments: ["project-1", "workspace"],
        request_body_failure_kind: "request_body_too_large",
        request_body_content_type: "text/plain",
        request_body_limit_bytes: 1024 * 1024,
      },
    });
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Project request body exceeds 1048576 bytes.",
      details: "Failed to save project workspace during request body handling.",
      failureStage: "request body",
    });
  });

  it("disables the framework body parser for the dynamic project route", () => {
    expect(dynamicProjectRouteConfig).toEqual({
      api: {
        bodyParser: false,
      },
    });
  });

  it("resolves the supported dynamic project route tree", () => {
    expect(resolveProjectDynamicRoute(["project-1"])?.kind).toBe("item");
    expect(resolveProjectDynamicRoute(["project-1", "workspace"])?.kind).toBe("workspace");
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
      project: {
        id: "project-1",
        title: "Untitled project",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
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
      project: {
        id: "project-1",
        title: "Untitled project",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
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

  it("omits the workspace snapshot from preferred minimal save responses", async () => {
    upsertProjectWorkspaceStateForUserMock.mockResolvedValueOnce({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-2",
        workspace: {
          prompt: "large saved prompt",
        },
      },
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
      saveOutcome: {
        status: "saved",
      },
    });
    const req = {
      method: "PUT",
      query: { projectId: "project-1" },
      headers: {
        prefer: "return=minimal",
      },
      body: {
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-2",
          workspace: {
            prompt: "large saved prompt",
          },
        },
      },
    };
    const res = createMockResponse();

    await workspaceHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      project: {
        id: "project-1",
        title: "Untitled project",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
      workspace: {
        projectId: "project-1",
        schemaVersion: 2,
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
      },
      saveOutcome: {
        status: "saved",
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
      failureStage: "workspace save",
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
      metadata: expect.objectContaining({
        workspace_failure_stage: "auth resolution",
        source: "api.projects.workspace.save",
        workspace_snapshot_bytes: expect.any(Number),
        workspace_snapshot_active_output_count: 0,
        workspace_snapshot_archived_output_count: 0,
        workspace_snapshot_total_output_count: 0,
        workspace_snapshot_media_id_count: 0,
        workspace_snapshot_prompt_id_count: 0,
        workspace_snapshot_generation_id_count: 0,
      }),
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to save project workspace",
      details: "Failed to save project workspace during auth resolution.",
      failureStage: "auth resolution",
    });
  });

  it("returns a structured 500 when project lookup fails before workspace save", async () => {
    getProjectForUserMock.mockRejectedValueOnce(new Error("project query unavailable"));
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

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "projects-workspace-save",
      user: { id: "user-1" },
      metadata: expect.objectContaining({
        workspace_failure_stage: "project lookup",
        source: "api.projects.workspace.save",
        workspace_snapshot_bytes: expect.any(Number),
        workspace_snapshot_active_output_count: 0,
        workspace_snapshot_archived_output_count: 0,
        workspace_snapshot_total_output_count: 0,
        workspace_snapshot_media_id_count: 0,
        workspace_snapshot_prompt_id_count: 0,
        workspace_snapshot_generation_id_count: 0,
      }),
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to save project workspace",
      details: "Failed to save project workspace during project lookup.",
      failureStage: "project lookup",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import createHandler from "../../pages/api/projects/create";
import listHandler from "../../pages/api/projects";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const enforceApiRateLimitMock = vi.fn();
const createProjectForUserMock = vi.fn();
const listProjectsForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/rateLimit", () => ({
  enforceApiRateLimit: (...args: unknown[]) => enforceApiRateLimitMock(...args),
}));

vi.mock("../../lib/server/projectsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/server/projectsService")>();
  return {
    ...actual,
    createProjectForUser: (...args: unknown[]) => createProjectForUserMock(...args),
    listProjectsForUser: (...args: unknown[]) => listProjectsForUserMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("projects collection auth boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    enforceApiRateLimitMock.mockReturnValue(true);
  });

  it("logs create-route auth verifier exceptions before rate limit or project creation", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);

    const req = { method: "POST", body: { title: "Launch draft" } };
    const res = createMockResponse();

    await createHandler(req as never, res as never);

    expect(enforceApiRateLimitMock).not.toHaveBeenCalled();
    expect(createProjectForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "projects-create.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to create project" });
  });

  it("logs list-route auth verifier exceptions before project listing", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);

    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await listHandler(req as never, res as never);

    expect(listProjectsForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "projects-list.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to list projects" });
  });
});

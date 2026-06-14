import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-instructions/standard-system-prompt";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveRuntimeAgentPromptForAdminMock = vi.fn();
const saveRuntimeAgentPromptMock = vi.fn();
const runtimePromptVersionMismatchError = new Error("stale");
runtimePromptVersionMismatchError.name = "RuntimeAgentPromptVersionMismatchError";

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/runtimeAgentPromptControlPlane", () => ({
  RequiredRuntimeAgentPromptMissingError: class RequiredRuntimeAgentPromptMissingError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} is missing from the control plane.`);
      this.name = "RequiredRuntimeAgentPromptMissingError";
    }
  },
  RequiredRuntimeAgentPromptUnavailableError: class RequiredRuntimeAgentPromptUnavailableError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} requires a live control-plane connection.`);
      this.name = "RequiredRuntimeAgentPromptUnavailableError";
    }
  },
  RuntimeAgentPromptVersionMismatchError: class RuntimeAgentPromptVersionMismatchError extends Error {},
  resolveRequiredRuntimeAgentPrompt: (...args: unknown[]) =>
    resolveRuntimeAgentPromptForAdminMock(...args),
  saveRuntimeAgentPrompt: (...args: unknown[]) => saveRuntimeAgentPromptMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("admin standard system prompt API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("returns the resolved runtime prompt", async () => {
    resolveRuntimeAgentPromptForAdminMock.mockResolvedValue({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody: "Return one final prompt.",
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveRuntimeAgentPromptForAdminMock).toHaveBeenCalledWith({
      promptId: "STUDIO_AGENT_SYSTEM",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody: "Return one final prompt.",
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });
  });

  it("returns 503 when the live Standard runtime prompt row is missing", async () => {
    const missingPromptError = new Error(
      "Runtime agent prompt STUDIO_AGENT_SYSTEM is missing from the control plane."
    );
    missingPromptError.name = "RequiredRuntimeAgentPromptMissingError";
    resolveRuntimeAgentPromptForAdminMock.mockRejectedValue(missingPromptError);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      code: "STANDARD_PROMPT_UNAVAILABLE",
      error: "Runtime agent prompt STUDIO_AGENT_SYSTEM is missing from the control plane.",
    });
  });

  it("persists the edited runtime prompt", async () => {
    saveRuntimeAgentPromptMock.mockResolvedValue({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody: "Return one final prompt.",
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        promptBody: " Return one final prompt. ",
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveRuntimeAgentPromptMock).toHaveBeenCalledWith({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody: "Return one final prompt.",
      expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(res.json).toHaveBeenCalledWith({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody: "Return one final prompt.",
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
    });
  });

  it("rejects saves that omit the expected updatedAt token", async () => {
    const req = {
      method: "PUT",
      body: {
        promptBody: "Return one final prompt.",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveRuntimeAgentPromptMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "expectedUpdatedAt is required so non-live prompt content cannot overwrite the live Standard system prompt.",
    });
  });

  it("rejects non-string expected updatedAt tokens", async () => {
    const req = {
      method: "PUT",
      body: {
        promptBody: "Return one final prompt.",
        expectedUpdatedAt: 123,
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveRuntimeAgentPromptMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "expectedUpdatedAt must be a string or null.",
    });
  });

  it("returns 409 when the stored Standard prompt is stale", async () => {
    saveRuntimeAgentPromptMock.mockRejectedValue(runtimePromptVersionMismatchError);

    const req = {
      method: "PUT",
      body: {
        promptBody: " Return one final prompt. ",
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "PROMPT_STALE",
      error: "The Standard system prompt changed since you loaded it. Reload and try again.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });
});

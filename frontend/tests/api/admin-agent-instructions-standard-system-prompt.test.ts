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
  RuntimeAgentPromptVersionMismatchError: class RuntimeAgentPromptVersionMismatchError extends Error {},
  resolveRuntimeAgentPromptForAdmin: (...args: unknown[]) =>
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
      degraded: false,
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
    expect(res.json).toHaveBeenCalledWith({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody: "Return one final prompt.",
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
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

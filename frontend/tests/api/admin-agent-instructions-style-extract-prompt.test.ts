import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-instructions/style-extract-prompt";

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

describe("admin style extract prompt API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("logs admin auth verifier exceptions before prompt access", async () => {
    const authError = new Error("auth verifier unavailable");
    requireAdminUserMock.mockRejectedValueOnce(authError);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveRuntimeAgentPromptForAdminMock).not.toHaveBeenCalled();
    expect(saveRuntimeAgentPromptMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "api/admin/agent-instructions/style-extract-prompt.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to load style extraction prompt.",
    });
  });

  it("returns the resolved runtime prompt", async () => {
    resolveRuntimeAgentPromptForAdminMock.mockResolvedValue({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Photographic, moody lighting",
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveRuntimeAgentPromptForAdminMock).toHaveBeenCalledWith({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Photographic, moody lighting",
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });
  });

  it("surfaces degraded seeded fallback state on reads", async () => {
    resolveRuntimeAgentPromptForAdminMock.mockResolvedValue({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Seed fallback prompt",
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
      degraded: true,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Seed fallback prompt",
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
      degraded: true,
    });
  });

  it("persists the edited runtime prompt", async () => {
    saveRuntimeAgentPromptMock.mockResolvedValue({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Digital Illustration, soft bloom",
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        promptBody: " Digital Illustration, soft bloom ",
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveRuntimeAgentPromptMock).toHaveBeenCalledWith({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Digital Illustration, soft bloom",
      expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(res.json).toHaveBeenCalledWith({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Digital Illustration, soft bloom",
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
    });
  });

  it("rejects empty prompt bodies", async () => {
    const req = {
      method: "PUT",
      body: { promptBody: "   " },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveRuntimeAgentPromptMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "promptBody cannot be empty." });
  });

  it("rejects saves that omit the expected updatedAt token", async () => {
    const req = {
      method: "PUT",
      body: {
        promptBody: "Photographic, moody lighting",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveRuntimeAgentPromptMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "expectedUpdatedAt is required so non-live prompt content cannot overwrite the live style extraction prompt.",
    });
  });

  it("rejects non-string expected updatedAt tokens", async () => {
    const req = {
      method: "PUT",
      body: {
        promptBody: "Photographic, moody lighting",
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

  it("returns 405 for unsupported methods", async () => {
    const req = { method: "DELETE" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, PUT");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("stops when admin auth fails", async () => {
    requireAdminUserMock.mockResolvedValue(null);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveRuntimeAgentPromptForAdminMock).not.toHaveBeenCalled();
    expect(saveRuntimeAgentPromptMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("logs and returns 500 when saving fails", async () => {
    saveRuntimeAgentPromptMock.mockRejectedValue(new Error("db unavailable"));

    const req = {
      method: "PUT",
      body: {
        promptBody: "Photographic, moody lighting",
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to save style extraction prompt." });
  });

  it("returns 409 when the stored style extraction prompt is stale", async () => {
    saveRuntimeAgentPromptMock.mockRejectedValue(runtimePromptVersionMismatchError);

    const req = {
      method: "PUT",
      body: {
        promptBody: "Photographic, moody lighting",
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "PROMPT_STALE",
      error: "The style extraction prompt changed since you loaded it. Reload and try again.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });
});

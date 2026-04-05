import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/generation-recovery/replay";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/generation-recovery/replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    process.env.FAL_KEY = "test-fal-key";
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("requires generationId or requestId", async () => {
    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Provide generationId or requestId." });
  });

  it("returns 404 when generation is not found", async () => {
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: false,
      state: "missing_generation",
      generationId: null,
      requestId: "req-missing-1",
      mediaFileIds: [],
      mediaUrls: [],
      processed: false,
      note: "Generation not found.",
    });

    const req = {
      method: "POST",
      body: { requestId: "req-missing-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Generation not found." });
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "admin_replay",
      generationId: null,
      requestId: "req-missing-1",
      routeLabel: "admin.generation_recovery.replay",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-safety-policy/rollback";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const rollbackAgentSafetyPolicyMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/agentSafetyPolicyControlPlane", () => ({
  rollbackAgentSafetyPolicy: (...args: unknown[]) => rollbackAgentSafetyPolicyMock(...args),
  resolveAgentSafetyRollbackCooldownHours: (rawValue?: string | null) => {
    const parsed = Number(rawValue ?? "24");
    if (!Number.isFinite(parsed)) return 24;
    return Math.max(1, Math.min(168, Math.floor(parsed)));
  },
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/agent-safety-policy/rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    getSupabaseAdminMock.mockReturnValue({});
    delete process.env.STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS;
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 200 for successful rollback", async () => {
    rollbackAgentSafetyPolicyMock.mockResolvedValue({
      status: "rolled_back",
      activeProfileId: "prod_safe_v1",
      activePolicyVersion: 1,
      cooldownUntil: "2026-03-03T00:00:00.000Z",
      message: null,
    });

    const req = { method: "POST", body: { reason: "incident", source: "manual" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rollbackAgentSafetyPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cooldownHours: 24,
        source: "manual",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      result: expect.objectContaining({ status: "rolled_back" }),
    });
  });

  it("uses bounded cooldown from environment", async () => {
    process.env.STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS = "72";
    rollbackAgentSafetyPolicyMock.mockResolvedValue({
      status: "already_safe",
      activeProfileId: "prod_safe_v1",
      activePolicyVersion: 1,
      cooldownUntil: "2026-03-03T00:00:00.000Z",
      message: null,
    });

    const req = { method: "POST", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(rollbackAgentSafetyPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cooldownHours: 72,
      })
    );
  });

  it("maps no-safe-target status to 409", async () => {
    rollbackAgentSafetyPolicyMock.mockResolvedValue({
      status: "no_safe_target",
      activeProfileId: null,
      activePolicyVersion: null,
      cooldownUntil: null,
      message: "No last-known-safe policy version is available.",
    });

    const req = { method: "POST", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      result: expect.objectContaining({ status: "no_safe_target" }),
    });
  });

  it("logs unexpected admin auth failures before rollback starts", async () => {
    requireAdminUserMock.mockRejectedValue(new Error("auth verifier exploded"));

    const req = { method: "POST", body: {}, headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "admin/agent-safety-policy/rollback.auth",
      })
    );
    expect(rollbackAgentSafetyPolicyMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to rollback safety policy." });
  });

  it("logs and returns 500 when rollback rpc fails", async () => {
    rollbackAgentSafetyPolicyMock.mockRejectedValue(new Error("rpc failed"));

    const req = { method: "POST", body: {}, headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to rollback safety policy." });
  });
});

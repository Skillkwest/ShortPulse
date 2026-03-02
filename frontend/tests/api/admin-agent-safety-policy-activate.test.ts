import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-safety-policy/activate";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const normalizeRequestedSafetyProfileIdMock = vi.fn();
const activateAgentSafetyPolicyMock = vi.fn();

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
  normalizeRequestedSafetyProfileId: (...args: unknown[]) =>
    normalizeRequestedSafetyProfileIdMock(...args),
  activateAgentSafetyPolicy: (...args: unknown[]) => activateAgentSafetyPolicyMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/agent-safety-policy/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    getSupabaseAdminMock.mockReturnValue({});
    normalizeRequestedSafetyProfileIdMock.mockReturnValue("staging_lenient");
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("requires a valid profile id", async () => {
    normalizeRequestedSafetyProfileIdMock.mockReturnValue(null);
    const req = { method: "POST", body: { profileId: "invalid" } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "profileId must be one of prod_safe_v1, staging_lenient, dev_absolute_zero.",
    });
  });

  it("returns 200 for successful activation", async () => {
    activateAgentSafetyPolicyMock.mockResolvedValue({
      status: "activated",
      activeProfileId: "staging_lenient",
      activePolicyVersion: 1,
      cooldownUntil: null,
      message: null,
    });

    const req = {
      method: "POST",
      body: { profileId: "staging_lenient", reason: "staging experiment", singleReviewerAck: true },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(activateAgentSafetyPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "staging_lenient",
        singleReviewerAck: true,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      result: expect.objectContaining({ status: "activated" }),
    });
  });

  it("rejects dev_absolute_zero activation in production", async () => {
    try {
      vi.stubEnv("NODE_ENV", "production");
      normalizeRequestedSafetyProfileIdMock.mockReturnValue("dev_absolute_zero");

      const req = {
        method: "POST",
        body: { profileId: "dev_absolute_zero", singleReviewerAck: true },
      };
      const res = createMockResponse();
      await handler(req as never, res as never);

      expect(activateAgentSafetyPolicyMock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "dev_absolute_zero cannot be activated in production.",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("maps cooldown-blocked status to 409", async () => {
    activateAgentSafetyPolicyMock.mockResolvedValue({
      status: "cooldown_blocked",
      activeProfileId: null,
      activePolicyVersion: null,
      cooldownUntil: "2026-03-03T00:00:00.000Z",
      message: "Activation blocked during cooldown window.",
    });

    const req = {
      method: "POST",
      body: { profileId: "staging_lenient", singleReviewerAck: true },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      result: expect.objectContaining({ status: "cooldown_blocked" }),
    });
  });

  it("logs and returns 500 when rpc throws", async () => {
    activateAgentSafetyPolicyMock.mockRejectedValue(new Error("rpc exploded"));

    const req = {
      method: "POST",
      body: { profileId: "staging_lenient", singleReviewerAck: true },
      headers: {},
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to activate safety policy." });
  });
});

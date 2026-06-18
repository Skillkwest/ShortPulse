import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-safety-policy/active";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const fetchActiveAgentSafetyPolicyMock = vi.fn();

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
  fetchActiveAgentSafetyPolicy: (...args: unknown[]) => fetchActiveAgentSafetyPolicyMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/admin/agent-safety-policy/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    getSupabaseAdminMock.mockReturnValue({});
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns active policy snapshot", async () => {
    fetchActiveAgentSafetyPolicyMock.mockResolvedValue({
      activeProfileId: "prod_safe_v1",
      activePolicyVersion: 1,
      activePolicy: { text: { safe: "allow" } },
      activePolicyVersionId: 1,
      lastKnownSafeProfileId: "prod_safe_v1",
      lastKnownSafePolicyVersion: 1,
      lastKnownSafePolicyVersionId: 1,
      cooldownUntil: null,
      updatedAt: "2026-03-02T00:00:00.000Z",
      updatedByUserId: null,
      updatedByEmail: "system_seed",
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(fetchActiveAgentSafetyPolicyMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      policy: expect.objectContaining({
        activeProfileId: "prod_safe_v1",
        activePolicyVersion: 1,
      }),
    });
  });

  it("returns initialized=false payload when no runtime snapshot is available", async () => {
    fetchActiveAgentSafetyPolicyMock.mockResolvedValue(null);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      policy: null,
      message: "Agent safety control plane is not initialized.",
    });
  });

  it("logs unexpected admin auth failures before policy lookup starts", async () => {
    requireAdminUserMock.mockRejectedValue(new Error("auth verifier exploded"));

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "admin/agent-safety-policy/active.auth",
      })
    );
    expect(fetchActiveAgentSafetyPolicyMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to read active safety policy." });
  });

  it("logs and returns 500 when lookup fails", async () => {
    fetchActiveAgentSafetyPolicyMock.mockRejectedValue(new Error("rpc failed"));

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to read active safety policy." });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-safety-policy/version";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const normalizeRequestedSafetyProfileIdMock = vi.fn();
const createAgentSafetyPolicyVersionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/agentSafetyPolicyControlPlane", async () => {
  const actual = await vi.importActual("../../lib/server/api/agentSafetyPolicyControlPlane");
  return {
    ...(actual as object),
    normalizeRequestedSafetyProfileId: (...args: unknown[]) =>
      normalizeRequestedSafetyProfileIdMock(...args),
    createAgentSafetyPolicyVersion: (...args: unknown[]) =>
      createAgentSafetyPolicyVersionMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/agent-safety-policy/version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    getSupabaseAdminMock.mockReturnValue({});
    normalizeRequestedSafetyProfileIdMock.mockReturnValue("prod_safe_v1");
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects invalid policy payload", async () => {
    const req = {
      method: "POST",
      body: { profileId: "prod_safe_v1", policy: { schemaVersion: 1 } },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(createAgentSafetyPolicyVersionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid policy payload.",
      })
    );
  });

  it("creates a policy version", async () => {
    createAgentSafetyPolicyVersionMock.mockResolvedValue({
      status: "created",
      activeProfileId: "prod_safe_v1",
      activePolicyVersion: 2,
      cooldownUntil: null,
      message: null,
    });
    const req = {
      method: "POST",
      body: {
        profileId: "prod_safe_v1",
        singleReviewerAck: true,
        policy: {
          schemaVersion: 2,
          input: {
            text: {
              text: {
                sexual: { level: "refuse" },
                violence: { level: "refuse" },
                self_harm: { level: "refuse" },
                hate: { level: "refuse" },
              },
              image: {
                sexual: { level: "refuse" },
                violence: { level: "refuse" },
                self_harm: { level: "refuse" },
                hate: { level: "refuse" },
              },
              video: {
                sexual: { level: "refuse" },
                violence: { level: "refuse" },
                self_harm: { level: "refuse" },
                hate: { level: "refuse" },
              },
            },
            image_preflight: {
              enabled: true,
              thresholds: {
                sexual: 0.8,
                violence: 0.8,
                self_harm: 0.8,
                hate: 0.8,
              },
            },
          },
          generation: {
            defaults: { image: { level: "moderate" }, video: { level: "moderate" } },
            per_model: {},
          },
          postprocess: { mode: "shadow" },
        },
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(createAgentSafetyPolicyVersionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      result: expect.objectContaining({ status: "created" }),
    });
  });
});

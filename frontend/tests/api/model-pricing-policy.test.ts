import { beforeEach, describe, expect, it, vi } from "vitest";
import userPolicyHandler from "../../pages/api/pricing/model-policy";
import applyPolicyHandler from "../../pages/api/admin/pricing/model-policy/apply";
import rollbackPolicyHandler from "../../pages/api/admin/pricing/model-policy/rollback";

const requireApiUserMock = vi.fn();
const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveRuntimeModelPricingPolicyMock = vi.fn();
const applyModelPricingPolicyMock = vi.fn();
const rollbackModelPricingPolicyMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/modelPricingControlPlane", () => ({
  resolveRuntimeModelPricingPolicy: (...args: unknown[]) =>
    resolveRuntimeModelPricingPolicyMock(...args),
  applyModelPricingPolicy: (...args: unknown[]) => applyModelPricingPolicyMock(...args),
  rollbackModelPricingPolicy: (...args: unknown[]) => rollbackModelPricingPolicyMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("model pricing policy routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("returns the active policy snapshot for authenticated users", async () => {
    resolveRuntimeModelPricingPolicyMock.mockResolvedValue({
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          markupBps: 300,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {},
      },
      activePolicyVersion: 4,
      activePolicyVersionId: 44,
      source: "control_plane",
      updatedAt: "2026-04-24T12:00:00.000Z",
      updatedByEmail: "admin@example.com",
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await userPolicyHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      modelPolicy: expect.objectContaining({
        version: "policy-v4",
        policySource: "control_plane",
        markupBps: 300,
      }),
    });
  });

  it("applies a new admin policy", async () => {
    applyModelPricingPolicyMock.mockResolvedValue({
      status: "activated",
      activePolicyVersion: 5,
      activePolicyVersionId: 55,
      message: null,
    });

    const req = {
      method: "POST",
      body: {
        note: "Raise markup for testing",
        reason: "Admin update",
        policy: {
          schemaVersion: 1,
          global: {
            creditUsdScale: 100,
            markupBps: 500,
            defaultRoundingMode: "nearest-5",
            defaultRoundingIncrement: 5,
          },
          perModel: {},
        },
      },
    };
    const res = createMockResponse();

    await applyPolicyHandler(req as never, res as never);

    expect(applyModelPricingPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: "admin@example.com",
        note: "Raise markup for testing",
        reason: "Admin update",
        policy: expect.objectContaining({
          global: expect.objectContaining({
            markupBps: 500,
          }),
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        status: "activated",
        activePolicyVersion: 5,
      })
    );
  });

  it("maps rollback initialization errors to 503", async () => {
    rollbackModelPricingPolicyMock.mockResolvedValue({
      status: "not_initialized",
      activePolicyVersion: null,
      activePolicyVersionId: null,
      message: "Model pricing control plane is not initialized.",
    });

    const req = {
      method: "POST",
      body: {
        reason: "Undo change",
      },
    };
    const res = createMockResponse();

    await rollbackPolicyHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        status: "not_initialized",
      })
    );
  });
});

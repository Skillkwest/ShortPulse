import { beforeEach, describe, expect, it, vi } from "vitest";
import userPolicyHandler from "../../pages/api/pricing/model-policy";
import applyPolicyHandler from "../../pages/api/admin/pricing/model-policy/apply";
import rollbackPolicyHandler from "../../pages/api/admin/pricing/model-policy/rollback";
import { getDefaultAdminPricingCustomRowsDocument } from "../../lib/model-runtime/adminPricingCustomRows";
import { materializeImageBilledCreditPolicy } from "../../lib/model-runtime/materializeImageBilledCreditPolicy";
import { hashModelPricingPolicyArtifact } from "../../lib/server/api/modelPricingPublicationDryRun";

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
    const publishedPolicy = materializeImageBilledCreditPolicy({
      schemaVersion: 1,
      global: {
        creditUsdScale: 100,
        defaultRoundingMode: "ceil",
        defaultRoundingIncrement: 1,
      },
      perModel: {},
    });
    resolveRuntimeModelPricingPolicyMock.mockResolvedValue({
      policy: publishedPolicy,
      activePolicyVersion: 4,
      activePolicyVersionId: 44,
      source: "control_plane",
      billingArtifactSource: "legacy_v9_materialized",
      updatedAt: "2026-04-24T12:00:00.000Z",
      updatedByEmail: "admin@example.com",
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await userPolicyHandler(req as never, res as never);

    expect(resolveRuntimeModelPricingPolicyMock).toHaveBeenCalledWith({
      bypassCache: true,
      requirePublishedBillingArtifact: true,
    });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      modelPolicy: expect.objectContaining({
        version: "policy-v4",
        policySource: "control_plane",
        billingArtifactSource: "legacy_v9_materialized",
        creditUsdScale: 100,
        document: expect.objectContaining({
          perModel: expect.objectContaining({
            "kie-ai/gpt-image-2-text-to-image": expect.objectContaining({
              variants: expect.any(Object),
            }),
          }),
        }),
      }),
    });
  });

  it("returns a safe model-policy failure when auth verification throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = { method: "GET" };
    const res = createMockResponse();

    await userPolicyHandler(req as never, res as never);

    expect(resolveRuntimeModelPricingPolicyMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "pricing/model-policy.auth",
      metadata: {
        source: "api.pricing.model-policy",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load model pricing policy." });
  });

  it("applies a new admin policy", async () => {
    const submittedPolicy = {
      schemaVersion: 1 as const,
      global: {
        creditUsdScale: 100,
        defaultRoundingMode: "ceil" as const,
        defaultRoundingIncrement: 1,
      },
      perModel: {},
    };
    const publishedPolicy = materializeImageBilledCreditPolicy(
      submittedPolicy,
      getDefaultAdminPricingCustomRowsDocument()
    );
    applyModelPricingPolicyMock.mockResolvedValue({
      status: "activated",
      activePolicyVersion: 5,
      activePolicyVersionId: 55,
      activePolicy: publishedPolicy,
      activeCustomRows: getDefaultAdminPricingCustomRowsDocument(),
      activePolicyUpdatedAt: "2026-04-24T13:00:00.000Z",
      activePolicyUpdatedByEmail: "admin@example.com",
      message: null,
    });

    const req = {
      method: "POST",
      body: {
        expectedActivePolicyVersionId: 44,
        note: "Update pricing for testing",
        reason: "Admin update",
        policy: submittedPolicy,
      },
    };
    const res = createMockResponse();

    await applyPolicyHandler(req as never, res as never);

    expect(applyModelPricingPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: "admin@example.com",
        expectedActivePolicyVersionId: 44,
        note: "Update pricing for testing",
        reason: "Admin update",
        policy: expect.objectContaining({
          global: expect.objectContaining({}),
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

  it("requires the reviewed artifact hash for a composition-neutral Seedance apply", async () => {
    const submittedPolicy = {
      schemaVersion: 5 as const,
      global: {
        creditUsdScale: 100,
        defaultRoundingMode: "ceil" as const,
        defaultRoundingIncrement: 1,
      },
      perModel: {
        "kie-ai/seedance-2": {
          billingVariantProfile: "seedance_composition_neutral_v1" as const,
        },
      },
    };
    const published = materializeImageBilledCreditPolicy(submittedPolicy);
    const res = createMockResponse();

    await applyPolicyHandler(
      {
        method: "POST",
        body: {
          expectedActivePolicyVersionId: 44,
          policy: submittedPolicy,
        },
      } as never,
      res as never
    );

    expect(applyModelPricingPolicyMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "artifact_review_required",
        artifactSha256: hashModelPricingPolicyArtifact(published),
      })
    );
  });

  it("does not apply model policy when admin auth verification throws unexpectedly", async () => {
    requireAdminUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        expectedActivePolicyVersionId: 44,
        policy: {
          schemaVersion: 1,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil",
            defaultRoundingIncrement: 1,
          },
          perModel: {},
        },
      },
    };
    const res = createMockResponse();

    await applyPolicyHandler(req as never, res as never);

    expect(applyModelPricingPolicyMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/pricing/model-policy/apply.auth",
      metadata: {
        source: "api.admin.pricing.model-policy.apply",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to apply model pricing policy.",
    });
  });

  it("maps apply initialization errors to 503", async () => {
    applyModelPricingPolicyMock.mockResolvedValue({
      status: "not_initialized",
      activePolicyVersion: null,
      activePolicyVersionId: null,
      activePolicy: null,
      activePolicyUpdatedAt: null,
      activePolicyUpdatedByEmail: null,
      message: "Model pricing control plane is not initialized.",
    });

    const req = {
      method: "POST",
      body: {
        expectedActivePolicyVersionId: 44,
        policy: {
          schemaVersion: 1,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil",
            defaultRoundingIncrement: 1,
          },
          perModel: {},
        },
      },
    };
    const res = createMockResponse();

    await applyPolicyHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        status: "not_initialized",
      })
    );
  });

  it("returns a controlled failure when the submitted pricing artifact is incomplete", async () => {
    const req = {
      method: "POST",
      body: {
        expectedActivePolicyVersionId: 44,
        policy: {
          schemaVersion: 1,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil",
            defaultRoundingIncrement: 1,
          },
          perModel: {},
        },
        customRows: {
          schemaVersion: 1,
          rowsByModel: {
            "unknown-model": [
              {
                displayRowId: "custom:unknown",
                label: "Unknown",
                variantId: "default",
                spec: {},
                overrides: {
                  markupBps: null,
                  providerUsdOverride: null,
                  providerUsdPerSecondOverride: null,
                },
              },
            ],
          },
        },
      },
    };
    const res = createMockResponse();

    await applyPolicyHandler(req as never, res as never);

    expect(applyModelPricingPolicyMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "admin/pricing/model-policy/apply",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing published custom pricing rows for: unknown-model:custom:unknown.",
    });
  });

  it("rejects apply responses that do not verify the submitted active policy", async () => {
    applyModelPricingPolicyMock.mockResolvedValue({
      status: "activated",
      activePolicyVersion: 5,
      activePolicyVersionId: 55,
      activePolicy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {},
      },
      activePolicyUpdatedAt: "2026-04-24T13:00:00.000Z",
      activePolicyUpdatedByEmail: "admin@example.com",
      message: null,
    });

    const req = {
      method: "POST",
      body: {
        expectedActivePolicyVersionId: 44,
        policy: {
          schemaVersion: 1,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil",
            defaultRoundingIncrement: 1,
          },
          perModel: {
            "fal-ai/nano-banana-2": {
              markupBps: 1000,
            },
          },
        },
      },
    };
    const res = createMockResponse();

    await applyPolicyHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: "Applied policy could not be verified against the active runtime policy.",
        status: "verification_failed",
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

  it("does not rollback model policy when admin auth verification throws unexpectedly", async () => {
    requireAdminUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        reason: "Undo change",
      },
    };
    const res = createMockResponse();

    await rollbackPolicyHandler(req as never, res as never);

    expect(rollbackModelPricingPolicyMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/pricing/model-policy/rollback.auth",
      metadata: {
        source: "api.admin.pricing.model-policy.rollback",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to rollback model pricing policy.",
    });
  });
});

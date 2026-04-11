import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalSubmitHandler } from "../../lib/server/api/falSubmitProxy";

const chargeGenerationRequestMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const evaluateScopedGenerationAdmissionMock = vi.fn();
const hasFreshLocalGenerationWorkerHeartbeatMock = vi.fn();
const isLocalDevGenerationWorkerRequiredMock = vi.fn();
const countUserQueuedGenerationSubmitsMock = vi.fn();
const enqueueGenerationSubmitMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const requestGenerationControlPlaneWakeMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("../../lib/server/api/generationAdmission/generationAdmissionService", () => ({
  evaluateScopedGenerationAdmission: (...args: unknown[]) =>
    evaluateScopedGenerationAdmissionMock(...args),
}));

vi.mock("../../lib/server/generationControlPlane/localWorkerHeartbeat", () => ({
  hasFreshLocalGenerationWorkerHeartbeat: (...args: unknown[]) =>
    hasFreshLocalGenerationWorkerHeartbeatMock(...args),
  isLocalDevGenerationWorkerRequired: (...args: unknown[]) =>
    isLocalDevGenerationWorkerRequiredMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/service", () => ({
  countUserQueuedGenerationSubmits: (...args: unknown[]) =>
    countUserQueuedGenerationSubmitsMock(...args),
  enqueueGenerationSubmit: (...args: unknown[]) => enqueueGenerationSubmitMock(...args),
}));

vi.mock("../../lib/server/api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../../lib/server/generationControlPlane/controlPlaneWake", () => ({
  requestGenerationControlPlaneWake: (...args: unknown[]) =>
    requestGenerationControlPlaneWakeMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("createFalSubmitHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED = "true";
    delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES;
    delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT;
    delete process.env.SHORTPULSE_FAL_ADMISSION_MODE;
    delete process.env.SHORTPULSE_FAL_WORKER_OWNED_SUBMIT_ENABLED;
    process.env.SHORTPULSE_FAL_INTEGRATION_MODE = "on";
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "true";

    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      sourceRef: "source-ref-1",
      billingMode: "reservation",
      markSubmitted: vi.fn().mockResolvedValue({
        ok: true,
        status: "reserved",
        sourceRef: "source-ref-1",
        message: null,
        code: null,
      }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    countUserQueuedGenerationSubmitsMock.mockResolvedValue(0);
    enqueueGenerationSubmitMock.mockResolvedValue({
      status: "queued",
      generationId: "gen-queued-1",
      sourceRef: "source-ref-1",
      queueStatus: "queued",
      message: null,
    });
    requestGenerationControlPlaneWakeMock.mockResolvedValue(undefined);
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    evaluateScopedGenerationAdmissionMock.mockResolvedValue({
      decision: {
        mode: "off",
        allowed: true,
        enforced: false,
        wouldLimit: false,
        reason: null,
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 0,
          globalMax: 4,
          tier: "image_standard",
          tierActive: 0,
          tierMax: 4,
        },
      },
      capacitySnapshot: {
        tier: "image_standard",
        globalActive: 0,
        tierActive: 0,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      },
    });
    hasFreshLocalGenerationWorkerHeartbeatMock.mockResolvedValue(true);
    isLocalDevGenerationWorkerRequiredMock.mockReturnValue(false);
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user-1@example.com",
      app_metadata: {},
      user_metadata: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queues new work by default whenever the durable queue is enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {
        host: "shortpulse-git-working-development-kirk-artmans-projects.vercel.app",
        "x-forwarded-proto": "https",
      },
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(countUserQueuedGenerationSubmitsMock).toHaveBeenCalledWith("user-1");
    expect(enqueueGenerationSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "source-ref-1",
        modelId: "fal-ai/nano-banana",
        metadata: expect.objectContaining({
          generation_submit_authority: "worker",
          fal_webhook_callback_url:
            "https://shortpulse-git-working-development-kirk-artmans-projects.vercel.app/api/fal/webhook",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      status: "queued",
      code: "GENERATION_QUEUED",
      sourceRef: "source-ref-1",
      generationId: "gen-queued-1",
      pollAfterMs: 2000,
    });
  });

  it("fails closed when queueing is required in local dev and the worker heartbeat is missing", async () => {
    hasFreshLocalGenerationWorkerHeartbeatMock.mockResolvedValue(false);
    isLocalDevGenerationWorkerRequiredMock.mockReturnValue(true);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Generation queue worker is not running in local development. Start `npm run dev:generation-worker` and retry.",
      code: "GENERATION_QUEUE_WORKER_UNAVAILABLE",
      retryAfterSeconds: 5,
    });
  });

  it("fails closed when worker-owned submit is enabled but the durable queue is disabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";
    process.env.SHORTPULSE_FAL_WORKER_OWNED_SUBMIT_ENABLED = "true";

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Worker-owned generation submit requires the durable submit queue to be enabled. Fix the runtime configuration and retry.",
      code: "GENERATION_WORKER_OWNED_SUBMIT_MISCONFIGURED",
      retryAfterSeconds: 20,
    });
  });

  it("fails closed when the durable queue is disabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: durable queue-backed submit is required.",
      expect.objectContaining({
        reason: "queue_required",
        queue_enabled: false,
      })
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Durable queue-backed generation submit is required for this runtime. Enable the queue and retry.",
      code: "GENERATION_QUEUE_REQUIRED",
      retryAfterSeconds: 20,
    });
  });

  it("returns 429 and releases reservation when the per-user queue depth limit is hit", async () => {
    evaluateScopedGenerationAdmissionMock.mockResolvedValue({
      decision: {
        mode: "enforce",
        allowed: false,
        enforced: true,
        wouldLimit: true,
        reason: "tier_limit",
        retryAfterSeconds: 15,
        snapshot: {
          globalActive: 4,
          globalMax: 4,
          tier: "image_standard",
          tierActive: 4,
          tierMax: 4,
        },
      },
      capacitySnapshot: {
        tier: "image_standard",
        globalActive: 4,
        tierActive: 4,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      },
    });
    countUserQueuedGenerationSubmitsMock.mockResolvedValue(20);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: generation queue depth limit reached.",
      expect.objectContaining({
        reason: "queue_depth_limit",
      })
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("fails closed before billing on unknown top-level fields", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait", rogue_field: "x" },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      })
    );
  });
});

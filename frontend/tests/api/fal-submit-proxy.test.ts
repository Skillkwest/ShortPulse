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
const dispatchProviderSubmitMock = vi.fn();
const applyAcceptedRunningGenerationTransitionMock = vi.fn();

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

vi.mock("../../lib/server/providerIntegration/submitProviderDispatcher", () => ({
  dispatchProviderSubmit: (...args: unknown[]) => dispatchProviderSubmitMock(...args),
}));

vi.mock("../../lib/server/api/generationAcceptedTransitionService", () => ({
  applyAcceptedRunningGenerationTransition: (...args: unknown[]) =>
    applyAcceptedRunningGenerationTransitionMock(...args),
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
    dispatchProviderSubmitMock.mockResolvedValue({
      response: new Response(JSON.stringify({ request_id: "req-direct-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      data: { request_id: "req-direct-1" },
      targetUrl: "https://queue.fal.run/fal-ai/nano-banana",
      targetIndex: 0,
      providerRequestId: "req-direct-1",
      providerDiagnostics: null,
    });
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValue({ ok: true });
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

  it("submits Fal image routes directly and returns a provider request id", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana",
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

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "fal",
        modelId: "fal-ai/nano-banana",
        targets: [
          {
            submitUrl:
              "https://queue.fal.run/fal-ai/nano-banana?webhook_url=https%3A%2F%2Fshortpulse-git-working-development-kirk-artmans-projects.vercel.app%2Fapi%2Ffal%2Fwebhook&fal_webhook=https%3A%2F%2Fshortpulse-git-working-development-kirk-artmans-projects.vercel.app%2Fapi%2Ffal%2Fwebhook",
          },
        ],
      })
    );
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "req-direct-1",
      expect.objectContaining({
        generation_submit_authority: "direct",
      })
    );
    expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "source-ref-1",
        requestId: "req-direct-1",
        providerRequestId: "req-direct-1",
        taskState: "running",
        queueState: "dispatched",
      })
    );
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-direct-1",
        generationId: expect.any(String),
      })
    );
  });

  it("submits Fal edit image routes directly and skips the worker queue", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2/edit",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2/edit",
      routeLabel: "Fal Nano Banana 2 Edit",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait", image_urls: ["https://example.com/base.png"] },
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
      },
      url: "/api/fal/image-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "fal-ai/nano-banana-2/edit",
      })
    );
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-direct-1",
        generationId: expect.any(String),
      })
    );
  });

  it("fails closed when queueing is required in local dev and the worker heartbeat is missing", async () => {
    hasFreshLocalGenerationWorkerHeartbeatMock.mockResolvedValue(false);
    isLocalDevGenerationWorkerRequiredMock.mockReturnValue(true);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
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

  it("fails closed for worker-owned non-inline submits when the durable queue is disabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";
    process.env.SHORTPULSE_FAL_WORKER_OWNED_SUBMIT_ENABLED = "true";

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/kling-video/v2/master/image-to-video",
      routeLabel: "Fal Kling",
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
        "Durable queue-backed generation submit is required for this runtime. Enable the queue and retry.",
      code: "GENERATION_QUEUE_REQUIRED",
      retryAfterSeconds: 20,
    });
  });

  it("still submits active Fal image routes directly when the durable queue is disabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana",
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
    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      request_id: "req-direct-1",
      generationId: expect.any(String),
    });
  });

  it("bypasses queue admission for inline Fal image submits when queue wake is unconfigured", async () => {
    evaluateScopedGenerationAdmissionMock.mockResolvedValue({
      decision: {
        mode: "enforce",
        allowed: false,
        enforced: false,
        wouldLimit: true,
        reason: "global_and_tier_limit",
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 9,
          globalMax: 4,
          tier: "image_standard",
          tierActive: 7,
          tierMax: 4,
        },
      },
      capacitySnapshot: {
        tier: "image_standard",
        globalActive: 9,
        tierActive: 7,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      },
    });
    delete process.env.SHORTPULSE_PUBLIC_API_BASE_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET;

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana",
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/image-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskState: "running",
        queueState: "dispatched",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      request_id: "req-direct-1",
      generationId: expect.any(String),
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

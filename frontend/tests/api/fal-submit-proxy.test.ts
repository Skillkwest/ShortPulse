import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalSubmitHandler } from "../../lib/server/api/falSubmitProxy";

const chargeGenerationRequestMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const evaluateScopedGenerationAdmissionMock = vi.fn();
const enqueueGenerationSubmitMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
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

vi.mock("../../lib/server/api/generationQueue/service", () => ({
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

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("createFalSubmitHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
    process.env.KIE_API_KEY = "test-kie-key";
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
    enqueueGenerationSubmitMock.mockResolvedValue({
      status: "queued",
      generationId: "gen-queued-1",
      sourceRef: "source-ref-1",
      queueStatus: "queued",
      message: null,
    });
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
            submitUrl: "https://queue.fal.run/fal-ai/nano-banana",
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

  it("submits Kie video routes directly and returns a provider request id", async () => {
    const handler = createFalSubmitHandler({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/veo/generate",
      routeLabel: "Kie Veo 3.1 Fast I2V",
    });

    const req = {
      method: "POST",
      body: { prompt: "cinematic skyline reveal" },
      headers: {},
      url: "/api/fal/kie-veo-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        targets: [{ submitUrl: "https://api.kie.ai/api/v1/veo/generate" }],
      })
    );
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "req-direct-1",
      expect.objectContaining({
        generation_submit_authority: "direct",
        provider: "kie",
      })
    );
    expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalled();
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-direct-1",
        generationId: expect.any(String),
      })
    );
  });

  it("fails closed when no direct submit path is available for a non-inline route", async () => {
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
        "Direct provider submit is unavailable for this route in the current runtime. Please retry or use a supported generation route.",
      code: "GENERATION_DIRECT_SUBMIT_UNAVAILABLE",
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

  it("still submits active Kie video routes directly when the durable queue is disabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/veo/generate",
      routeLabel: "Kie Veo 3.1 Fast I2V",
    });

    const req = {
      method: "POST",
      body: { prompt: "product hero rotation" },
      headers: {},
      url: "/api/fal/kie-veo-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      request_id: "req-direct-1",
      generationId: expect.any(String),
    });
  });

  it("still returns the provider request id when direct submit transition recording fails after acceptance", async () => {
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValue({
      ok: false,
      stage: "running",
      error: "transition_failed",
    });

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

    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.api.fal_submit.direct_transition_failed",
        statusCode: 200,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ request_id: "req-direct-1" });
  });

  it("refunds and returns 500 when provider acceptance cannot be linked to local tracking", async () => {
    const charge = {
      userId: "user-1",
      sourceRef: "source-ref-1",
      billingMode: "reservation",
      markSubmitted: vi.fn().mockResolvedValue({
        ok: false,
        status: "error",
        sourceRef: "source-ref-1",
        message: "link failed",
        code: "link_failed",
      }),
      refund: vi.fn().mockResolvedValue(undefined),
    };
    chargeGenerationRequestMock.mockResolvedValue(charge);

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

    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: failed to bind provider request id after direct submit.",
      expect.objectContaining({
        reason: "direct_submit_mark_submitted_failed",
        provider_request_id: "req-direct-1",
      })
    );
    expect(applyAcceptedRunningGenerationTransitionMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.direct_submit_mark_submitted_failed",
        statusCode: 500,
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to start generation tracking. Please retry.",
    });
  });

  it("returns 429 for inline Fal image submits when admission is saturated", async () => {
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

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: direct submit admission limit reached.",
      expect.objectContaining({
        reason: "direct_submit_limited",
      })
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("returns 429 and releases reservation when direct submit admission is saturated", async () => {
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

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: direct submit admission limit reached.",
      expect.objectContaining({
        reason: "direct_submit_limited",
      })
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("returns 429 instead of queue_required when a direct-capable Kie submit is admission-limited and queue is disabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";
    evaluateScopedGenerationAdmissionMock.mockResolvedValue({
      decision: {
        mode: "enforce",
        allowed: false,
        enforced: false,
        wouldLimit: true,
        reason: "tier_limit",
        retryAfterSeconds: 15,
        snapshot: {
          globalActive: 4,
          globalMax: 4,
          tier: "video_standard",
          tierActive: 4,
          tierMax: 4,
        },
      },
      capacitySnapshot: {
        tier: "video_standard",
        globalActive: 4,
        tierActive: 4,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      },
    });

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/veo/generate",
      routeLabel: "Kie Veo 3.1 Fast I2V",
    });

    const req = {
      method: "POST",
      body: { prompt: "storm over downtown" },
      headers: {},
      url: "/api/fal/kie-veo-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: direct submit admission limit reached.",
      expect.objectContaining({
        admission_reason: "tier_limit",
      })
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds: 15,
      })
    );
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

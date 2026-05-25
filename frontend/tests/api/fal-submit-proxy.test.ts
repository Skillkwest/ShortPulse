import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalSubmitHandler } from "../../lib/server/api/falSubmitProxy";

const chargeGenerationRequestMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const evaluateScopedGenerationAdmissionMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const requireApiUserMock = vi.fn();
const dispatchProviderSubmitMock = vi.fn();
const applyAcceptedRunningGenerationTransitionMock = vi.fn();
const associateGenerationWithProjectForUserMock = vi.fn();
const requestGenerationControlPlaneWakeMock = vi.fn();
const readInternalMediaRefsFromPayloadMock = vi.fn();
const readInternalEditMediaRefsFromPayloadMock = vi.fn();
const resolveSignedUrlsForInternalMediaRefsMock = vi.fn();
const resolveSignedUrlsForInternalEditMediaRefsMock = vi.fn();
const filterExternalUrlsFromInternalRefsMock = vi.fn();

const { TestProviderSubmitValidationError } = vi.hoisted(() => {
  class TestProviderSubmitValidationError extends Error {
    code: string;
    detail: unknown;
    statusCode: number;

    constructor({
      message,
      code,
      detail,
      statusCode = 400,
    }: {
      message: string;
      code: string;
      detail?: unknown;
      statusCode?: number;
    }) {
      super(message);
      this.name = "ProviderSubmitValidationError";
      this.code = code;
      this.detail = detail ?? null;
      this.statusCode = statusCode;
    }
  }
  return { TestProviderSubmitValidationError };
});

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

vi.mock("../../lib/server/api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../../lib/server/providerIntegration/submitProviderDispatcher", () => ({
  dispatchProviderSubmit: (...args: unknown[]) => dispatchProviderSubmitMock(...args),
  ProviderSubmitValidationError: TestProviderSubmitValidationError,
}));

vi.mock("../../lib/server/api/generationAcceptedTransitionService", () => ({
  applyAcceptedRunningGenerationTransition: (...args: unknown[]) =>
    applyAcceptedRunningGenerationTransitionMock(...args),
}));

vi.mock("../../lib/server/projectGenerationAssociationsService", () => ({
  associateGenerationWithProjectForUser: (...args: unknown[]) =>
    associateGenerationWithProjectForUserMock(...args),
}));

vi.mock("../../lib/server/generationControlPlane/controlPlaneWake", () => ({
  requestGenerationControlPlaneWake: (...args: unknown[]) =>
    requestGenerationControlPlaneWakeMock(...args),
}));

vi.mock("../../lib/server/api/internalMediaRefResolution", () => ({
  readInternalMediaRefsFromPayload: (...args: unknown[]) =>
    readInternalMediaRefsFromPayloadMock(...args),
  readInternalEditMediaRefsFromPayload: (...args: unknown[]) =>
    readInternalEditMediaRefsFromPayloadMock(...args),
  resolveSignedUrlsForInternalMediaRefs: (...args: unknown[]) =>
    resolveSignedUrlsForInternalMediaRefsMock(...args),
  resolveSignedUrlsForInternalEditMediaRefs: (...args: unknown[]) =>
    resolveSignedUrlsForInternalEditMediaRefsMock(...args),
  filterExternalUrlsFromInternalRefs: (...args: unknown[]) =>
    filterExternalUrlsFromInternalRefsMock(...args),
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
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    dispatchProviderSubmitMock.mockResolvedValue({
      response: new Response(JSON.stringify({ request_id: "req-direct-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      data: { request_id: "req-direct-1" },
      targetUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      targetIndex: 0,
      providerRequestId: "req-direct-1",
      providerDiagnostics: null,
    });
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValue({ ok: true });
    associateGenerationWithProjectForUserMock.mockResolvedValue(true);
    requestGenerationControlPlaneWakeMock.mockResolvedValue(undefined);
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
    readInternalMediaRefsFromPayloadMock.mockReturnValue([]);
    readInternalEditMediaRefsFromPayloadMock.mockReturnValue({
      baseImageRef: null,
      maskRef: null,
      referenceImageRef: null,
    });
    resolveSignedUrlsForInternalMediaRefsMock.mockResolvedValue([]);
    resolveSignedUrlsForInternalEditMediaRefsMock.mockResolvedValue({
      baseImageUrl: null,
      maskUrl: null,
      referenceImageUrl: null,
    });
    filterExternalUrlsFromInternalRefsMock.mockImplementation((urls: unknown[]) =>
      urls.filter(
        (url): url is string => typeof url === "string" && !url.includes("stale.internal")
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits Fal image routes directly and returns a provider request id", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
        shortpulse_context: {
          project_id: "project-1",
          project_id_present: true,
        },
      },
      headers: {
        host: "shortpulse-git-working-development-kirk-artmans-projects.vercel.app",
        "x-forwarded-proto": "https",
      },
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "fal",
        modelId: "fal-ai/nano-banana-2",
        targets: [
          {
            submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
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
    expect(associateGenerationWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      generationId: expect.any(String),
    });
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
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "fal-ai/nano-banana-2/edit",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-direct-1",
        generationId: expect.any(String),
      })
    );
  });

  it("replaces stale internal image refs with fresh signed urls before direct submit", async () => {
    readInternalMediaRefsFromPayloadMock.mockReturnValue([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/base.png",
      },
    ]);
    resolveSignedUrlsForInternalMediaRefsMock.mockResolvedValue([
      "https://fresh.internal/base.png",
    ]);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2/edit",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2/edit",
      routeLabel: "Fal Nano Banana 2 Edit",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
        image_urls: ["https://stale.internal/base.png", "https://external.example/ref.png"],
        shortpulse_internal_media_refs: [{ version: 1 }],
      },
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
      },
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          image_urls: ["https://fresh.internal/base.png", "https://external.example/ref.png"],
        }),
      })
    );
  });

  it("overwrites inpaint image fields from canonical internal edit refs before direct submit", async () => {
    readInternalEditMediaRefsFromPayloadMock.mockReturnValue({
      baseImageRef: {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/base.png",
      },
      maskRef: {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/mask.png",
      },
      referenceImageRef: {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/ref.png",
      },
    });
    resolveSignedUrlsForInternalEditMediaRefsMock.mockResolvedValue({
      baseImageUrl: "https://fresh.internal/base.png",
      maskUrl: "https://fresh.internal/mask.png",
      referenceImageUrl: "https://fresh.internal/ref.png",
    });

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/flux-kontext-lora/inpaint",
      submitUrl: "https://queue.fal.run/fal-ai/flux-kontext-lora/inpaint",
      routeLabel: "Fal Flux Kontext Inpaint",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "fix this",
        image_url: "https://stale.internal/base.png",
        mask_url: "https://stale.internal/mask.png",
        reference_image_url: "https://stale.internal/ref.png",
        shortpulse_internal_edit_media_refs: {
          base_image: {},
          mask_image: {},
          reference_image: {},
        },
      },
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
      },
      url: "/api/fal/flux-kontext-inpaint-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          image_url: "https://fresh.internal/base.png",
          mask_url: "https://fresh.internal/mask.png",
          reference_image_url: "https://fresh.internal/ref.png",
        }),
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
    expect(requestGenerationControlPlaneWakeMock).toHaveBeenCalledWith({
      routeLabel: "Kie Veo 3.1 Fast I2V",
      reason: "direct_submit_accepted",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-direct-1",
        generationId: expect.any(String),
      })
    );
  });

  it("fails closed when no direct submit path is available for a non-inline route", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/kling-video/v2/master/image-to-video",
      routeLabel: "Fal Kling",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Direct provider submit is unavailable for this route in the current runtime. Please retry or use a supported generation route.",
      code: "GENERATION_DIRECT_SUBMIT_UNAVAILABLE",
      retryAfterSeconds: 20,
    });
  });

  it("returns provider validation errors as client-fixable submit failures", async () => {
    dispatchProviderSubmitMock.mockRejectedValueOnce(
      new TestProviderSubmitValidationError({
        message: "Kie Kling requires a reachable public image or video URL.",
        code: "KIE_MEDIA_INPUT_INVALID",
        detail: { field: "image_urls" },
        statusCode: 400,
      })
    );
    const handler = createFalSubmitHandler({
      modelId: "kie-ai/kling-3.0",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      routeLabel: "Kie Kling 3.0",
    });

    const req = {
      method: "POST",
      body: { prompt: "product reveal", image_urls: ["https://example.test/missing.png"] },
      headers: {},
      url: "/api/fal/kie-kling-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: direct provider submit validation failed.",
      expect.objectContaining({
        reason: "direct_submit_validation_failed",
        code: "KIE_MEDIA_INPUT_INVALID",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.direct_submit_validation_failed",
        statusCode: 400,
      })
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Kie Kling requires a reachable public image or video URL.",
      code: "KIE_MEDIA_INPUT_INVALID",
      detail: { field: "image_urls" },
    });
  });

  it("surfaces Kie provider messages when a 200 response has no request id", async () => {
    dispatchProviderSubmitMock.mockResolvedValueOnce({
      response: new Response(
        JSON.stringify({ code: 200, msg: "Submit accepted without task id", data: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
      data: { code: 200, msg: "Submit accepted without task id", data: {} },
      targetUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      targetIndex: 0,
      providerRequestId: null,
      providerDiagnostics: null,
    });
    const handler = createFalSubmitHandler({
      modelId: "kie-ai/kling-3.0",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      routeLabel: "Kie Kling 3.0",
    });

    const req = {
      method: "POST",
      body: { prompt: "product reveal", image_urls: ["https://example.test/ref.png"] },
      headers: {},
      url: "/api/fal/kie-kling-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: inline provider submit failed.",
      expect.objectContaining({
        reason: "direct_submit_missing_request_id",
        upstream_status: 200,
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Submit accepted without task id",
        statusCode: 502,
      })
    );
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: "Submit accepted without task id",
      detail: "Submit accepted without task id",
    });
  });

  it("keeps generic missing-id text when Kie only reports success without a task id", async () => {
    dispatchProviderSubmitMock.mockResolvedValueOnce({
      response: new Response(JSON.stringify({ code: 200, msg: "success", data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      data: { code: 200, msg: "success", data: {} },
      targetUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      targetIndex: 0,
      providerRequestId: null,
      providerDiagnostics: null,
    });
    const handler = createFalSubmitHandler({
      modelId: "kie-ai/kling-3.0",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      routeLabel: "Kie Kling 3.0",
    });
    const req = {
      method: "POST",
      body: { prompt: "product reveal", image_urls: ["https://example.test/ref.png"] },
      headers: {},
      url: "/api/fal/kie-kling-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: "Provider submit response missing request id.",
      detail: "success",
    });
  });

  it("still submits active Fal image routes directly when the durable queue is disabled", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      request_id: "req-direct-1",
      generationId: expect.any(String),
    });
  });

  it("still submits active Kie video routes directly when the durable queue is disabled", async () => {
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

  it("repairs accepted direct-submit tracking before returning a durable generation id", async () => {
    applyAcceptedRunningGenerationTransitionMock
      .mockResolvedValueOnce({
        ok: false,
        stage: "running",
        error: "transition_failed",
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalledTimes(2);
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        requestId: "req-direct-1",
        taskState: "running",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.api.fal_submit.direct_transition_failed",
        statusCode: 200,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      request_id: "req-direct-1",
      generationId: expect.any(String),
    });
  });

  it("returns non-ok when accepted direct-submit tracking cannot be repaired", async () => {
    applyAcceptedRunningGenerationTransitionMock
      .mockResolvedValueOnce({
        ok: false,
        stage: "running",
        error: "transition_failed",
      })
      .mockResolvedValueOnce({
        ok: false,
        stage: "running",
        error: "repair_failed",
      });

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalledTimes(2);
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: "Provider accepted the generation, but tracking could not be repaired.",
      request_id: "req-direct-1",
    });
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
      modelId: "fal-ai/nano-banana-2",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
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
    expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalledTimes(1);
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

  it("still submits inline Fal image routes when admission is saturated", async () => {
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
      modelId: "fal-ai/nano-banana-2",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(charge.refund).not.toHaveBeenCalledWith(
      "Auto-release: direct submit admission limit reached.",
      expect.anything()
    );
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it("still submits direct routes when admission is saturated", async () => {
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
      modelId: "fal-ai/nano-banana-2",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(charge.refund).not.toHaveBeenCalledWith(
      "Auto-release: direct submit admission limit reached.",
      expect.anything()
    );
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it("still submits direct-capable Kie routes when admission is limited and queue is disabled", async () => {
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
    expect(dispatchProviderSubmitMock).toHaveBeenCalled();
    expect(charge.refund).not.toHaveBeenCalledWith(
      "Auto-release: direct submit admission limit reached.",
      expect.anything()
    );
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it("fails closed before billing on unknown top-level fields", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2",
      routeLabel: "Fal Nano Banana 2",
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait", rogue_field: "x" },
      headers: {},
      url: "/api/fal/nano-banana-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      })
    );
  });
});

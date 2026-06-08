import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalSubmitHandler } from "../../lib/server/api/falSubmitProxy";

const chargeGenerationRequestMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const evaluateScopedGenerationAdmissionMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const requireApiUserMock = vi.fn();
const dispatchProviderSubmitMock = vi.fn();
const applyAcceptedRunningGenerationTransitionMock = vi.fn();
const createMotionReferenceVideoLeaseForGenerationMock = vi.fn();
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
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
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

vi.mock("../../lib/server/motionReferenceVideoAssetLease", () => ({
  createMotionReferenceVideoLeaseForGeneration: (...args: unknown[]) =>
    createMotionReferenceVideoLeaseForGenerationMock(...args),
}));

vi.mock("../../lib/server/projectGenerationAssociationsService", () => ({
  associateGenerationWithProjectForUserBestEffort: (...args: unknown[]) =>
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
    createMotionReferenceVideoLeaseForGenerationMock.mockResolvedValue(undefined);
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
    expect(associateGenerationWithProjectForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        projectId: "project-1",
        generationId: expect.any(String),
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

  it("creates a motion reference lease when shortpulse context includes a motion asset", async () => {
    const handler = createFalSubmitHandler({
      modelId: "kie-ai/kling-3.0",
      provider: "kie",
      submitUrl: "https://queue.kie.ai/kling",
      routeLabel: "Kie Kling",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "Transfer motion",
        image_url: "https://example.com/character.png",
        video_url: "https://example.com/motion.mp4",
        shortpulse_context: {
          motion_reference_asset: {
            bucket: "media_library",
            storage_path: "user-1/videos/motion-control/motion-ref.mp4",
            source: "motion_control_upload",
          },
        },
      },
      headers: {
        host: "shortpulse.ai",
        "x-forwarded-proto": "https",
      },
      url: "/api/fal/kie-kling-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createMotionReferenceVideoLeaseForGenerationMock).toHaveBeenCalledWith({
      generationId: expect.any(String),
      userId: "user-1",
      shortpulseContext: expect.objectContaining({
        motion_reference_asset: {
          bucket: "media_library",
          storage_path: "user-1/videos/motion-control/motion-ref.mp4",
          source: "motion_control_upload",
        },
      }),
    });
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

  it("keeps edit input image count available for billing without sending it to Fal", async () => {
    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2/edit",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2/edit",
      routeLabel: "Fal Nano Banana 2 Edit",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
        image_urls: ["https://example.com/base.png"],
        input_image_count: 1,
      },
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
      },
      url: "/api/fal/nano-banana-2-edit-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          input_image_count: 1,
        }),
      })
    );
    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.not.objectContaining({
          input_image_count: expect.anything(),
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
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
      url: "/api/fal/nano-banana-2-edit-submit",
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

  it("merges fresh internal image refs into Kie GPT Image 2 input_urls before direct submit", async () => {
    readInternalMediaRefsFromPayloadMock.mockReturnValue([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/character.png",
      },
    ]);
    resolveSignedUrlsForInternalMediaRefsMock.mockResolvedValue([
      "https://fresh.internal/character.png",
    ]);

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/gpt-image-2-image-to-image",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      routeLabel: "Kie GPT Image 2 Image to Image",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "keep the same character",
        input_urls: ["https://stale.internal/character.png"],
        shortpulse_internal_media_refs: [{ version: 1 }],
      },
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
      },
      url: "/api/fal/kie-gpt-image-2-edit-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "kie-ai/gpt-image-2-image-to-image",
        payload: expect.objectContaining({
          input_urls: ["https://fresh.internal/character.png"],
        }),
      })
    );
  });

  it("falls back to external image refs when internal ref signing fails", async () => {
    readInternalMediaRefsFromPayloadMock.mockReturnValue([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/base.png",
      },
    ]);
    resolveSignedUrlsForInternalMediaRefsMock.mockRejectedValue(
      new Error("Unable to sign internal media refs: storage unavailable")
    );

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
      url: "/api/fal/nano-banana-2-edit-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          image_urls: ["https://external.example/ref.png"],
        }),
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.api.fal_submit.internal_media_ref_sign_fallback",
        statusCode: 200,
        metadata: expect.objectContaining({
          fallback_reference_count: 1,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns a structured 503 when only internal image refs are available and signing fails", async () => {
    readInternalMediaRefsFromPayloadMock.mockReturnValue([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/base.png",
      },
    ]);
    resolveSignedUrlsForInternalMediaRefsMock.mockRejectedValue(
      new Error("Unable to sign internal media refs: storage unavailable")
    );

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-2/edit",
      submitUrl: "https://queue.fal.run/fal-ai/nano-banana-2/edit",
      routeLabel: "Fal Nano Banana 2 Edit",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
        image_urls: ["https://stale.internal/base.png"],
        shortpulse_internal_media_refs: [{ version: 1 }],
      },
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
      },
      url: "/api/fal/nano-banana-2-edit-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.internal_media_ref_sign_failed",
        statusCode: 503,
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "20");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Reference media could not be prepared. Please retry.",
      detail: "Unable to refresh internal reference media URLs.",
    });
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
      modelId: "test/internal-edit-media",
      submitUrl: "https://queue.fal.run/test/internal-edit-media",
      routeLabel: "Test Internal Edit Media",
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
      url: "/api/fal/test-internal-edit-submit",
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

  it("falls back to external edit refs when internal edit signing fails", async () => {
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
    resolveSignedUrlsForInternalEditMediaRefsMock.mockRejectedValue(
      new Error("Unable to sign internal media refs: storage unavailable")
    );

    const handler = createFalSubmitHandler({
      modelId: "test/internal-edit-media",
      submitUrl: "https://queue.fal.run/test/internal-edit-media",
      routeLabel: "Test Internal Edit Media",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "fix this",
        image_url: "https://external.example/base.png",
        mask_url: "https://external.example/mask.png",
        reference_image_url: "https://external.example/ref.png",
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
      url: "/api/fal/test-internal-edit-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          image_url: "https://external.example/base.png",
          mask_url: "https://external.example/mask.png",
          reference_image_url: "https://external.example/ref.png",
        }),
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.api.fal_submit.internal_edit_media_ref_sign_fallback",
        statusCode: 200,
        metadata: expect.objectContaining({
          fallback_reference_count: 3,
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

  it("records compact Kie submit summaries on accepted Seedance direct submits", async () => {
    const handler = createFalSubmitHandler({
      modelId: "kie-ai/seedance-2",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      routeLabel: "Kie Seedance 2.0",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic skyline reveal",
        aspect_ratio: "16:9",
        resolution: "480p",
        duration: "15",
        generate_audio: true,
        reference_video_urls: ["https://example.com/reference.mp4"],
      },
      headers: {},
      url: "/api/fal/kie-seedance-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptInput: expect.objectContaining({
          metadata: expect.objectContaining({
            provider_submit_summary: expect.objectContaining({
              aspect_ratio: "16:9",
              resolution: "480p",
              duration: "15",
              generate_audio: true,
              reference_video_count: 1,
              prompt_present: true,
            }),
          }),
        }),
      })
    );
  });

  it("records compact Kie submit summaries on direct submit failures", async () => {
    const charge = {
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
    };
    chargeGenerationRequestMock.mockResolvedValue(charge);
    dispatchProviderSubmitMock.mockResolvedValue({
      response: new Response(JSON.stringify({ code: 402, msg: "Credits insufficient" }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }),
      data: { code: 402, msg: "Credits insufficient" },
      targetUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      targetIndex: 0,
      providerRequestId: null,
      providerDiagnostics: null,
    });

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/seedance-2",
      provider: "kie",
      submitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
      routeLabel: "Kie Seedance 2.0",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic skyline reveal",
        resolution: "480p",
        duration: "15",
        generate_audio: true,
      },
      headers: {},
      url: "/api/fal/kie-seedance-2-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: inline provider submit failed.",
      expect.objectContaining({
        provider_body_code: 402,
        provider_submit_summary: expect.objectContaining({
          resolution: "480p",
          duration: "15",
          generate_audio: true,
          prompt_present: true,
        }),
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.direct_submit_failed",
        statusCode: 402,
        metadata: expect.objectContaining({
          provider_body_code: 402,
          provider_submit_summary: expect.objectContaining({
            resolution: "480p",
            duration: "15",
            generate_audio: true,
            prompt_present: true,
          }),
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: "Credits insufficient",
      detail: "Credits insufficient",
    });
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

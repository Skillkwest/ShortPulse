import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalSubmitHandler } from "../../lib/server/api/falSubmitProxy";

const chargeGenerationRequestMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const ensureSubmittedGenerationRecordMock = vi.fn();
const evaluateScopedGenerationAdmissionMock = vi.fn();
const hasFreshLocalGenerationWorkerHeartbeatMock = vi.fn();
const isLocalDevGenerationWorkerRequiredMock = vi.fn();
const countUserQueuedGenerationSubmitsMock = vi.fn();
const enqueueGenerationSubmitMock = vi.fn();
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

vi.mock("../../lib/server/api/generationSubmitPersistence", () => ({
  ensureSubmittedGenerationRecord: (...args: unknown[]) =>
    ensureSubmittedGenerationRecordMock(...args),
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
    delete process.env.SHORTPULSE_FAL_LEGACY_DIRECT_SUBMIT_ENABLED;
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";
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
    ensureSubmittedGenerationRecordMock.mockResolvedValue({
      ok: true,
      generationId: "gen-1",
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
    hasFreshLocalGenerationWorkerHeartbeatMock.mockReturnValue(true);
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

  it("falls back to secondary submit target when primary alias returns 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "req-fallback" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [
        {
          submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video",
          transformPayload: (payload) => ({
            ...payload,
            image_url: "https://cdn.shortpulse.test/first.png",
          }),
        },
        {
          submitUrl: "https://queue.fal.run/fal-ai/veo3.1/reference-to-video",
          transformPayload: (payload) => ({
            ...payload,
            image_urls: ["https://cdn.shortpulse.test/first.png"],
          }),
        },
      ],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate this frame",
        image_urls: ["https://cdn.shortpulse.test/first.png"],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(firstHeaders?.["X-Fal-Request-Timeout"]).toBe("20");
    expect(secondHeaders?.["X-Fal-Request-Timeout"]).toBe("20");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ request_id: "req-fallback" }));
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "req-fallback",
      expect.objectContaining({
        upstream_status: 200,
      })
    );
    expect(ensureSubmittedGenerationRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        modelId: "fal-ai/veo3.1/image-to-video",
        providerRequestId: "req-fallback",
        sourceRef: "source-ref-1",
      })
    );
    expect(charge.refund).not.toHaveBeenCalled();
  });

  it("honors generation-submit field-mode override and bypasses explicit latest-turn refusal", async () => {
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT =
      '{"latest_user_turn":"off"}';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ request_id: "req-explicit-allowed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-pro",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana-pro" }],
      routeLabel: "Fal Nano Banana Pro",
    });

    const req = {
      method: "POST",
      body: { prompt: "graphic sexual intercourse with explicit anatomy" },
      headers: {},
      url: "/api/fal/nano-banana-pro-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "req-explicit-allowed" })
    );
  });

  it("keeps primary failure response when primary is non-404 and fallback also fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "primary fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "primary fail retry" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "fallback fail" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [
        { submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" },
        { submitUrl: "https://queue.fal.run/fal-ai/veo3.1/reference-to-video" },
      ],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate this frame",
        image_urls: ["https://cdn.shortpulse.test/first.png"],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    const thirdHeaders = (fetchMock.mock.calls[2]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(firstHeaders?.["X-Fal-Request-Timeout"]).toBe("20");
    expect(secondHeaders?.["X-Fal-Request-Timeout"]).toBe("20");
    expect(thirdHeaders?.["X-Fal-Request-Timeout"]).toBe("20");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "primary fail retry" });
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: Fal submit rejected.",
      expect.objectContaining({
        upstream_status: 500,
      })
    );
    expect(ensureSubmittedGenerationRecordMock).not.toHaveBeenCalled();
  });

  it("retries retryable primary submit failures before succeeding on the same target", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "temporary outage" }), {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "x-fal-retryable": "true",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "req-retried-primary" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana-pro",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana-pro" }],
      routeLabel: "Fal Nano Banana Pro",
    });

    const req = {
      method: "POST",
      body: { prompt: "cinematic portrait" },
      headers: {},
      url: "/api/fal/nano-banana-pro-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "req-retried-primary" })
    );
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).not.toHaveBeenCalled();
  });

  it("does not retry non-retryable primary failures and proceeds to fallback target", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid payload" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "req-fallback-no-retry" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [
        { submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" },
        { submitUrl: "https://queue.fal.run/fal-ai/veo3.1/reference-to-video" },
      ],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        image_urls: ["https://cdn.shortpulse.test/first.png"],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "req-fallback-no-retry" })
    );
  });

  it("accepts provider request-id aliases beyond request_id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ task_id: "task-alias-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" }],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate this frame",
        image_urls: ["https://cdn.shortpulse.test/first.png"],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ task_id: "task-alias-1" }));
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "task-alias-1",
      expect.objectContaining({
        upstream_status: 200,
      })
    );
    expect(ensureSubmittedGenerationRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "task-alias-1",
      })
    );
  });

  it("fails closed when billing linkage fails after accepted submit", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ request_id: "req-linkage-pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    chargeGenerationRequestMock.mockResolvedValueOnce({
      userId: "user-1",
      sourceRef: "source-ref-1",
      billingMode: "reservation",
      markSubmitted: vi.fn().mockResolvedValue({
        ok: false,
        status: "failed",
        sourceRef: "source-ref-1",
        message: "mark_submitted_failed",
        code: "PGRST301",
      }),
      refund: vi.fn().mockResolvedValue(undefined),
    });

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
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error:
          "Unable to finalize generation tracking. Please verify recent outputs before retrying.",
        code: "GENERATION_SUBMIT_TRACKING_FAILED",
      })
    );
    expect(ensureSubmittedGenerationRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-linkage-pending",
        sourceRef: "source-ref-1",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.mark_submitted_failed",
        metadata: expect.objectContaining({
          billing_mode: "reservation",
          provider_request_id: "req-linkage-pending",
          source_ref: "source-ref-1",
          linkage_status: "failed",
        }),
      })
    );
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-compensation: accepted submit could not be durably tracked.",
      expect.objectContaining({
        provider_request_id: "req-linkage-pending",
        submit_link_status: "failed",
        submit_link_code: "PGRST301",
        persistence_ok: true,
        persistence_error: null,
      })
    );
  });

  it("submits the projected payload returned by the shared contract gate", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ request_id: "req-projected" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
      validatePayload: (payload) => ({
        valid: true,
        projectedPayload: {
          prompt: payload.prompt,
        },
      }),
    });

    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
        aspect_ratio: "1:1",
      },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.body).toBe(JSON.stringify({ prompt: "portrait" }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed when upstream accepts but neither linkage nor generation persistence succeed", async () => {
    const markSubmittedMock = vi.fn().mockResolvedValue({
      ok: false,
      status: "failed",
      sourceRef: "source-ref-link-fail",
      message: "undefined object",
      code: "42704",
    });
    ensureSubmittedGenerationRecordMock.mockResolvedValueOnce({
      ok: false,
      error: "insert failed",
    });
    chargeGenerationRequestMock.mockResolvedValueOnce({
      userId: "user-1",
      sourceRef: "source-ref-link-fail",
      billingMode: "reservation",
      markSubmitted: markSubmittedMock,
      refund: vi.fn().mockResolvedValue(undefined),
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ request_id: "req-link-fail" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(markSubmittedMock).toHaveBeenCalledWith(
      "req-link-fail",
      expect.objectContaining({
        upstream_status: 200,
      })
    );
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-compensation: accepted submit could not be durably tracked.",
      expect.objectContaining({
        provider_request_id: "req-link-fail",
        submit_link_status: "failed",
        submit_link_code: "42704",
        persistence_ok: false,
        persistence_error: "insert failed",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.persist_generation_failed",
        statusCode: 500,
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.mark_submitted_failed",
        statusCode: 500,
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Unable to finalize generation tracking. Please verify recent outputs before retrying.",
      code: "GENERATION_SUBMIT_TRACKING_FAILED",
    });
  });

  it("fails closed when accepted submit cannot persist ai_generations even if billing linkage succeeds", async () => {
    ensureSubmittedGenerationRecordMock.mockResolvedValueOnce({
      ok: false,
      error: "insert failed",
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ request_id: "req-persist-fail" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

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
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Unable to finalize generation tracking. Please verify recent outputs before retrying.",
      code: "GENERATION_SUBMIT_TRACKING_FAILED",
    });
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-compensation: accepted submit could not be durably tracked.",
      expect.objectContaining({
        provider_request_id: "req-persist-fail",
        submit_link_status: "reserved",
        persistence_ok: false,
        persistence_error: "insert failed",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.persist_generation_failed",
        statusCode: 500,
      })
    );
  });

  it("fails closed when admission evaluation throws after billing reservation", async () => {
    evaluateScopedGenerationAdmissionMock.mockRejectedValueOnce(new Error("admission blew up"));
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
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: generation admission check failed.",
      expect.objectContaining({
        model_id: "fal-ai/nano-banana",
        detail: "Error: admission blew up",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.admission_check_failed",
        message: "Generation admission check failed; submit failed closed.",
        statusCode: 500,
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "20");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Generation admission is temporarily unavailable. Please retry shortly.",
      code: "GENERATION_ADMISSION_UNAVAILABLE",
      retryAfterSeconds: 20,
    });
  });

  it("fails closed when queueing is required in local dev and the worker heartbeat is missing", async () => {
    isLocalDevGenerationWorkerRequiredMock.mockReturnValue(true);
    hasFreshLocalGenerationWorkerHeartbeatMock.mockReturnValue(false);
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "true";
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    evaluateScopedGenerationAdmissionMock.mockResolvedValueOnce({
      decision: {
        mode: "enforce",
        allowed: false,
        enforced: true,
        wouldLimit: true,
        reason: "global_and_tier_limit",
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 5,
          globalMax: 4,
          tier: "image_standard",
          tierActive: 5,
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
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: local generation queue worker heartbeat missing.",
      expect.objectContaining({
        reason: "local_queue_worker_missing",
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "5");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Generation queue worker is not running in local development. Start `npm run dev:generation-worker` and retry.",
      code: "GENERATION_QUEUE_WORKER_UNAVAILABLE",
      retryAfterSeconds: 5,
    });
  });

  it("queues new work under worker-owned submit mode even when admission is not enforcing", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "true";
    process.env.SHORTPULSE_FAL_WORKER_OWNED_SUBMIT_ENABLED = "true";

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
      headers: {},
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
        }),
      })
    );
    expect(requestGenerationControlPlaneWakeMock).toHaveBeenCalledWith({
      routeLabel: "Fal Nano Banana",
      reason: "queued_submit",
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      status: "queued",
      code: "GENERATION_QUEUED",
      sourceRef: "source-ref-1",
      generationId: "gen-queued-1",
      pollAfterMs: 2000,
    });
    expect(ensureSubmittedGenerationRecordMock).not.toHaveBeenCalled();
  });

  it("fails closed when worker-owned submit is enabled but the durable queue is disabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";
    process.env.SHORTPULSE_FAL_WORKER_OWNED_SUBMIT_ENABLED = "true";

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
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(ensureSubmittedGenerationRecordMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: worker-owned submit requires queue-enabled runtime configuration.",
      expect.objectContaining({
        reason: "worker_owned_submit_queue_disabled",
        queue_enabled: false,
        worker_owned_submit_enabled: true,
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.worker_owned_submit_misconfigured",
        statusCode: 503,
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "20");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Worker-owned generation submit requires the durable submit queue to be enabled. Fix the runtime configuration and retry.",
      code: "GENERATION_WORKER_OWNED_SUBMIT_MISCONFIGURED",
      retryAfterSeconds: 20,
    });
  });

  it("fails closed when the legacy direct-submit fallback is disabled and no queued path is selected", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";
    process.env.SHORTPULSE_FAL_LEGACY_DIRECT_SUBMIT_ENABLED = "false";

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
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enqueueGenerationSubmitMock).not.toHaveBeenCalled();
    expect(ensureSubmittedGenerationRecordMock).not.toHaveBeenCalled();
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: legacy direct submit is disabled and no queued path was selected.",
      expect.objectContaining({
        reason: "legacy_direct_submit_disabled",
        queue_enabled: false,
        worker_owned_submit_enabled: false,
        admission_enforced: false,
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.legacy_direct_submit_disabled",
        statusCode: 503,
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "20");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Direct inline generation submit is disabled for this runtime. Enable the durable queue or re-enable the legacy fallback and retry.",
      code: "GENERATION_DIRECT_SUBMIT_DISABLED",
      retryAfterSeconds: 20,
    });
  });

  it("queues new work when legacy direct submit is disabled and the durable queue is enabled", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "true";
    process.env.SHORTPULSE_FAL_LEGACY_DIRECT_SUBMIT_ENABLED = "false";

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
      headers: {},
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
    expect(ensureSubmittedGenerationRecordMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the shared contract gate reports a violation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
      validatePayload: () => ({
        valid: false,
        error: "Invalid custom payload.",
        detail: { field: "prompt" },
      }),
    });

    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
      },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid custom payload.",
      code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      detail: { field: "prompt" },
    });
  });

  it("fails closed with a deterministic contract code before billing on unknown top-level fields", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/nano-banana",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/nano-banana" }],
      routeLabel: "Fal Nano Banana",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
        unexpected_debug_flag: true,
      },
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unknown top-level field(s) for fal-ai/nano-banana submission.",
      code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      detail: {
        unknown_fields: ["unexpected_debug_flag"],
        allowed_top_level_fields: [
          "prompt",
          "aspect_ratio",
          "output_format",
          "sync_mode",
          "limit_generations",
          "num_images",
          "seed",
        ],
      },
    });
  });

  it("blocks character-scoped media URLs for video payloads before billing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" }],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        image_urls: [
          "https://example.supabase.co/storage/v1/object/sign/media_library/user/characters/char-a/ref.png?token=abc",
        ],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "VIDEO_CHARACTER_MEDIA_BLOCKED",
      })
    );
  });

  it("logs video contract violations in shadow mode and still submits upstream", async () => {
    process.env.SHORTPULSE_VIDEO_SUBMIT_CANONICAL_MODE = "shadow";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ request_id: "req-video-shadow" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" }],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        image_urls: [
          "https://example.supabase.co/storage/v1/object/sign/media_library/user/characters/char-a/ref.png?token=abc",
        ],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chargeGenerationRequestMock).toHaveBeenCalledTimes(1);
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.video_contract_violation",
        statusCode: 200,
        metadata: expect.objectContaining({
          code: "VIDEO_CHARACTER_MEDIA_BLOCKED",
          enforce_mode: "shadow",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "req-video-shadow" })
    );
  });

  it("bypasses alias normalization when video canonical mode is off", async () => {
    process.env.SHORTPULSE_VIDEO_SUBMIT_CANONICAL_MODE = "off";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      submitTargets: [{ submitUrl: "https://api.kie.ai/api/v1/veo/generate" }],
      routeLabel: "Kie Veo 3.1 Fast I2V",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        imageUrl: "https://cdn.shortpulse.test/first.png",
      },
      headers: {},
      url: "/api/fal/kie-veo-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing required media input for kie-ai/veo-3.1-fast-i2v submission.",
      code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      detail: {
        any_of_fields: ["image_url"],
        any_of_array_fields: ["image_urls"],
      },
    });
  });

  it("enforces alias collision rejection in canonical on mode", async () => {
    process.env.SHORTPULSE_VIDEO_SUBMIT_CANONICAL_MODE = "on";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      submitTargets: [{ submitUrl: "https://api.kie.ai/api/v1/veo/generate" }],
      routeLabel: "Kie Veo 3.1 Fast I2V",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        image_url: "https://cdn.shortpulse.test/canonical.png",
        imageUrl: "https://cdn.shortpulse.test/alias.png",
      },
      headers: {},
      url: "/api/fal/kie-veo-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Conflicting alias and canonical fields provided: imageUrl and image_url.",
      code: "VIDEO_ALIAS_COLLISION",
      detail: {
        alias: "imageUrl",
        canonical: "image_url",
      },
    });
  });

  it("returns deterministic 400 for Kie Kling media preflight validation failures", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/kling-3.0";
    process.env.KIE_API_KEY = "test-kie-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/kling-3.0",
      provider: "kie",
      submitTargets: [{ submitUrl: "https://api.kie.ai/api/v1/jobs/createTask" }],
      routeLabel: "Kie Kling 3.0",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        image_url: "https://cdn.shortpulse.test/invalid.txt",
        duration: 5,
        aspect_ratio: "9:16",
      },
      headers: {},
      url: "/api/fal/kie-kling-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "KIE_MEDIA_INPUT_INVALID",
      })
    );
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: provider submit preflight validation failed.",
      expect.objectContaining({
        code: "KIE_MEDIA_INPUT_INVALID",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.validation_failed",
        metadata: expect.objectContaining({
          code: "KIE_MEDIA_INPUT_INVALID",
        }),
      })
    );
  });

  it("logs Kie preflight media diagnostics on upstream submit errors", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/kling-3.0";
    process.env.KIE_API_KEY = "test-kie-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 422, msg: "file format not support", data: null }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "kie-ai/kling-3.0",
      provider: "kie",
      submitTargets: [{ submitUrl: "https://api.kie.ai/api/v1/jobs/createTask" }],
      routeLabel: "Kie Kling 3.0",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        image_url: "https://cdn.shortpulse.test/render.png",
        duration: 5,
        aspect_ratio: "9:16",
      },
      headers: {},
      url: "/api/fal/kie-kling-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 422,
        msg: "file format not support",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.upstream_error",
        metadata: expect.objectContaining({
          media_diagnostics: expect.objectContaining({
            model: "kling-3.0/video",
            motion_control: false,
          }),
        }),
      })
    );
  });

  it("returns 429 and releases reservation when admission is enforced", async () => {
    evaluateScopedGenerationAdmissionMock.mockResolvedValueOnce({
      decision: {
        mode: "enforce",
        allowed: false,
        enforced: true,
        wouldLimit: true,
        reason: "tier_limit",
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 5,
          globalMax: 4,
          tier: "video_long",
          tierActive: 3,
          tierMax: 2,
        },
      },
      capacitySnapshot: {
        tier: "video_long",
        globalActive: 4,
        tierActive: 2,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" }],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate frame",
        image_urls: ["https://cdn.shortpulse.test/first.png"],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "20");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many active generations. Please retry shortly.",
      code: "GENERATION_ADMISSION_LIMIT",
      retryAfterSeconds: 20,
      admissionScope: "per_user",
      admissionReason: "tier_limit",
      limits: {
        globalMax: 4,
        globalActive: 5,
        tier: "video_long",
        tierMax: 2,
        tierActive: 3,
      },
    });
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-release: generation admission limited.",
      expect.objectContaining({
        reason: "tier_limit",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.api.fal_submit.admission_limited",
        statusCode: 429,
      })
    );
  });

  it("fails closed with 503 when enforce mode is active but billing fell back to direct debit", async () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    chargeGenerationRequestMock.mockResolvedValueOnce({
      userId: "user-1",
      sourceRef: "source-ref-1",
      billingMode: "direct_debit",
      markSubmitted: vi.fn().mockResolvedValue({
        ok: true,
        status: "attached",
        sourceRef: "source-ref-1",
        message: null,
        code: null,
      }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
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
      headers: {},
      url: "/api/fal/nano-banana-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(evaluateScopedGenerationAdmissionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "20");
    expect(res.json).toHaveBeenCalledWith({
      error: "Generation admission is temporarily unavailable. Please retry shortly.",
      code: "GENERATION_ADMISSION_UNAVAILABLE",
      retryAfterSeconds: 20,
    });
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: admission unavailable without reservation mode.",
      expect.objectContaining({
        billing_mode: "direct_debit",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_submit.admission_unavailable",
        statusCode: 503,
      })
    );
  });

  it("logs telemetry in shadow mode but still submits upstream", async () => {
    evaluateScopedGenerationAdmissionMock.mockResolvedValueOnce({
      decision: {
        mode: "shadow",
        allowed: true,
        enforced: false,
        wouldLimit: true,
        reason: "global_limit",
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 7,
          globalMax: 4,
          tier: "image_standard",
          tierActive: 4,
          tierMax: 4,
        },
      },
      capacitySnapshot: {
        tier: "image_standard",
        globalActive: 6,
        tierActive: 3,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ request_id: "req-shadow-allowed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.api.fal_submit.admission_limited",
        statusCode: 429,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "req-shadow-allowed" })
    );
  });

  it("blocks explicit generation prompts before provider submit", async () => {
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal/flux-2-pro",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/flux-2-pro" }],
      routeLabel: "Fal Flux 2 Pro",
    });

    const req = {
      method: "POST",
      body: { prompt: "graphic sexual intercourse with explicit anatomy" },
      headers: {},
      url: "/api/fal/flux2pro-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "GENERATION_SAFETY_BLOCKED",
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
  });

  it("keeps allow_only behavior for fal-submit rewrite-lane prompts that remain suggestive", async () => {
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal/flux-2-pro",
      submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/flux-2-pro" }],
      routeLabel: "Fal Flux 2 Pro",
    });

    const req = {
      method: "POST",
      body: { prompt: "a monologue about suicidal thoughts" },
      headers: {},
      url: "/api/fal/flux2pro-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "GENERATION_SAFETY_BLOCKED",
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
  });
});

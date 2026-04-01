import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalStatusHandler } from "../../lib/server/api/falStatusProxy";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const resolveProviderRequestOwnershipMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();
const persistGenerationObservationMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
let persistedProjectionRows: Array<Record<string, unknown>> = [];
let persistedGenerationRows: Array<Record<string, unknown>> = [];
let persistedOutputRows: Array<Record<string, unknown>> = [];

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  resolveProviderRequestOwnership: (...args: unknown[]) =>
    resolveProviderRequestOwnershipMock(...args),
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../../lib/server/falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

vi.mock("../../lib/server/api/generationObservationInbox", () => ({
  persistGenerationObservation: (...args: unknown[]) => persistGenerationObservationMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("createFalStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
    delete process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED;
    delete process.env.KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;
    delete process.env.SHORTPULSE_KIE_TRUSTED_HOSTS;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveProviderRequestOwnershipMock.mockResolvedValue("owned");
    settleGenerationOutcomeMock.mockResolvedValue({
      settled: true,
      note: "captured",
    });
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "recovered",
      generationId: "gen-1",
      requestId: "req-1",
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    });
    persistedProjectionRows = [];
    persistedGenerationRows = [];
    persistedOutputRows = [];
    persistGenerationObservationMock.mockReset();
    persistGenerationObservationMock.mockResolvedValue(undefined);
    getSupabaseAdminMock.mockImplementation(() => {
      const generationQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedGenerationRows, error: null })),
      };
      generationQueryChain.eq.mockReturnValue(generationQueryChain);
      generationQueryChain.order.mockReturnValue(generationQueryChain);

      const outputQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedOutputRows, error: null })),
      };
      outputQueryChain.eq.mockReturnValue(outputQueryChain);
      outputQueryChain.order.mockReturnValue(outputQueryChain);

      const projectionQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedProjectionRows, error: null })),
      };
      projectionQueryChain.eq.mockReturnValue(projectionQueryChain);
      projectionQueryChain.order.mockReturnValue(projectionQueryChain);

      return {
        from: vi.fn((tableName: string) => {
          if (tableName === "generation_projection") {
            return {
              select: vi.fn().mockReturnValue(projectionQueryChain),
            };
          }
          if (tableName === "ai_generations") {
            return {
              select: vi.fn().mockReturnValue(generationQueryChain),
            };
          }
          if (tableName === "ai_generation_outputs") {
            return {
              select: vi.fn().mockReturnValue(outputQueryChain),
            };
          }
          throw new Error(`Unexpected table ${tableName}`);
        }),
      };
    });
  });

  afterEach(() => {
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    expect(executeGenerationRecoveryMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("forces terminal completed status when media is recovered from response_url payload", async () => {
    persistedGenerationRows = [
      {
        id: "gen-1",
        status: "processing",
        metadata: {},
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            response_url: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests/req-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            data: {
              images: [{ url: "https://cdn.shortpulse.test/seedream-image.png" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      generationId?: string;
      data?: { images?: Array<{ url?: string }> };
      shortpulseLifecycle?: {
        taskState?: string;
        isTerminal?: boolean;
        resultUrls?: string[];
      };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-1");
    expect(payload.generationId).toBe("gen-1");
    expect(payload.data?.images?.[0]?.url).toBe("https://cdn.shortpulse.test/seedream-image.png");
    expect(payload.shortpulseLifecycle).toEqual(
      expect.objectContaining({
        taskState: "success",
        isTerminal: true,
        resultUrls: ["https://cdn.shortpulse.test/seedream-image.png"],
      })
    );
    expect(persistGenerationObservationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        provider: "fal",
        providerRequestId: "req-1",
        observationSource: "poll",
        observationType: "completed",
        idempotencyKey: "poll:fal:req-1:completed",
      })
    );
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
  });

  it("returns recovery-pending payload from legacy persisted success metadata", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    persistedGenerationRows = [
      {
        id: "gen-persisted-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/persisted-result.mp4"],
        },
      },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-persisted-success",
        generationId: "gen-persisted-success-1",
        status: "IN_PROGRESS",
        state: "running",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          recoveryPending: true,
          providerState: "success",
          queueState: "dispatched",
          statusLabel: "Waiting for server recovery...",
        }),
      })
    );
  });

  it("returns completed payload from canonical outputs before the generation row flips to success", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    persistedGenerationRows = [
      {
        id: "gen-persisted-processing-1",
        status: "processing",
        metadata: {},
      },
    ];
    persistedOutputRows = [
      { output_index: 0, result_url: "https://cdn.shortpulse.test/persisted-output.mp4" },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-processing" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-persisted-processing",
        generationId: "gen-persisted-processing-1",
        status: "completed",
        state: "completed",
        resultUrls: ["https://cdn.shortpulse.test/persisted-output.mp4"],
        result_urls: ["https://cdn.shortpulse.test/persisted-output.mp4"],
        videos: [{ url: "https://cdn.shortpulse.test/persisted-output.mp4" }],
      })
    );
  });

  it("returns recovery-pending payload when projection reports success without canonical outputs", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-success-pending-1",
        result_urls: [],
        status: "ready",
        task_state: "success",
        queue_state: "dispatched",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-legacy-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-1",
        generationId: "gen-projection-success-pending-1",
        status: "IN_PROGRESS",
        state: "running",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "ready",
          recoveryPending: true,
          queueState: "dispatched",
          statusLabel: "Waiting for server recovery...",
        }),
      })
    );
  });

  it("returns terminal error payload from generation projection failure without provider fetch", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-fail-1",
        result_urls: [],
        status: "ready",
        task_state: "fail",
        error_message_short: "Generation failed",
        error_detail: "Provider reported failed state during recovery execution.",
      },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-projection-fail" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-projection-fail",
        generationId: "gen-projection-fail-1",
        status: "error",
        state: "error",
        error: "Generation failed",
        detail: "Provider reported failed state during recovery execution.",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Generation failed",
          errorDetail: "Provider reported failed state during recovery execution.",
        }),
      })
    );
  });

  it("returns recovery-pending payload when legacy persisted metadata skips newer non-success rows", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    persistedGenerationRows = [
      {
        id: "gen-persisted-processing-1",
        status: "processing",
        metadata: {},
      },
      {
        id: "gen-persisted-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/persisted-result.mp4"],
        },
      },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-persisted-success",
        generationId: "gen-persisted-success-1",
        status: "completed",
        state: "completed",
        resultUrls: ["https://cdn.shortpulse.test/persisted-result.mp4"],
      })
    );
  });

  it("returns recovery-pending payload even when provider key is unavailable and only metadata urls exist", async () => {
    delete process.env.KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_API_KEY;
    persistedGenerationRows = [
      {
        id: "gen-persisted-without-key-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/persisted-no-key.mp4"],
        },
      },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-without-key" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-persisted-without-key",
        generationId: "gen-persisted-without-key-1",
        status: "IN_PROGRESS",
        state: "running",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          recoveryPending: true,
          providerState: "success",
          queueState: "dispatched",
          statusLabel: "Waiting for server recovery...",
        }),
      })
    );
  });

  it("fails closed when queue base URLs are untrusted", async () => {
    const handler = createFalStatusHandler({
      queueBaseUrl: "https://example.com/untrusted",
      routeLabel: "Fal Untrusted",
      timeoutMs: 15000,
    });
    const req = {
      method: "POST",
      body: { requestId: "req-untrusted" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        request_id: "req-untrusted",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_status.untrusted_base_url",
      })
    );
  });

  it("keeps kie successFlag=0 record-info payloads non-terminal while media is pending", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";

    const pendingPayload = {
      code: 200,
      msg: "success",
      data: {
        taskId: "req-kie-running",
        successFlag: 0,
        response: null,
        responseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId=req-kie-running",
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pendingPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pendingPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pendingPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-running" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 200,
        data: expect.objectContaining({
          successFlag: 0,
        }),
      })
    );
  });

  it("captures kie successFlag=1 payload media from data.response.resultUrls", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "success",
          data: {
            taskId: "req-kie-success",
            successFlag: 1,
            response: {
              resultUrls: ["https://cdn.shortpulse.test/kie-veo-result.mp4"],
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        state: "completed",
      })
    );
  });

  it("returns terminal status payload media without depending on result fetch probes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "COMPLETED",
          data: {
            images: [{ url: "https://cdn.shortpulse.test/terminal-status-media.png" }],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-terminal-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-terminal-media");
    expect(payload.data?.images?.[0]?.url).toBe(
      "https://cdn.shortpulse.test/terminal-status-media.png"
    );
  });

  it("does not downgrade terminal status when completed status payload has stale in-progress response_url data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            response_url: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests/req-2",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            data: {
              images: [{ url: "https://cdn.shortpulse.test/seedream-image-2.png" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-2" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-2");
    expect(payload.data?.images?.[0]?.url).toBe("https://cdn.shortpulse.test/seedream-image-2.png");
  });

  it("probes alternate queue bases when the first status base misses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: { images: [{ url: "https://cdn.shortpulse.test/alt-base-success.png" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: [
        "https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests",
        "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      ],
      routeLabel: "Fal Nano Banana Pro Edit",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-alt-base" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.request_id).toBe("req-alt-base");
    expect(payload.data?.images?.[0]?.url).toBe("https://cdn.shortpulse.test/alt-base-success.png");
  });

  it("probes response_url across all status aliases before concluding no media", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            response_url:
              "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests/req-cross-alias",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            data: { images: [{ url: "https://cdn.shortpulse.test/cross-alias-media.png" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: [
        "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests",
      ],
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-cross-alias" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-cross-alias");
    expect(payload.data?.images?.[0]?.url).toBe(
      "https://cdn.shortpulse.test/cross-alias-media.png"
    );
  });

  it("does not downgrade terminal status when completed status payload has stale in-progress result data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            data: {
              images: [{ url: "https://cdn.shortpulse.test/seedream-image-3.png" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-3" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-3");
    expect(payload.data?.images?.[0]?.url).toBe("https://cdn.shortpulse.test/seedream-image-3.png");
  });

  it("prefers media-bearing alias results when another alias reports terminal failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "FAILED",
            error: "temporary alias failure",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: {
              videos: [{ url: "https://cdn.shortpulse.test/veo-alias-media.mp4" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "FAILED",
            error: "stale secondary alias failure",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: [
        "https://queue.fal.run/fal-ai/veo3.1/requests",
        "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
      ],
      routeLabel: "Fal Veo image-to-video",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-veo-alias-conflict" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { videos?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-veo-alias-conflict");
    expect(payload.data?.videos?.[0]?.url).toBe("https://cdn.shortpulse.test/veo-alias-media.mp4");
  });

  it("treats retryable status upstream failures as transient and keeps polling payload", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "upstream temporarily unavailable" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "x-fal-retryable": "true",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-status-retryable" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      error: "upstream temporarily unavailable",
      shortpulseLifecycle: {
        taskState: "running",
        isTerminal: false,
        providerState: "running",
        recoveryPending: true,
      },
    });
  });

  it("adds normalized lifecycle hints to nonterminal provider status payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "IN_PROGRESS",
          request_id: "req-nonterminal-hint",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-nonterminal-hint" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        request_id: "req-nonterminal-hint",
        shortpulseLifecycle: {
          taskState: "running",
          isTerminal: false,
          providerState: "in_progress",
          queueState: "dispatched",
          statusLabel: "Processing...",
        },
      })
    );
  });

  it("treats retryable result upstream failures as transient and keeps completed status payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "result temporarily unavailable" }), {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "x-fal-retryable": "true",
          },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-result-retryable" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "COMPLETED",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "completed",
          recoveryPending: true,
          queueState: "dispatched",
          statusLabel: "Waiting for server recovery...",
        }),
      })
    );
  });

  it("marks retryable result alias sweeps as recovery-pending lifecycle", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not ready" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-result-alias-retryable" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "COMPLETED",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "completed",
          recoveryPending: true,
          queueState: "dispatched",
          statusLabel: "Waiting for server recovery...",
        }),
      })
    );
  });

  it("treats non-retryable result upstream failures as terminal and returns an error payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: [
              {
                type: "downstream_service_error",
                msg: "Downstream service error",
              },
            ],
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "x-fal-needs-retry": "false",
            },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-result-terminal-failure" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      error: string;
      request_id: string;
      detail?: {
        detail?: Array<{ type?: string; msg?: string }>;
      };
    };
    expect(payload.status).toBe("error");
    expect(payload.state).toBe("error");
    expect(payload.error).toBe("Generation failed");
    expect(payload.request_id).toBe("req-result-terminal-failure");
    expect(payload.detail?.detail?.[0]?.type).toBe("downstream_service_error");
    expect(payload.detail?.detail?.[0]?.msg).toBe("Downstream service error");
    expect(persistGenerationObservationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        provider: "fal",
        providerRequestId: "req-result-terminal-failure",
        observationSource: "poll",
        observationType: "failed",
        idempotencyKey: "poll:fal:req-result-terminal-failure:failed",
      })
    );
  });

  it("treats transport failures as transient when status transient failures are enabled", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-transport" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-transport",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.transport",
      })
    );
  });

  it("treats non-JSON status responses as transient when status transient failures are enabled", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("<html>upstream gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-status-non-json" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-status-non-json",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.non_json_status",
      })
    );
  });

  it("treats non-JSON result responses as transient when status transient failures are enabled", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response("<html>invalid-result-payload</html>", {
          status: 422,
          headers: { "Content-Type": "text/html" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-result-non-json" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-result-non-json",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.non_json_result",
      })
    );
  });

  it("treats completed-without-media as transient when status transient failures are enabled", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-no-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-no-media",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.no_media",
      })
    );
  });

  it("keeps missing-media terminal behavior when status transient failures are disabled", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-terminal-no-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        state: "error",
        request_id: "req-terminal-no-media",
      })
    );
  });
});

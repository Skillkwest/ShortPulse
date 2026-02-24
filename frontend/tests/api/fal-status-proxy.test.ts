import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalStatusHandler } from "../../lib/server/api/falStatusProxy";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const resolveProviderRequestOwnershipMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();

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

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("createFalStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forces terminal completed status when media is recovered from response_url payload", async () => {
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
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-1");
    expect(payload.data?.images?.[0]?.url).toBe("https://cdn.shortpulse.test/seedream-image.png");
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "success",
      })
    );
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
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
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-terminal-media",
        outcome: "success",
      })
    );
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "fail" })
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
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-cross-alias",
        outcome: "success",
      })
    );
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "fail" })
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
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-veo-alias-conflict",
        outcome: "success",
      })
    );
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "fail" })
    );
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
    });
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "fail" })
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
      })
    );
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "fail" })
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
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-result-terminal-failure",
        outcome: "fail",
      })
    );
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-result-terminal-failure",
        outcome: "success",
      })
    );
  });
});

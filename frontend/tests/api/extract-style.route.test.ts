/**
 * Route tests for POST /api/ai/extract-style.
 * Validates the direct-image structured lane and its failure behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import extractStyleHandler from "../../pages/api/ai/extract-style";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const resolveRequiredRuntimeAgentPromptMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("../../lib/server/api/runtimeAgentPromptControlPlane", () => ({
  RequiredRuntimeAgentPromptMissingError: class RequiredRuntimeAgentPromptMissingError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} is missing from the control plane.`);
      this.name = "RequiredRuntimeAgentPromptMissingError";
    }
  },
  RequiredRuntimeAgentPromptUnavailableError: class RequiredRuntimeAgentPromptUnavailableError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} requires a live control-plane connection.`);
      this.name = "RequiredRuntimeAgentPromptUnavailableError";
    }
  },
  resolveRequiredRuntimeAgentPrompt: (...args: unknown[]) =>
    resolveRequiredRuntimeAgentPromptMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("POST /api/ai/extract-style", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    delete process.env.OPENAI_VISION_MODEL;
    delete process.env.OPENAI_VISION_FALLBACK_MODEL;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveRequiredRuntimeAgentPromptMock.mockResolvedValue({
      promptId: "OPENAI_PROMPT_STYLE_EXTRACT",
      promptBody: "Admin saved style extraction prompt.",
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 400 when imageDataUrl is missing", async () => {
    const req = {
      method: "POST",
      body: {},
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "route_error",
        reason_code: "REQUEST_INVALID",
        retryable: false,
        error: "imageDataUrl is required",
      })
    );
  });

  it("keeps the active route contract header without legacy deprecation metadata", async () => {
    const req = {
      method: "POST",
      body: {},
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Agent-Contract-Version", "1");
    expect(res.setHeader).not.toHaveBeenCalledWith("Deprecation", expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith("Sunset", expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith("Link", expect.stringContaining("deprecation"));
  });

  it("logs auth verifier exceptions before style extraction work", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,abc123" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(fetch).not.toHaveBeenCalled();
    expect(resolveRequiredRuntimeAgentPromptMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "ai/extract-style.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "route_error",
        reason_code: "ROUTE_ERROR",
        retryable: true,
        error: "Style extraction is temporarily unavailable.",
      })
    );
  });

  it("returns 400 when imageDataUrl is not a base64 image data URL", async () => {
    const req = {
      method: "POST",
      body: { imageDataUrl: "https://example.com/not-data.png" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "imageDataUrl must be a base64 image data URL",
      })
    );
  });

  it("extracts style from direct image data using structured output", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text:
            '{"styleTitle":"Noir Bloom","stylePrompt":"cinematic editorial photography style, dramatic moody lighting, shallow depth of field"}',
          usage: { input_tokens: 11, output_tokens: 14 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const req = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,abc123" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(fetchInit.body));
    expect(requestBody).toMatchObject({
      model: "gpt-5.4-mini",
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "style_extraction",
          strict: true,
        },
      },
    });
    expect(requestBody.input[0].content[0]).toEqual({
      type: "input_text",
      text: "Admin saved style extraction prompt.",
    });
    expect(requestBody.input[1].content[1]).toEqual(
      expect.objectContaining({
        type: "input_image",
        image_url: "data:image/jpeg;base64,abc123",
        detail: "high",
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "allow",
        outcome_class: "success_prompt",
        reason_code: "SUCCESS_PROMPT",
        retryable: false,
        styleTitle: "Noir Bloom",
        stylePrompt:
          "Photographic, cinematic editorial photography style, dramatic moody lighting, shallow depth of field",
        usage: {
          inputTokens: 11,
          outputTokens: 14,
        },
      })
    );
  });

  it("classifies malformed structured output as a deterministic contract failure", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ output_text: "{}" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,abc123" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_OUTPUT_CONTRACT",
        retryable: false,
      })
    );
  });

  it("fails closed when the runtime style extraction prompt is unavailable", async () => {
    const missingPromptError = new Error(
      "Runtime agent prompt OPENAI_PROMPT_STYLE_EXTRACT is missing from the control plane."
    );
    missingPromptError.name = "RequiredRuntimeAgentPromptMissingError";
    resolveRequiredRuntimeAgentPromptMock.mockRejectedValue(missingPromptError);

    const req = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,abc123" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "route_error",
        reason_code: "CONFIG_MISSING",
        retryable: false,
        error: "Style extraction is temporarily unavailable.",
      })
    );
  });

  it("classifies structured upstream failures with normalized fallback reasons", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }));

    const req = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,abc123" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
        fallback_reason: "upstream_unavailable",
      })
    );
  });

  it("sanitizes upstream provider detail before returning extraction failures", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        "Your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com and include the request ID req_3d45ff849f924f518429b524432e4ac1. safety_violations=[sexual].",
        { status: 400 }
      )
    );

    const req = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,abc123" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        detail: "Your request was blocked by the safety system. Reason: sexual.",
      })
    );
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
      })
    );
    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(payload.detail)).not.toMatch(/OpenAI|help\.openai\.com|request ID|req_/i);
    expect(payload).not.toHaveProperty("model");
  });
});

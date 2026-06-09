/**
 * Route tests for POST /api/ai/extract-style.
 * Validates the direct-image structured lane and its failure behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import extractStyleHandler from "../../pages/api/ai/extract-style";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
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

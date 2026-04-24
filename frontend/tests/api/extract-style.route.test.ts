/**
 * Route tests for POST /api/ai/extract-style.
 * Validates the direct-image structured lane and the temporary imageUrl compatibility lane.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import extractStyleHandler from "../../pages/api/ai/extract-style";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const dnsLookupMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => dnsLookupMock(...args),
  default: {
    lookup: (...args: unknown[]) => dnsLookupMock(...args),
  },
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
    process.env.OPENAI_DESCRIBE_ALLOWED_HOSTS = "example.com";
    delete process.env.OPENAI_VISION_MODEL;
    delete process.env.OPENAI_VISION_FALLBACK_MODEL;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 400 when both imageDataUrl and imageUrl are missing", async () => {
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
        error: "imageDataUrl or imageUrl is required",
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
      model: expect.any(String),
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

  it("keeps the imageUrl compatibility lane working during migration", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "STYLE TITLE\nNoir Bloom\n\nSTYLE ADD-ON\ncinematic editorial photography style, dramatic moody lighting, shallow depth of field",
              },
            },
          ],
          usage: { prompt_tokens: 7, completion_tokens: 9 },
        }),
      });

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/image.png" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        styleTitle: "Noir Bloom",
        stylePrompt:
          "Photographic, cinematic editorial photography style, dramatic moody lighting, shallow depth of field",
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
});

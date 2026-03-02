import { beforeEach, describe, expect, it, vi } from "vitest";
import generatePromptHandler from "../../pages/api/ai/generate-prompt";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

describe("POST /api/ai/generate-prompt sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_PROMPT_SYSTEM = "You are a prompt refiner.";
    delete process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED;
    delete process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("strips recap/meta tails from generated prompt output", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "An ancient Mayan temple rises from dense jungle. The prompt now includes a woman in traditional attire.",
            },
          },
        ],
        usage: { prompt_tokens: 22, completion_tokens: 15 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "ancient mayan temple in jungle" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");
    expect(res.setHeader).toHaveBeenCalledWith("Sunset", "Sun, 26 Apr 2026 00:00:00 GMT");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Link",
      '<https://docs.shortpulse.app/agent-route-migration>; rel="deprecation"'
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "An ancient Mayan temple rises from dense jungle.",
      })
    );
    expect(res.json.mock.calls[0]?.[0]).toMatchInlineSnapshot(`
      {
        "prompt": "An ancient Mayan temple rises from dense jungle.",
        "usage": {
          "inputTokens": 22,
          "outputTokens": 15,
        },
      }
    `);
  });

  it("treats summary-only outputs as invalid", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Summary: transformed the prompt with richer composition.",
            },
          },
        ],
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "ancient mayan temple in jungle" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: "No prompt returned" });
  });

  it("uses responses endpoint when responses mode is enabled", async () => {
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "A cinematic portrait at golden hour." }],
          },
        ],
        usage: { input_tokens: 18, output_tokens: 11 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait at golden hour" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/responses"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A cinematic portrait at golden hour.",
        usage: { inputTokens: 18, outputTokens: 11 },
      })
    );
    expect(res.json.mock.calls[0]?.[0]).toMatchInlineSnapshot(`
      {
        "prompt": "A cinematic portrait at golden hour.",
        "usage": {
          "inputTokens": 18,
          "outputTokens": 11,
        },
      }
    `);
  });

  it("falls back to chat completions when responses fails and fallback is enabled", async () => {
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response("responses unavailable", { status: 503 }))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "A high-detail city skyline at dusk." } }],
          usage: { prompt_tokens: 20, completion_tokens: 13 },
        }),
      });

    const req = {
      method: "POST",
      body: { prompt: "city skyline at dusk" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/responses"
    );
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A high-detail city skyline at dusk.",
      })
    );
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
  });

  it("returns responses upstream error when chat fallback is disabled", async () => {
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "false";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("responses unavailable", { status: 503 })
    );

    const req = {
      method: "POST",
      body: { prompt: "forest temple" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/responses"
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Upstream error",
      detail: "responses unavailable",
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.prompt_generation.upstream_unavailable",
        statusCode: 503,
        metadata: expect.objectContaining({
          detail: "responses unavailable",
        }),
      })
    );
    expect(res.json.mock.calls[0]?.[0]).toMatchInlineSnapshot(`
      {
        "detail": "responses unavailable",
        "error": "Upstream error",
      }
    `);
  });

  it("classifies upstream 429 failures as rate-limited", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("rate limited", { status: 429 })
    );

    const req = {
      method: "POST",
      body: { prompt: "storm over city skyline" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Upstream error",
      detail: "rate limited",
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.prompt_generation.rate_limited",
        statusCode: 429,
        metadata: expect.objectContaining({
          detail: "rate limited",
        }),
      })
    );
  });

  it("short-circuits explicit prompts before OpenAI call and returns refusal text payload", async () => {
    const req = {
      method: "POST",
      body: { prompt: "graphic sexual intercourse with explicit anatomy" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      prompt: "I cannot describe this.",
      usage: {},
    });
  });
});

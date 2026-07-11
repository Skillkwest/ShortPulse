import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VOICEOVER_ENHANCE_MAX_CHARACTERS, enhanceVoiceoverScript } from "../voiceoverEnhancement";

const fetchOpenAiCompatibleChatCompletionMock = vi.hoisted(() => vi.fn());

vi.mock("../api/openAiCompat", () => ({
  fetchOpenAiCompatibleChatCompletion: (...args: unknown[]) =>
    fetchOpenAiCompatibleChatCompletionMock(...args),
}));

describe("voiceoverEnhancement", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    fetchOpenAiCompatibleChatCompletionMock.mockReset();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it("rejects empty scripts before calling OpenAI", async () => {
    const result = await enhanceVoiceoverScript({ script: "   ", apiKey: "test-openai-key" });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetchOpenAiCompatibleChatCompletionMock).not.toHaveBeenCalled();
  });

  it("rejects oversized scripts before calling OpenAI", async () => {
    const result = await enhanceVoiceoverScript({
      script: "a".repeat(VOICEOVER_ENHANCE_MAX_CHARACTERS + 1),
      apiKey: "test-openai-key",
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetchOpenAiCompatibleChatCompletionMock).not.toHaveBeenCalled();
  });

  it("fails closed when OpenAI is not configured", async () => {
    const result = await enhanceVoiceoverScript({ script: "Read this line.", apiKey: "" });

    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(fetchOpenAiCompatibleChatCompletionMock).not.toHaveBeenCalled();
  });

  it("returns the enhanced script from the structured model response", async () => {
    fetchOpenAiCompatibleChatCompletionMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  enhancedScript: "[thoughtful] Read this line. [warmly]",
                }),
              },
            },
          ],
          usage: { prompt_tokens: 21, completion_tokens: 9, total_tokens: 30 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await enhanceVoiceoverScript({
      script: "Read this line.",
      apiKey: "test-openai-key",
    });

    expect(result).toEqual({
      ok: true,
      enhancedScript: "[thoughtful] Read this line. [warmly]",
      usage: { inputTokens: 21, outputTokens: 9, totalTokens: 30 },
    });
    expect(fetchOpenAiCompatibleChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-openai-key",
        responseFormat: expect.objectContaining({
          type: "json_schema",
        }),
      })
    );
  });

  it("fails closed when the model response is malformed", async () => {
    fetchOpenAiCompatibleChatCompletionMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
        status: 200,
      })
    );

    const result = await enhanceVoiceoverScript({
      script: "Read this line.",
      apiKey: "test-openai-key",
    });

    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});

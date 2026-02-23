import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOpenAiCompatibleChatCompletion } from "../openAiCompat";

describe("openAiCompat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses chat completions when responses flag is disabled", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "hello" } }],
            usage: { prompt_tokens: 1, completion_tokens: 2 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey: "test-key",
      model: "gpt-5-nano",
      openAiUrl: "https://example.test/v1/chat/completions",
      timeoutMs: 20000,
      env: {
        NODE_ENV: "test",
        SHORTPULSE_OPENAI_RESPONSES_ENABLED: "false",
      } as unknown as NodeJS.ProcessEnv,
      messages: [{ role: "user", content: "hi" }],
    });

    const calls = fetchMock.mock.calls;
    const firstCall = calls.at(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(firstCall?.at(0) ?? "")).toBe("https://example.test/v1/chat/completions");
    expect(response.ok).toBe(true);
  });

  it("uses responses api and converts output to chat-compatible shape", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "resp_1",
            model: "gpt-5-nano",
            output: [
              {
                content: [{ type: "output_text", text: "Converted response text." }],
              },
            ],
            usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey: "test-key",
      model: "gpt-5-nano",
      openAiUrl: "https://example.test/v1/chat/completions",
      timeoutMs: 20000,
      env: {
        NODE_ENV: "test",
        SHORTPULSE_OPENAI_RESPONSES_ENABLED: "true",
        SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "describe" },
            {
              type: "image_url",
              image_url: { url: "https://example.test/image.png", detail: "high" },
            },
          ],
        },
      ],
    });

    const calls = fetchMock.mock.calls;
    const firstCall = calls.at(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(firstCall?.at(0) ?? "")).toBe("https://example.test/v1/responses");

    const data = await response.json();
    expect(data).toMatchObject({
      choices: [{ message: { content: "Converted response text." } }],
      usage: {
        prompt_tokens: 11,
        completion_tokens: 7,
      },
    });
  });

  it("falls back to chat completions when responses request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "chat fallback" } }],
            usage: { prompt_tokens: 5, completion_tokens: 3 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey: "test-key",
      model: "gpt-5-nano",
      openAiUrl: "https://example.test/v1/chat/completions",
      timeoutMs: 20000,
      env: {
        NODE_ENV: "test",
        SHORTPULSE_OPENAI_RESPONSES_ENABLED: "true",
        SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv,
      messages: [{ role: "user", content: "hi" }],
    });

    const calls = fetchMock.mock.calls;
    const firstCall = calls.at(0);
    const secondCall = calls.at(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(firstCall?.at(0) ?? "")).toBe("https://example.test/v1/responses");
    expect(String(secondCall?.at(0) ?? "")).toBe("https://example.test/v1/chat/completions");
    expect(response.status).toBe(200);
  });

  it("returns responses failure when chat fallback is disabled", async () => {
    const fetchMock = vi.fn(async () => new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey: "test-key",
      model: "gpt-5-nano",
      openAiUrl: "https://example.test/v1/chat/completions",
      timeoutMs: 20000,
      env: {
        NODE_ENV: "test",
        SHORTPULSE_OPENAI_RESPONSES_ENABLED: "true",
        SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED: "false",
      } as unknown as NodeJS.ProcessEnv,
      messages: [{ role: "user", content: "hi" }],
    });

    const calls = fetchMock.mock.calls;
    const firstCall = calls.at(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(firstCall?.at(0) ?? "")).toBe("https://example.test/v1/responses");
    expect(response.status).toBe(404);
  });
});

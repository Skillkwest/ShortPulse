import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
  resolveStudioAgentOpenAiConfig,
} from "../studioAgentOpenAiGateway";

describe("studioAgentOpenAiGateway", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves default models/url/timeout when env is empty", () => {
    const config = resolveStudioAgentOpenAiConfig({} as NodeJS.ProcessEnv);

    expect(config).toEqual({
      openAiUrl: "https://api.openai.com/v1/chat/completions",
      openAiModel: "gpt-5-nano",
      openAiVisionModel: "gpt-5-nano",
      openAiThinkerModel: "gpt-5-nano",
      openAiFormatterModel: "gpt-5-nano",
      requestTimeoutMs: 20000,
    });
  });

  it("clamps timeout and applies thinker/formatter fallback chain", () => {
    const lowTimeout = resolveStudioAgentOpenAiConfig({
      STUDIO_AGENT_TIMEOUT_MS: "200",
      OPENAI_MODEL: "gpt-base",
      STUDIO_AGENT_THINKER_MODEL: "",
      STUDIO_AGENT_FORMATTER_MODEL: "gpt-formatter",
    } as unknown as NodeJS.ProcessEnv);
    const highTimeout = resolveStudioAgentOpenAiConfig({
      STUDIO_AGENT_TIMEOUT_MS: "200000",
      OPENAI_MODEL: "gpt-base",
      STUDIO_AGENT_THINKER_MODEL: "gpt-thinker",
      STUDIO_AGENT_FORMATTER_MODEL: "",
    } as unknown as NodeJS.ProcessEnv);

    expect(lowTimeout.requestTimeoutMs).toBe(1000);
    expect(lowTimeout.openAiThinkerModel).toBe("gpt-base");
    expect(lowTimeout.openAiFormatterModel).toBe("gpt-formatter");
    expect(highTimeout.requestTimeoutMs).toBe(120000);
    expect(highTimeout.openAiThinkerModel).toBe("gpt-thinker");
    expect(highTimeout.openAiFormatterModel).toBe("gpt-thinker");
  });

  it("formats timeout errors deterministically", () => {
    expect(formatStudioAgentErrorMessage(new DOMException("aborted", "AbortError"))).toBe(
      "OpenAI request timed out"
    );
    expect(formatStudioAgentErrorMessage(new Error("boom"))).toBe("boom");
    expect(formatStudioAgentErrorMessage("string error")).toBe("string error");
  });

  it("sends chat completion requests to configured endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchStudioAgentChatCompletion({
      apiKey: "test-key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-test",
      messages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        }),
      })
    );
  });
});

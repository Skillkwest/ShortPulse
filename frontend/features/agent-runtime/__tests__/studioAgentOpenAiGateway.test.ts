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
      visionTimeoutMs: 20000,
      turnTimeoutMs: 20000,
      upstreamRetryMaxAttempts: 2,
      upstreamRetryBaseDelayMs: 150,
      upstreamRetryMaxDelayMs: 1200,
    });
  });

  it("keeps agent defaults on OPENAI_MODEL even when direct prompt overrides are present", () => {
    const config = resolveStudioAgentOpenAiConfig({
      OPENAI_DIRECT_PROMPT_MODEL: "gpt-5.4",
    } as unknown as NodeJS.ProcessEnv);

    expect(config.openAiModel).toBe("gpt-5-nano");
    expect(config.openAiThinkerModel).toBe("gpt-5-nano");
    expect(config.openAiFormatterModel).toBe("gpt-5-nano");
  });

  it("clamps timeout/retry config and applies thinker/formatter fallback chain", () => {
    const lowTimeout = resolveStudioAgentOpenAiConfig({
      STUDIO_AGENT_TIMEOUT_MS: "200",
      STUDIO_AGENT_UPSTREAM_MAX_ATTEMPTS: "0",
      STUDIO_AGENT_UPSTREAM_RETRY_BASE_MS: "-1",
      STUDIO_AGENT_UPSTREAM_RETRY_MAX_MS: "20000",
      OPENAI_MODEL: "gpt-base",
      STUDIO_AGENT_THINKER_MODEL: "",
      STUDIO_AGENT_FORMATTER_MODEL: "gpt-formatter",
    } as unknown as NodeJS.ProcessEnv);
    const highTimeout = resolveStudioAgentOpenAiConfig({
      STUDIO_AGENT_TIMEOUT_MS: "200000",
      STUDIO_AGENT_UPSTREAM_MAX_ATTEMPTS: "99",
      STUDIO_AGENT_UPSTREAM_RETRY_BASE_MS: "9999",
      STUDIO_AGENT_UPSTREAM_RETRY_MAX_MS: "-5",
      OPENAI_MODEL: "gpt-base",
      STUDIO_AGENT_THINKER_MODEL: "gpt-thinker",
      STUDIO_AGENT_FORMATTER_MODEL: "",
    } as unknown as NodeJS.ProcessEnv);

    expect(lowTimeout.requestTimeoutMs).toBe(1000);
    expect(lowTimeout.visionTimeoutMs).toBe(1000);
    expect(lowTimeout.turnTimeoutMs).toBe(1000);
    expect(lowTimeout.upstreamRetryMaxAttempts).toBe(1);
    expect(lowTimeout.upstreamRetryBaseDelayMs).toBe(0);
    expect(lowTimeout.upstreamRetryMaxDelayMs).toBe(10000);
    expect(lowTimeout.openAiThinkerModel).toBe("gpt-base");
    expect(lowTimeout.openAiFormatterModel).toBe("gpt-formatter");
    expect(highTimeout.requestTimeoutMs).toBe(120000);
    expect(highTimeout.visionTimeoutMs).toBe(120000);
    expect(highTimeout.turnTimeoutMs).toBe(120000);
    expect(highTimeout.upstreamRetryMaxAttempts).toBe(5);
    expect(highTimeout.upstreamRetryBaseDelayMs).toBe(5000);
    expect(highTimeout.upstreamRetryMaxDelayMs).toBe(0);
    expect(highTimeout.openAiThinkerModel).toBe("gpt-thinker");
    expect(highTimeout.openAiFormatterModel).toBe("gpt-thinker");
  });

  it("supports split vision/turn timeout budgets with clamping", () => {
    const config = resolveStudioAgentOpenAiConfig({
      STUDIO_AGENT_TIMEOUT_MS: "18000",
      STUDIO_AGENT_VISION_TIMEOUT_MS: "250",
      STUDIO_AGENT_TURN_TIMEOUT_MS: "130000",
    } as unknown as NodeJS.ProcessEnv);

    expect(config.requestTimeoutMs).toBe(18000);
    expect(config.visionTimeoutMs).toBe(1000);
    expect(config.turnTimeoutMs).toBe(120000);
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

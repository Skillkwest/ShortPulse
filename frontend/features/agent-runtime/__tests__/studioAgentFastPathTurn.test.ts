import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeStudioAgentFastPathTurn } from "../studioAgentFastPathTurn";

const fetchStudioAgentChatCompletionMock = vi.fn();

vi.mock("../studioAgentOpenAiGateway", async () => {
  const actual = await vi.importActual("../studioAgentOpenAiGateway");
  return {
    ...(actual as object),
    fetchStudioAgentChatCompletion: (...args: unknown[]) =>
      fetchStudioAgentChatCompletionMock(...args),
  };
});

describe("executeStudioAgentFastPathTurn", () => {
  beforeEach(() => {
    fetchStudioAgentChatCompletionMock.mockReset();
  });

  it("returns upstream failure with status and detail", async () => {
    fetchStudioAgentChatCompletionMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "gateway error",
    });
    const markStage = vi.fn();

    const result = await executeStudioAgentFastPathTurn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-default",
      openAiMessages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
      effectiveCanonical: "base canonical",
      context: {},
      messages: [{ role: "user", content: "hello" }],
      markStage,
    });

    expect(result).toEqual({
      ok: false,
      status: 502,
      detail: "gateway error",
    });
    expect(markStage).toHaveBeenCalledWith("fast_path_turn", expect.any(Number));
  });

  it("normalizes thrown transport errors into retryable failures", async () => {
    fetchStudioAgentChatCompletionMock.mockRejectedValue(new TypeError("fetch failed"));
    const markStage = vi.fn();

    const result = await executeStudioAgentFastPathTurn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-default",
      openAiMessages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
      effectiveCanonical: "base canonical",
      context: {},
      messages: [{ role: "user", content: "hello" }],
      markStage,
    });

    expect(result).toEqual({
      ok: false,
      status: 503,
      detail: "fetch failed",
    });
    expect(markStage).toHaveBeenCalledWith("fast_path_turn", expect.any(Number));
  });

  it("maps abort errors to timeout-style upstream failures", async () => {
    fetchStudioAgentChatCompletionMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    const markStage = vi.fn();

    const result = await executeStudioAgentFastPathTurn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-default",
      openAiMessages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
      effectiveCanonical: "base canonical",
      context: {},
      messages: [{ role: "user", content: "hello" }],
      markStage,
    });

    expect(result).toEqual({
      ok: false,
      status: 504,
      detail: "OpenAI request timed out",
    });
    expect(markStage).toHaveBeenCalledWith("fast_path_turn", expect.any(Number));
  });

  it("normalizes upstream JSON parse failures into typed failures", async () => {
    fetchStudioAgentChatCompletionMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("invalid upstream json");
      },
    });
    const markStage = vi.fn();

    const result = await executeStudioAgentFastPathTurn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-default",
      openAiMessages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
      effectiveCanonical: "base canonical",
      context: {},
      messages: [{ role: "user", content: "hello" }],
      markStage,
    });

    expect(result).toEqual({
      ok: false,
      status: 502,
      detail: "invalid upstream json",
    });
    expect(markStage).toHaveBeenCalledWith("fast_path_turn", expect.any(Number));
  });

  it("returns normalized success payload and usage", async () => {
    fetchStudioAgentChatCompletionMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: "enhanced prompt",
                actions: { apply_prompt: "enhanced prompt" },
              }),
            },
          },
        ],
        usage: { prompt_tokens: 22, completion_tokens: 14 },
      }),
    });
    const markStage = vi.fn();

    const result = await executeStudioAgentFastPathTurn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-default",
      openAiMessages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
      effectiveCanonical: "base canonical",
      context: {},
      messages: [{ role: "user", content: "hello" }],
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.refusal).toBe(false);
    expect(result.result.parsed.actions?.applyPrompt).toBe("enhanced prompt");
    expect(result.result.resolvedCanonical).toBe("enhanced prompt");
    expect(result.result.repairUsed).toBe(false);
    expect(result.result.usage).toEqual({
      inputTokens: 22,
      outputTokens: 14,
    });
  });

  it("repairs malformed fast-path output with one bounded repair turn", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "plain malformed output" } }],
          usage: { prompt_tokens: 5, completion_tokens: 7 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  message: "repaired prompt",
                  actions: { applyPrompt: "repaired prompt" },
                }),
              },
            },
          ],
        }),
      });
    const markStage = vi.fn();

    const result = await executeStudioAgentFastPathTurn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-default",
      openAiMessages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
      effectiveCanonical: "base canonical",
      context: {},
      messages: [{ role: "user", content: "hello" }],
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(result.result.parsed.actions?.applyPrompt).toBe("repaired prompt");
    expect(result.result.repairUsed).toBe(true);
    expect(markStage).toHaveBeenCalledWith("fast_path_repair_turn", expect.any(Number));
  });

  it("fails closed when fast-path output remains unparseable after bounded repair", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "plain malformed output" } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "still malformed output" } }],
        }),
      });
    const markStage = vi.fn();

    const result = await executeStudioAgentFastPathTurn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      model: "gpt-default",
      openAiMessages: [{ role: "user", content: "hello" }],
      timeoutMs: 20000,
      effectiveCanonical: "base canonical",
      context: {},
      messages: [{ role: "user", content: "hello" }],
      markStage,
    });

    expect(result).toEqual({
      ok: false,
      status: 502,
      detail: "Fast-path output parse/repair failed",
    });
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(markStage).toHaveBeenCalledWith("fast_path_repair_turn", expect.any(Number));
  });
});

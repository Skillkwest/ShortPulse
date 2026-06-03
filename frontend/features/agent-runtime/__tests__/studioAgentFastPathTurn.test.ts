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

  it("accepts mixed-output responses when a later JSON block carries the contract payload", async () => {
    fetchStudioAgentChatCompletionMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                "Debug:",
                '{"trace":"abc-123"}',
                "Final payload:",
                '{"message":"golden hour portrait","actions":{"apply_prompt":"golden hour portrait"}}',
              ].join("\n"),
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
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.result.parsed.actions?.applyPrompt).toBe("golden hour portrait");
    expect(result.result.repairUsed).toBe(false);
  });

  it("accepts unstructured plain-text output without triggering repair", async () => {
    fetchStudioAgentChatCompletionMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "Here is your revised prompt: cinematic portrait, soft key light, shallow depth of field",
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
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.result.parsed.actions?.applyPrompt).toBe(
      "cinematic portrait, soft key light, shallow depth of field"
    );
    expect(result.result.repairUsed).toBe(false);
  });

  it("repairs unstructured custom Pulse follow-up questions into needs_input Pulse JSON", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "What product should anchor the first shot?",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "needs_input",
                  message: "What product should anchor the first shot?",
                  actions: null,
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
      openAiMessages: [{ role: "user", content: 'Pulse "Custom Pulse" was just activated.' }],
      timeoutMs: 20000,
      effectiveCanonical: null,
      context: {
        pulse: {
          presetId: "pulse_custom",
          label: "Custom Pulse",
          instructions: "Ask one setup question before generating.",
          pulseKind: "custom_gpt",
          runtimeMode: "custom_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
          source: "custom",
        },
      },
      messages: [{ role: "user", content: 'Pulse "Custom Pulse" was just activated.' }],
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(fetchStudioAgentChatCompletionMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        responseFormat: expect.objectContaining({
          json_schema: expect.objectContaining({
            name: "studio_agent_pulse_response",
          }),
        }),
      })
    );
    expect(result.result.parsed).toEqual(
      expect.objectContaining({
        message: "What product should anchor the first shot?",
        actions: undefined,
      })
    );
    expect(result.result.semanticStatus).toBe("needs_input");
    expect(result.result.repairUsed).toBe(true);
  });

  it("repairs unstructured custom Pulse final output into a ready Pulse artifact", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "A cinematic dark-fantasy storyboard with escalating beetle swarms, wet stone corridors, and amber torchlight.",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "ready",
                  message:
                    "A cinematic dark-fantasy storyboard with escalating beetle swarms, wet stone corridors, and amber torchlight.",
                  actions: {
                    applyPrompt:
                      "A cinematic dark-fantasy storyboard with escalating beetle swarms, wet stone corridors, and amber torchlight.",
                  },
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
      openAiMessages: [{ role: "user", content: "bugs dark bugs" }],
      timeoutMs: 20000,
      effectiveCanonical: null,
      context: {
        pulse: {
          presetId: "pulse_custom",
          label: "Custom Pulse",
          instructions: "Collect the brief, then output the final storyboard prompt.",
          pulseKind: "custom_gpt",
          runtimeMode: "custom_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
          source: "custom",
        },
      },
      messages: [{ role: "user", content: "bugs dark bugs" }],
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(result.result.semanticStatus).toBe("ready");
    expect(result.result.parsed.actions?.applyPrompt).toBe(
      "A cinematic dark-fantasy storyboard with escalating beetle swarms, wet stone corridors, and amber torchlight."
    );
    expect(result.result.repairUsed).toBe(true);
  });

  it("repairs unstructured custom Pulse direct answers into ready chat-only replies", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "Start with the protagonist's most emotionally specific fear, then build the scene around that pressure.",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "ready",
                  message:
                    "Start with the protagonist's most emotionally specific fear, then build the scene around that pressure.",
                  actions: null,
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
      openAiMessages: [{ role: "user", content: "How should I tighten the opening beat?" }],
      timeoutMs: 20000,
      effectiveCanonical: null,
      context: {
        pulse: {
          presetId: "pulse_custom",
          label: "Custom Pulse",
          instructions:
            "Answer creative coaching questions directly unless I ask for a final prompt.",
          pulseKind: "custom_gpt",
          runtimeMode: "custom_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
          source: "custom",
        },
      },
      messages: [{ role: "user", content: "How should I tighten the opening beat?" }],
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(result.result.semanticStatus).toBe("ready");
    expect(result.result.parsed.message).toBe(
      "Start with the protagonist's most emotionally specific fear, then build the scene around that pressure."
    );
    expect(result.result.parsed.actions).toBeUndefined();
    expect(result.result.resolvedCanonical).toBeNull();
    expect(result.result.repairUsed).toBe(true);
  });

  it("repairs unstructured guided-workflow Pulse text before falling back to needs_input", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Which camera motion should I use?",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "needs_input",
                  message: "Step 2 - Camera Motion: Which camera motion should I use?",
                  actions: null,
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
      openAiMessages: [{ role: "user", content: "uploaded image attached" }],
      timeoutMs: 20000,
      effectiveCanonical: null,
      context: {
        pulse: {
          presetId: "image",
          label: "Video Prompt Magic",
          instructions: "Follow the guided workflow one step at a time.",
          pulseKind: "guided_workflow",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          starterAssistantMessage: "Upload your image to get the process started :)",
          workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
          outputMode: "chat_reply",
          memoryPolicy: "session",
          source: "builtin",
        },
      },
      messages: [{ role: "user", content: "uploaded image attached" }],
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(result.result.semanticStatus).toBe("needs_input");
    expect(result.result.parsed).toEqual(
      expect.objectContaining({
        message: "Step 2 - Camera Motion: Which camera motion should I use?",
        actions: undefined,
      })
    );
    expect(result.result.repairUsed).toBe(true);
    expect(markStage).toHaveBeenCalledWith("fast_path_repair_turn", expect.any(Number));
  });

  it("repairs malformed fast-path output with one bounded repair turn", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Summary: transformed the prompt with richer descriptive detail.",
              },
            },
          ],
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
    const repairCallArgs = fetchStudioAgentChatCompletionMock.mock.calls[1]?.[0] as
      | { messages?: Array<{ role?: string; content?: string }> }
      | undefined;
    const repairUserContent = repairCallArgs?.messages?.find(
      (message) => message.role === "user"
    )?.content;
    expect(repairUserContent).toContain('"latest_user_input":"hello"');
    expect(repairUserContent).toContain('"canonical_prompt":"base canonical"');
    expect(result.result.parsed.actions?.applyPrompt).toBe("repaired prompt");
    expect(result.result.repairUsed).toBe(true);
    expect(markStage).toHaveBeenCalledWith("fast_path_repair_turn", expect.any(Number));
  });

  it("fails closed when fast-path output remains unparseable after bounded repair", async () => {
    fetchStudioAgentChatCompletionMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Summary: transformed the prompt with richer descriptive detail.",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Summary: transformed the prompt with richer descriptive detail.",
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

    expect(result).toEqual({
      ok: false,
      status: 502,
      detail: "Fast-path output parse/repair failed",
    });
    expect(fetchStudioAgentChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(markStage).toHaveBeenCalledWith("fast_path_repair_turn", expect.any(Number));
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { runThinkerFormatterTurn } from "../studioAgentThinkerFormatter";

describe("runThinkerFormatterTurn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses thinker/formatter responses when message content is returned as text-part arrays", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: [{ type: "output_text", text: '{"status":"ready","draft":"first"}' }],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: [
                  {
                    type: "output_text",
                    text: '{"message":"ok","actions":{"applyPrompt":"A cinematic portrait"}}',
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 11, completion_tokens: 22 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5.4-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: (raw) => {
        const parsed = JSON.parse(raw) as { message: string; actions?: { applyPrompt?: string } };
        return { message: parsed.message, actions: parsed.actions };
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.semanticStatus).toBe("ready");
    expect(result.result.parsed.actions?.applyPrompt).toBe("A cinematic portrait");
    expect(result.result.repairUsed).toBe(false);
    expect(result.result.usage).toEqual({ inputTokens: 11, outputTokens: 22 });
  });

  it("repairs formatter parse failures from semantic prompt_text when available", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: { content: '{"status":"ready","prompt_text":"semantic fallback prompt"}' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: [{ text: "plain formatter text" }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "still malformed formatter repair output" } }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5.4-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: () => null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.parsed.actions?.applyPrompt).toBe("semantic fallback prompt");
    expect(result.result.parsed.message).toBe("semantic fallback prompt");
    expect(result.result.repairUsed).toBe(true);
  });

  it("fails closed when formatter parse fails and semantic repair prompt is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"status":"ready"}' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: [{ text: "plain formatter text" }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "still malformed formatter repair output" } }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5.4-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: () => null,
    });

    expect(result).toEqual({
      ok: false,
      stage: "formatter",
      status: 502,
      detail: "Formatter output parse/repair failed",
    });
  });

  it("retries transient formatter failures and uses stage-specific models", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"status":"ready","prompt_text":"first prompt"}' } }],
          usage: { prompt_tokens: 4, completion_tokens: 5 },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        text: async () => "upstream timeout",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"message":"final prompt","actions":{"applyPrompt":"final prompt"}}',
              },
            },
          ],
          usage: { prompt_tokens: 7, completion_tokens: 8 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      thinkerModel: "gpt-thinker",
      formatterModel: "gpt-formatter",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: (raw) => JSON.parse(raw),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    const secondBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string);
    const thirdBody = JSON.parse((fetchMock.mock.calls[2]?.[1] as RequestInit).body as string);
    expect(firstBody.model).toBe("gpt-thinker");
    expect(secondBody.model).toBe("gpt-formatter");
    expect(thirdBody.model).toBe("gpt-formatter");
    expect(result.result.parsed.actions?.applyPrompt).toBe("final prompt");
    expect(result.result.repairUsed).toBe(false);
  });

  it("uses the catalog-backed default thinker model when no explicit model is supplied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"status":"ready","prompt_text":"fallback prompt"}' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"message":"fallback prompt","actions":{"applyPrompt":"fallback prompt"}}',
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: (raw) => JSON.parse(raw),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const firstBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(firstBody.model).toBe("gpt-5.5");
    expect(result.result.parsed.actions?.applyPrompt).toBe("fallback prompt");
  });

  it("falls back to thinker output when formatter stage keeps failing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"status":"ready","prompt_text":"cinematic close-up portrait"}',
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 14 },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => "bad gateway",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "service unavailable",
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5.4-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: () => null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.parsed.actions?.applyPrompt).toBe("cinematic close-up portrait");
    expect(result.result.repairUsed).toBe(true);
    expect(result.result.usage).toEqual({ inputTokens: 10, outputTokens: 14 });
  });

  it("returns thinker-stage failure when thinker response JSON cannot be parsed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad thinker payload");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5.4-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: () => null,
    });

    expect(result).toEqual({
      ok: false,
      stage: "thinker",
      status: 502,
      detail: "bad thinker payload",
    });
  });

  it("returns formatter-stage failure when formatter response JSON cannot be parsed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"status":"ready","prompt_text":"first prompt"}' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("bad formatter payload");
        },
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5.4-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: () => null,
    });

    expect(result).toEqual({
      ok: false,
      stage: "formatter",
      status: 502,
      detail: "bad formatter payload",
    });
  });

  it("repairs malformed formatter output before semantic fallback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"status":"ready","prompt_text":"first prompt"}' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "plain formatter text" } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"message":"repaired formatter prompt","actions":{"applyPrompt":"repaired formatter prompt"}}',
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5.4-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: (raw) => JSON.parse(raw),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.parsed.actions?.applyPrompt).toBe("repaired formatter prompt");
    expect(result.result.repairUsed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

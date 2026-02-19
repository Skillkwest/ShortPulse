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
      model: "gpt-5-nano",
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
    expect(result.result.usage).toEqual({ inputTokens: 11, outputTokens: 22 });
  });

  it("falls back to raw formatter text when parser returns null", async () => {
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
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThinkerFormatterTurn({
      apiKey: "test-key",
      openAiUrl: "https://example.com/v1/chat/completions",
      model: "gpt-5-nano",
      thinkerMessages: [{ role: "system", content: "think" }],
      buildFormatterMessages: (semantic) => [{ role: "user", content: JSON.stringify(semantic) }],
      parseAgentJson: () => null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.parsed.message).toBe("plain formatter text");
  });
});

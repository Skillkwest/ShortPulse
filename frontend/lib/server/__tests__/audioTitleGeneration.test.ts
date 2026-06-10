import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GENERATED_SONG_TITLE_MAX_CHARACTERS,
  buildFallbackSongTitle,
  generateMusicSongTitleBestEffort,
} from "../audioTitleGeneration";

const fetchOpenAiCompatibleChatCompletionMock = vi.hoisted(() => vi.fn());

vi.mock("../api/openAiCompat", () => ({
  fetchOpenAiCompatibleChatCompletion: (...args: unknown[]) =>
    fetchOpenAiCompatibleChatCompletionMock(...args),
}));

describe("audioTitleGeneration", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    fetchOpenAiCompatibleChatCompletionMock.mockReset();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it("builds a compact fallback title without requiring OpenAI", async () => {
    process.env.OPENAI_API_KEY = "";

    const title = await generateMusicSongTitleBestEffort({
      promptText: "  west coast rap about a unicorn riding neon clouds  ",
      lyricsText: "Glow in the midnight lane",
      structure: "loop",
      mode: "vocal",
    });

    expect(fetchOpenAiCompatibleChatCompletionMock).not.toHaveBeenCalled();
    expect(title).toBe("West Coast Rap About A Unicorn");
    expect(title.length).toBeLessThanOrEqual(GENERATED_SONG_TITLE_MAX_CHARACTERS);
  });

  it("uses the structured model response when available", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    fetchOpenAiCompatibleChatCompletionMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ title: "Neon Unicorn Hymn" }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const title = await generateMusicSongTitleBestEffort({
      promptText: "rap song about a unicorn",
      lyricsText: "one horn in the spotlight",
      structure: "full-track",
      mode: "vocal",
      bpm: 112,
      energyPercent: 75,
      providerPrompt: "rap song about a unicorn\nCreative direction...",
    });

    expect(title).toBe("Neon Unicorn Hymn");
    expect(fetchOpenAiCompatibleChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-openai-key",
        responseFormat: expect.objectContaining({
          type: "json_schema",
        }),
      })
    );
  });

  it("falls back when title generation fails", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    fetchOpenAiCompatibleChatCompletionMock.mockRejectedValue(new Error("timeout"));

    expect(
      await generateMusicSongTitleBestEffort({
        promptText: "ambient cello in a glass cathedral",
      })
    ).toBe(buildFallbackSongTitle({ promptText: "ambient cello in a glass cathedral" }));
  });
});

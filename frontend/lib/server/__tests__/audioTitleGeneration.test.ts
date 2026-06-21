import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GENERATED_SONG_TITLE_MAX_CHARACTERS,
  buildFallbackAudioReferenceTitle,
  buildFallbackSoundEffectTitle,
  buildFallbackSongTitle,
  finalizeAudioReferenceTitle,
  generateAudioReferenceTitleBestEffort,
  generateMusicSongTitleBestEffort,
  generateSoundEffectTitleBestEffort,
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
    expect(title).toBe("West Coast Rap");
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

  it("builds a compact fallback title for sound effects without requiring OpenAI", async () => {
    process.env.OPENAI_API_KEY = "";

    const title = await generateSoundEffectTitleBestEffort({
      promptText: "  cinematic thunder crack cave echo  ",
      durationSeconds: 4,
      loop: false,
    });

    expect(fetchOpenAiCompatibleChatCompletionMock).not.toHaveBeenCalled();
    expect(title).toBe("Cinematic Thunder Crack");
    expect(title.length).toBeLessThanOrEqual(GENERATED_SONG_TITLE_MAX_CHARACTERS);
  });

  it("adds a deterministic natural variation when a seed is provided", async () => {
    process.env.OPENAI_API_KEY = "";

    const firstTitle = await generateMusicSongTitleBestEffort({
      promptText: "west coast rap about a unicorn riding neon clouds",
      uniqueSeed: "source-ref-a",
    });
    const secondTitle = await generateMusicSongTitleBestEffort({
      promptText: "west coast rap about a unicorn riding neon clouds",
      uniqueSeed: "source-ref-b",
    });

    expect(firstTitle).not.toBe(secondTitle);
    expect(firstTitle).not.toMatch(/\b[A-Z0-9]{6}\b$/);
    expect(secondTitle).not.toMatch(/\b[A-Z0-9]{6}\b$/);
    expect(firstTitle.split(/\s+/).length).toBeLessThanOrEqual(3);
    expect(secondTitle.split(/\s+/).length).toBeLessThanOrEqual(3);
    expect(firstTitle.length).toBeLessThanOrEqual(GENERATED_SONG_TITLE_MAX_CHARACTERS);
    expect(secondTitle.length).toBeLessThanOrEqual(GENERATED_SONG_TITLE_MAX_CHARACTERS);
  });

  it("builds source-specific fallback titles for voice audio references", () => {
    expect(
      buildFallbackAudioReferenceTitle({
        sourceMode: "voiceover",
        promptText: "Welcome to the launch walkthrough for creators",
        voiceName: "Narrator",
      })
    ).toBe("Welcome To The");
    expect(
      buildFallbackAudioReferenceTitle({
        sourceMode: "voice-changer",
        promptText: "take.wav -> Narrator",
        transcriptText: "I can hear the city waking up below us.",
        sourceName: "take.wav",
        voiceName: "Narrator",
      })
    ).toBe("I Can Hear");
  });

  it("limits finalized reference titles to three words including natural variation", () => {
    const title = finalizeAudioReferenceTitle({
      baseTitle: "Launch Walkthrough For Creators",
      uniqueSeed: "source-ref-word-count",
    });

    expect(title.split(/\s+/)).toHaveLength(3);
    expect(title).toMatch(/^[A-Z][a-z]+ Launch Walkthrough$/);
    expect(title).not.toMatch(/\b[A-Z0-9]{6}\b$/);
  });

  it("clamps finalized generated titles after the natural variation is applied", () => {
    const title = finalizeAudioReferenceTitle({
      baseTitle: "A Very Long Cinematic Voiceover Title That Will Not Fit In The Card",
      uniqueSeed: "source-ref-clamp",
    });

    expect(title).not.toMatch(/\b[A-Z0-9]{6}\b$/);
    expect(title.split(/\s+/).length).toBeLessThanOrEqual(3);
    expect(title.length).toBeLessThanOrEqual(GENERATED_SONG_TITLE_MAX_CHARACTERS);
  });

  it("uses the structured model response for generic voiceover titles when available", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    fetchOpenAiCompatibleChatCompletionMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ title: "Launch Walkthrough" }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const title = await generateAudioReferenceTitleBestEffort({
      sourceMode: "voiceover",
      promptText: "Welcome to the launch walkthrough for creators",
      voiceName: "Narrator",
      uniqueSeed: "voiceover-source-ref",
    });

    expect(title).toMatch(/^[A-Z][a-z]+ Launch Walkthrough$/);
    expect(title).not.toMatch(/\b[A-Z0-9]{6}\b$/);
    expect(fetchOpenAiCompatibleChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-openai-key",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("base the title on the User prompt/script text"),
          }),
        ]),
        responseFormat: expect.objectContaining({
          type: "json_schema",
        }),
      })
    );
  });

  it("rejects unrelated generated voiceover titles and falls back to the prompt text", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    fetchOpenAiCompatibleChatCompletionMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ title: "Bug Sin" }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(
      generateAudioReferenceTitleBestEffort({
        sourceMode: "voiceover",
        promptText: "Welcome to the launch walkthrough for creators",
        voiceName: "Narrator",
      })
    ).resolves.toBe("Welcome To The");
  });

  it("rejects unrelated generated voice-changer titles and falls back to the transcript", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    fetchOpenAiCompatibleChatCompletionMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ title: "Neon Bug" }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(
      generateAudioReferenceTitleBestEffort({
        sourceMode: "voice-changer",
        promptText: "take.wav -> Narrator",
        transcriptText: "I can hear the city waking up below us.",
        sourceName: "take.wav",
        voiceName: "Narrator",
      })
    ).resolves.toBe("I Can Hear");

    expect(fetchOpenAiCompatibleChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("base the title on the transcript"),
          }),
        ]),
      })
    );
  });

  it("uses the structured model response for sound effect titles when available", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    fetchOpenAiCompatibleChatCompletionMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ title: "Cave Thunder Crack" }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const title = await generateSoundEffectTitleBestEffort({
      promptText: "cinematic thunder crack",
      durationSeconds: 4,
      loop: false,
    });

    expect(title).toBe("Cave Thunder Crack");
    expect(fetchOpenAiCompatibleChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-openai-key",
        responseFormat: expect.objectContaining({
          type: "json_schema",
        }),
      })
    );
  });

  it("falls back when sound effect title generation fails", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    fetchOpenAiCompatibleChatCompletionMock.mockRejectedValue(new Error("timeout"));

    expect(
      await generateSoundEffectTitleBestEffort({
        promptText: "glass bottle shatter on concrete",
      })
    ).toBe(buildFallbackSoundEffectTitle({ promptText: "glass bottle shatter on concrete" }));
  });
});

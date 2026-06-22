import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPENAI_AUDIO_TRANSCRIPTION_TIMEOUT_MS,
  transcribeAudioBuffer,
} from "../openAiAudioTranscription";

describe("openAiAudioTranscription", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends transcription requests with a timeout signal", async () => {
    const fetchMock = vi.fn(async () => new Response("Launch transcript.", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeAudioBuffer({
        audioBuffer: Buffer.from("audio"),
        audioContentType: "audio/wav",
        filename: "sample.wav",
      })
    ).resolves.toBe("Launch transcript.");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("bounds stalled transcription requests", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const pendingTranscript = transcribeAudioBuffer({
      audioBuffer: Buffer.from("audio"),
      audioContentType: "audio/wav",
      filename: "sample.wav",
    });
    const expectedRejection = expect(pendingTranscript).rejects.toThrow(
      `OpenAI transcription timed out after ${OPENAI_AUDIO_TRANSCRIPTION_TIMEOUT_MS}ms.`
    );

    await vi.advanceTimersByTimeAsync(OPENAI_AUDIO_TRANSCRIPTION_TIMEOUT_MS);
    await expectedRejection;
  });
});

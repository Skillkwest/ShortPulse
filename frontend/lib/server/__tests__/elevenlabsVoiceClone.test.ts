import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElevenLabsClonedVoice } from "../elevenlabs";

const originalElevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

describe("createElevenLabsClonedVoice", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
  });

  afterEach(() => {
    process.env.ELEVENLABS_API_KEY = originalElevenLabsApiKey;
    vi.restoreAllMocks();
  });

  it("submits clone audio with the provider files[] multipart field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ voice_id: "voice-clone-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const clonedVoice = await createElevenLabsClonedVoice({
      voiceName: "Kirk",
      voiceDescription: "Personal narration voice",
      sourceBuffer: Buffer.from("voice sample"),
      sourceFilename: "sample.webm",
      sourceMimeType: "audio/webm",
      removeBackgroundNoise: true,
    });

    const request = fetchMock.mock.calls[0]?.[1] as { body?: FormData; headers?: HeadersInit };
    const body = request.body;

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/voices/add",
      expect.objectContaining({
        method: "POST",
        headers: { "xi-api-key": "test-elevenlabs-key" },
      })
    );
    expect(body).toBeInstanceOf(FormData);
    expect(body?.get("name")).toBe("Kirk");
    expect(body?.get("description")).toBe("Personal narration voice");
    expect(body?.get("remove_background_noise")).toBe("true");
    expect(body?.get("files")).toBeNull();
    expect(body?.getAll("files[]")).toHaveLength(1);
    expect(clonedVoice).toEqual({
      voiceId: "voice-clone-1",
      name: "Kirk",
      previewUrl: null,
      description: "Personal narration voice",
      isFallback: false,
    });
  });

  it("surfaces structured provider validation messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({
          detail: [{ msg: "Audio sample must be longer." }],
        }),
      })
    );

    await expect(
      createElevenLabsClonedVoice({
        voiceName: "Short Sample",
        voiceDescription: null,
        sourceBuffer: Buffer.from("voice sample"),
        sourceFilename: "short.webm",
        sourceMimeType: "audio/webm",
        removeBackgroundNoise: true,
      })
    ).rejects.toMatchObject({
      message: "Audio sample must be longer.",
      status: 422,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateElevenLabsMusic,
  generateElevenLabsSoundEffect,
  generateElevenLabsVoiceChanger,
  generateElevenLabsVoiceover,
} from "../../lib/server/elevenlabs";

const originalFetch = global.fetch;

const buildMusicDetailedMultipartResponse = ({
  boundary,
  metadata,
  audio,
}: {
  boundary: string;
  metadata: unknown;
  audio?: Buffer;
}): Buffer => {
  const chunks = [
    Buffer.from(
      [`--${boundary}`, "Content-Type: application/json", "", JSON.stringify(metadata)].join("\r\n")
    ),
  ];
  if (audio) {
    chunks.push(
      Buffer.from([`\r\n--${boundary}`, "Content-Type: audio/mpeg", ""].join("\r\n")),
      Buffer.from("\r\n"),
      audio
    );
  }
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return Buffer.concat(chunks);
};

describe("ElevenLabs generated audio payload guard", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects a 200 voiceover response that is JSON instead of audio", async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: "provider returned an error envelope" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(
      generateElevenLabsVoiceover({
        voiceId: "voice-1",
        text: "hello",
        outputFormat: "mp3_44100_128",
        body: { model_id: "eleven_v3" },
      })
    ).rejects.toThrow("ElevenLabs voiceover request returned a non-audio payload.");
  });

  it("rejects a 200 sound-effect response that has no audio bytes", async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      })
    );

    await expect(
      generateElevenLabsSoundEffect({
        text: "door slam",
        outputFormat: "mp3_44100_128",
        body: { model_id: "eleven_text_to_sound_v2" },
      })
    ).rejects.toThrow("ElevenLabs sound effects request returned an empty audio payload.");
  });

  it("rejects a detailed music response that has metadata but no audio part", async () => {
    const boundary = "music-boundary";
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        buildMusicDetailedMultipartResponse({
          boundary,
          metadata: { composition_plan: { sections: [] } },
        }),
        {
          status: 200,
          headers: { "content-type": `multipart/mixed; boundary=${boundary}` },
        }
      )
    );

    await expect(
      generateElevenLabsMusic({
        prompt: "cinematic pulse",
        outputFormat: "mp3_44100_128",
        body: { model_id: "music_v1" },
      })
    ).rejects.toThrow("ElevenLabs music request returned an empty audio payload.");
  });

  it("rejects a 200 voice-changer response that is JSON instead of audio", async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "provider returned an error envelope" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(
      generateElevenLabsVoiceChanger({
        voiceId: "voice-1",
        sourceBuffer: Buffer.from("source-audio"),
        sourceFilename: "source.mp3",
        sourceMimeType: "audio/mpeg",
        outputFormat: "mp3_44100_128",
        modelId: "eleven_multilingual_sts_v2",
        voiceSettings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
        removeBackgroundNoise: false,
        inputFormat: "mp3",
      })
    ).rejects.toThrow("ElevenLabs voice changer request returned a non-audio payload.");
  });
});

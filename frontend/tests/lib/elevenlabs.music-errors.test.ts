import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateElevenLabsMusic } from "../../lib/server/elevenlabs";

const originalFetch = global.fetch;

const buildMusicDetailedMultipartResponse = ({
  boundary,
  metadata,
  audio,
}: {
  boundary: string;
  metadata: unknown;
  audio: Buffer;
}): Buffer =>
  Buffer.concat([
    Buffer.from(
      [
        `--${boundary}`,
        "Content-Type: application/json",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: audio/mpeg",
        "",
      ].join("\r\n")
    ),
    Buffer.from("\r\n"),
    audio,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

describe("generateElevenLabsMusic", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("surfaces nested provider detail messages instead of the generic fallback", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            message: "Music generation is not available for this workspace.",
            code: "music_not_enabled",
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    global.fetch = fetchMock;

    await expect(
      generateElevenLabsMusic({
        prompt: "lofi hip hop rap",
        outputFormat: "mp3_44100_128",
        body: {
          model_id: "music_v1",
          force_instrumental: true,
        },
      })
    ).rejects.toThrow("Music generation is not available for this workspace.");
  });

  it("uses the detailed music endpoint and extracts generated lyrics from the composition plan", async () => {
    const boundary = "music-boundary";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        buildMusicDetailedMultipartResponse({
          boundary,
          metadata: {
            composition_plan: {
              sections: [
                { section_name: "Verse", lines: ["City lights on the water"] },
                { section_name: "Chorus", lines: ["We keep moving through the night", ""] },
              ],
            },
            compositionPlan: {
              sections: [{ sectionName: "Ignored duplicate", lines: ["Ignore me"] }],
            },
          },
          audio: Buffer.from("generated-audio"),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
            "request-id": "provider-request-1",
            "song-id": "song-1",
          },
        }
      )
    );
    global.fetch = fetchMock;

    const result = await generateElevenLabsMusic({
      prompt: "vocal synth pop",
      outputFormat: "mp3_44100_128",
      body: {
        model_id: "music_v1",
        force_instrumental: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/music/detailed?output_format=mp3_44100_128",
      expect.objectContaining({
        body: JSON.stringify({
          prompt: "vocal synth pop",
          with_timestamps: false,
          model_id: "music_v1",
          force_instrumental: false,
        }),
      })
    );
    expect(result).toEqual({
      buffer: Buffer.from("generated-audio"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-request-1",
      songId: "song-1",
      lyricsText: "City lights on the water\nWe keep moving through the night",
    });
  });

  it("extracts generated lyrics from SDK-shaped camelCase composition plans", async () => {
    const boundary = "music-boundary";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        buildMusicDetailedMultipartResponse({
          boundary,
          metadata: {
            compositionPlan: {
              sections: [{ sectionName: "Verse", lines: ["Neon rain keeps time"] }],
            },
          },
          audio: Buffer.from("generated-audio"),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
        }
      )
    );
    global.fetch = fetchMock;

    const result = await generateElevenLabsMusic({
      prompt: "vocal synth pop",
      outputFormat: "mp3_44100_128",
      body: {
        model_id: "music_v1",
        force_instrumental: false,
      },
    });

    expect(result.lyricsText).toBe("Neon rain keeps time");
  });
});

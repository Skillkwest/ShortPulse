import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateElevenLabsMusic } from "../../lib/server/elevenlabs";

const originalFetch = global.fetch;

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
});
